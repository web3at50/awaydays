import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveShareToken } from "@/lib/share";

const PRESETS = {
  thumb: { width: 600, quality: 75 },
  display: { width: 1600, quality: 80 },
  large: { width: 2400, quality: 84 },
} as const;

type Size = keyof typeof PRESETS;

const TRANSFORMABLE = new Set(["image/jpeg", "image/png", "image/webp"]);

// Serves a shared photo after validating the share token. Only web-sized
// derivatives (or on-demand transformed copies) — never original files.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; mediaId: string }> },
) {
  const { token, mediaId } = await params;
  const sizeParam = request.nextUrl.searchParams.get("size") ?? "thumb";
  const size: Size = sizeParam in PRESETS ? (sizeParam as Size) : "thumb";

  const resolved = await resolveShareToken(token);
  if (!resolved) return new NextResponse("Not found", { status: 404 });

  const admin = createAdminClient();
  let mediaQuery = admin
    .from("media")
    .select(
      "id, adventure_id, entry_id, original_path, thumbnail_path, display_path, large_path, web_video_path, mime_type",
    )
    .eq("id", mediaId)
    .is("deleted_at", null);

  if (resolved.scope === "adventure") {
    mediaQuery = mediaQuery.eq("adventure_id", resolved.adventure.id);
  }

  const { data: media } = await mediaQuery.maybeSingle();
  if (!media) return new NextResponse("Not found", { status: 404 });

  const { data: activeAdventure } = await admin
    .from("adventures")
    .select("id, cover_media_id")
    .eq("id", media.adventure_id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!activeAdventure) return new NextResponse("Not found", { status: 404 });

  // Shared galleries contain only media from active, published entries. A trip's
  // explicitly selected cover remains available even if it is not in that set.
  if (activeAdventure.cover_media_id !== media.id) {
    const { data: publishedEntry } = await admin
      .from("entries")
      .select("id")
      .eq("id", media.entry_id)
      .eq("adventure_id", media.adventure_id)
      .eq("status", "published")
      .is("deleted_at", null)
      .maybeSingle();
    if (!publishedEntry) return new NextResponse("Not found", { status: 404 });
  }

  // Signed URLs must outlive the CDN-cached redirect below by a comfortable
  // margin, or a redirect served late in the cache window points at a dead URL.
  const expiresIn = 60 * 60 * 24;

  // Videos: visitors only ever get the web-sized H.264 copy — never the
  // original. Until videos:process has run there is nothing to serve.
  if (media.mime_type.startsWith("video/") && sizeParam === "video") {
    if (!media.web_video_path) {
      return new NextResponse("Video unavailable", { status: 404 });
    }
    const { data } = await admin.storage
      .from("family-derived")
      .createSignedUrl(media.web_video_path, expiresIn);
    if (!data) return new NextResponse("Video unavailable", { status: 404 });
    return NextResponse.redirect(data.signedUrl, {
      status: 307,
      headers: {
        "Cache-Control": "public, max-age=1800, s-maxage=3600",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }

  // For videos the image sizes below resolve to the poster-frame
  // derivatives; the transform fallback never applies to video sources.
  const derivedPath =
    size === "thumb"
      ? media.thumbnail_path
      : size === "display"
        ? media.display_path
        : media.large_path;
  let signed: { signedUrl: string } | null = null;

  if (derivedPath) {
    const { data } = await admin.storage
      .from("family-derived")
      .createSignedUrl(derivedPath, expiresIn);
    signed = data;
  }

  // Fallback for unprocessed photos: a transformed (web-sized) copy of the
  // original. If the format can't be transformed, serve nothing rather than
  // ever exposing a full original on a public page.
  if (!signed && TRANSFORMABLE.has(media.mime_type)) {
    const { data } = await admin.storage
      .from("family-originals")
      .createSignedUrl(media.original_path, expiresIn, {
        transform: {
          width: PRESETS[size].width,
          height: PRESETS[size].width,
          resize: "contain",
          quality: PRESETS[size].quality,
        },
      });
    signed = data;
  }

  if (!signed) return new NextResponse("Image unavailable", { status: 404 });

  return NextResponse.redirect(signed.signedUrl, {
    status: 307,
    headers: {
      // s-maxage lets the Vercel edge reuse the redirect across visitors; a
      // revoked link can therefore serve cached photo redirects for up to an
      // hour — an accepted trade-off for speed.
      "Cache-Control": "public, max-age=1800, s-maxage=3600",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
