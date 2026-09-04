"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Uppy from "@uppy/core";
import DashboardPlugin from "@uppy/dashboard";
import Tus from "@uppy/tus";
import { createClient } from "@/lib/supabase/client";
import { finalizeUpload, registerUpload } from "@/lib/actions";

import "@uppy/core/css/style.min.css";
import "@uppy/dashboard/css/style.min.css";

const MAX_FILE_SIZE = 30 * 1024 * 1024;
const MAX_VIDEO_FILE_SIZE = 500 * 1024 * 1024;
const CHUNK_SIZE = 6 * 1024 * 1024;

function clientUploadIdFor(entryId: string, name: string, size: number) {
  return `${entryId}:${name}:${size}`;
}

// Reads pixel dimensions in the browser; returns null for formats the
// browser can't decode (e.g. HEIC in Chrome).
function getImageSize(
  data: Blob,
): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(data);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

function createUppy(
  entryId: string,
  onError: (message: string) => void,
  onBatchDone: () => void,
) {
  const supabase = createClient();

  const instance = new Uppy({
    restrictions: {
      // Videos get a bigger allowance than photos; the per-type cap is
      // enforced below (and again server-side in registerUpload).
      maxFileSize: MAX_VIDEO_FILE_SIZE,
      allowedFileTypes: ["image/*", ".heic", ".heif", "video/mp4", ".mp4"],
    },
    autoProceed: false,
    onBeforeFileAdded: (file) => {
      const isVideo = (file.type ?? "").startsWith("video/");
      if (!isVideo && (file.size ?? 0) > MAX_FILE_SIZE) {
        onError(`${file.name ?? "That photo"} is over the 30 MB photo limit`);
        return false;
      }
      return true;
    },
  });

  instance.use(Tus, {
    endpoint: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/upload/resumable`,
    chunkSize: CHUNK_SIZE,
    allowedMetaFields: ["bucketName", "objectName", "contentType", "cacheControl"],
    removeFingerprintOnSuccess: true,
    headers: { "x-upsert": "true" },
    onBeforeRequest: async (req) => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        req.setHeader("Authorization", `Bearer ${data.session.access_token}`);
      }
    },
  });

  // Before the bytes move: allocate a media id + stable object key per file.
  // Retries reuse the same key, so nothing is ever duplicated.
  instance.addPreProcessor(async (fileIDs) => {
    for (const fileID of fileIDs) {
      const file = instance.getFile(fileID);
      if (!file || file.meta.objectName) continue;

      const result = await registerUpload({
        entryId,
        clientUploadId: clientUploadIdFor(entryId, file.name ?? "photo", file.size ?? 0),
        filename: file.name ?? "photo",
        mimeType: file.type ?? "",
        byteSize: file.size ?? 0,
      });

      if (!result.ok) {
        instance.removeFile(fileID);
        onError(result.error);
        continue;
      }

      instance.setFileMeta(fileID, {
        bucketName: result.bucketName,
        objectName: result.objectName,
        contentType: file.type,
        cacheControl: "3600",
      });
    }
  });

  instance.on("upload-success", async (file) => {
    if (!file) return;
    // Videos get dimensions/duration later, from ffprobe in videos:process
    const isImage = (file.type ?? "").startsWith("image/");
    const size =
      isImage && file.data instanceof Blob ? await getImageSize(file.data) : null;
    await finalizeUpload({
      clientUploadId: clientUploadIdFor(entryId, file.name ?? "photo", file.size ?? 0),
      width: size?.width,
      height: size?.height,
    });
  });

  instance.on("complete", (result) => {
    if ((result?.successful?.length ?? 0) > 0) {
      onBatchDone();
    }
  });

  return instance;
}

export function UploadManager({ entryId }: { entryId: string }) {
  const router = useRouter();
  const [fatalError, setFatalError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Next's router object is stable across renders, so it's safe to capture here
  const [uppy] = useState(() =>
    createUppy(
      entryId,
      (message) => setFatalError(message),
      () => {
        setFatalError(null);
        router.refresh();
      },
    ),
  );

  useEffect(() => {
    if (!containerRef.current || uppy.getPlugin("Dashboard")) return;
    uppy.use(DashboardPlugin, {
      inline: true,
      target: containerRef.current,
      height: 330,
      width: "100%",
      hideProgressDetails: false,
      proudlyDisplayPoweredByUppy: false,
      note: "Photos up to 30 MB, MP4 videos up to 500 MB. Keep this page open while uploading.",
    });
    return () => {
      const plugin = uppy.getPlugin("Dashboard");
      if (plugin) uppy.removePlugin(plugin);
    };
  }, [uppy]);

  return (
    <div>
      <div ref={containerRef} />
      {fatalError && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 rounded-lg p-3 mt-2">
          {fatalError}
        </p>
      )}
    </div>
  );
}
