// Video processor: posters + web-sized copies (companion to process-photos).
//
// For each unprocessed MP4: downloads the original, probes it with ffprobe
// (duration, display size), extracts a poster frame with ffmpeg, generates
// the same thumb/display/large WebP derivatives as photos get, transcodes a
// web-sized H.264/AAC copy (max 1920px wide, faststart) and uploads it all
// to the private family-derived bucket. Share pages only ever serve the web
// copy — never the original. Safe to rerun: it only touches media that
// isn't 'ready' unless --force is given.
//
// Needs ffmpeg + ffprobe on PATH (winget install Gyan.FFmpeg).
//
// Usage:
//   npm run videos:process -- --all
//   npm run videos:process -- --adventure <adventure-id>
//   npm run videos:process -- --all --force   (reprocess everything)
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { adminClient, loadEnv } from "./lib.mjs";

loadEnv();
const supabase = adminClient();

const args = process.argv.slice(2);
const all = args.includes("--all");
const force = args.includes("--force");
const adventureFlag = args.indexOf("--adventure");
const adventureId = adventureFlag !== -1 ? args[adventureFlag + 1] : null;

if (!all && !adventureId) {
  console.log("Usage: npm run videos:process -- --all | --adventure <id> [--force]");
  process.exit(1);
}

function run(command, runArgs, label) {
  const result = spawnSync(command, runArgs, { encoding: "utf8" });
  if (result.error?.code === "ENOENT") {
    console.error(`${command} not found on PATH. Install it with: winget install Gyan.FFmpeg`);
    process.exit(1);
  }
  if (result.status !== 0) {
    const stderr = (result.stderr ?? "").trim().split("\n").slice(-4).join("\n");
    throw new Error(`${label} failed (exit ${result.status}): ${stderr}`);
  }
  return result.stdout;
}

// Duration in seconds from the container metadata
function probe(file) {
  const stdout = run(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "json", file],
    "ffprobe",
  );
  const duration = Number.parseFloat(JSON.parse(stdout)?.format?.duration);
  return Number.isFinite(duration) ? duration : null;
}

// ffmpeg filter-arg commas must be backslash-escaped; built here to survive shells
const SCALE_FILTER = ["scale=trunc(min(1920", ",iw)/2)*2:-2"].join(String.fromCharCode(92));

const VARIANTS = [
  { name: "thumb", px: 600, quality: 75 },
  { name: "display", px: 1600, quality: 80 },
  { name: "large", px: 2400, quality: 84 },
];

let query = supabase
  .from("media")
  .select("id, original_path, mime_type, processing_status")
  .is("deleted_at", null)
  .like("mime_type", "video/%");
if (!force) query = query.neq("processing_status", "ready");
if (adventureId) query = query.eq("adventure_id", adventureId);

const { data: mediaRows, error: queryError } = await query;
if (queryError) {
  console.error("Query failed:", queryError.message);
  process.exit(1);
}

console.log(`${mediaRows.length} video(s) to process`);
let ok = 0;
let failed = 0;

for (const media of mediaRows) {
  const label = media.original_path;
  const workDir = await mkdtemp(path.join(tmpdir(), "holidays-video-"));
  try {
    await supabase
      .from("media")
      .update({ processing_status: "processing" })
      .eq("id", media.id);

    const { data: blob, error: downloadError } = await supabase.storage
      .from("family-originals")
      .download(media.original_path);
    if (downloadError) throw new Error(`download: ${downloadError.message}`);
    const input = path.join(workDir, "original.mp4");
    await writeFile(input, Buffer.from(await blob.arrayBuffer()));

    const duration = probe(input);

    // Poster frame from one second in (or the middle of very short clips).
    // ffmpeg applies rotation metadata, so the frame is upright.
    const posterFile = path.join(workDir, "poster.jpg");
    const posterAt = duration !== null ? Math.min(1, duration / 2) : 0;
    run(
      "ffmpeg",
      ["-y", "-ss", String(posterAt), "-i", input, "-frames:v", "1", "-q:v", "2", posterFile],
      "poster extract",
    );
    const poster = await readFile(posterFile);

    // The poster carries the video's true display dimensions post-rotation
    const posterMeta = await sharp(poster).metadata();

    const dir = media.original_path.replace(/\/original\.[^.]+$/, "");
    const paths = {};

    for (const variant of VARIANTS) {
      const buffer = await sharp(poster)
        .resize({
          width: variant.px,
          height: variant.px,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: variant.quality })
        .toBuffer();

      const target = `${dir}/${variant.name}.webp`;
      const { error: uploadError } = await supabase.storage
        .from("family-derived")
        .upload(target, buffer, { contentType: "image/webp", upsert: true });
      if (uploadError) throw new Error(`upload ${variant.name}: ${uploadError.message}`);
      paths[variant.name] = target;
    }

    // Web copy: H.264/AAC, capped at 1920px wide (even dimensions for the
    // encoder), faststart so playback begins before the download finishes.
    const webFile = path.join(workDir, "web.mp4");
    run(
      "ffmpeg",
      [
        "-y", "-i", input,
        "-c:v", "libx264", "-preset", "medium", "-crf", "23",
        "-vf", SCALE_FILTER,
        "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart",
        webFile,
      ],
      "transcode",
    );

    const webTarget = `${dir}/web.mp4`;
    const { error: webUploadError } = await supabase.storage
      .from("family-derived")
      .upload(webTarget, await readFile(webFile), {
        contentType: "video/mp4",
        upsert: true,
      });
    if (webUploadError) throw new Error(`upload web copy: ${webUploadError.message}`);

    await supabase
      .from("media")
      .update({
        thumbnail_path: paths.thumb,
        display_path: paths.display,
        large_path: paths.large,
        web_video_path: webTarget,
        width: posterMeta.width ?? null,
        height: posterMeta.height ?? null,
        duration_seconds: duration,
        processing_status: "ready",
      })
      .eq("id", media.id);

    ok += 1;
    console.log(`ready  ${label}${duration ? ` (${Math.round(duration)}s)` : ""}`);
  } catch (error) {
    failed += 1;
    await supabase
      .from("media")
      .update({ processing_status: "failed" })
      .eq("id", media.id);
    console.error(`FAILED ${label}: ${error.message}`);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

console.log(`\nDone: ${ok} processed, ${failed} failed.`);
if (failed > 0) {
  console.log("Failed items are marked processing_status='failed'. Rerun with --force after fixing the cause.");
  process.exit(1);
}
