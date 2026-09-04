import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const PRESETS = {
  thumb: { width: 600, quality: 75 },
  display: { width: 1600, quality: 80 },
  large: { width: 2400, quality: 84 },
} as const;

type Size = keyof typeof PRESETS;

// Supabase image transformations can't read HEIC/HEIF sources
const TRANSFORMABLE = new Set(["image/jpeg", "image/png", "image/webp"]);

// Serves a private photo at a given size: prefers a permanent derivative,
// falls back to an on-demand transformed signed URL, then to the original.
// For videos, ?size=video streams the web copy (or the original for the
// family), and the image sizes serve the poster frame derivatives.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sizeParam = request.nextUrl.searchParams.get("size") ?? "thumb";
  const size: Size = sizeParam in PRESETS ? (sizeParam as Size) : "thumb";

  const supabase = await createClient();
  // Local JWT verification (asymmetric signing key) — no Auth server
  // round trip per image, matching proxy.ts.
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims) return new NextResponse("Unauthorized", { status: 401 });

  const { data: media } = await supabase
    .from("media")
    .select(
      "id, original_path, thumbnail_path, display_path, large_path, web_video_path, mime_type",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  if (!media) return new NextResponse("Not found", { status: 404 });

  const isVideo = media.mime_type.startsWith("video/");

  // Derivatives are immutable, so redirects are cached for 12 hours and the
  // signed URLs outlive the cache window by a comfortable margin — repeat
  // visits skip the auth + lookup + signing handshake entirely. Trade-off,
  // matching the shared photo route: a deleted photo can stay viewable to a
  // signed-in family member for up to the cache window.
  const expiresInMedia = 60 * 60 * 24;
  const cacheControl = "private, max-age=43200";

  if (isVideo && sizeParam === "video") {
    // Signed storage URLs support Range requests, so <video> seeking works.
    const { data } = media.web_video_path
      ? await supabase.storage
          .from("family-derived")
          .createSignedUrl(media.web_video_path, expiresInMedia)
      : await supabase.storage
          .from("family-originals")
          .createSignedUrl(media.original_path, expiresInMedia);
    if (!data) return new NextResponse("Video unavailable", { status: 502 });
    return NextResponse.redirect(data.signedUrl, {
      status: 307,
      headers: { "Cache-Control": cacheControl },
    });
  }

  if (isVideo) {
    // Image sizes for a video = its poster frame. No transform fallback is
    // possible, so an unprocessed video simply has no poster yet.
    const posterPath =
      size === "thumb"
        ? media.thumbnail_path
        : size === "display"
          ? media.display_path
          : media.large_path;
    if (!posterPath) return new NextResponse("Poster not ready", { status: 404 });
    const { data } = await supabase.storage
      .from("family-derived")
      .createSignedUrl(posterPath, expiresInMedia);
    if (!data) return new NextResponse("Poster unavailable", { status: 502 });
    return NextResponse.redirect(data.signedUrl, {
      status: 307,
      headers: { "Cache-Control": cacheControl },
    });
  }

  const derivedPath =
    size === "thumb"
      ? media.thumbnail_path
      : size === "display"
        ? media.display_path
        : media.large_path;

  const expiresIn = expiresInMedia;
  let signed: { signedUrl: string } | null = null;

  if (derivedPath) {
    const { data } = await supabase.storage
      .from("family-derived")
      .createSignedUrl(derivedPath, expiresIn);
    signed = data;
  }

  if (!signed) {
    const transform = TRANSFORMABLE.has(media.mime_type)
      ? {
          width: PRESETS[size].width,
          height: PRESETS[size].width,
          resize: "contain" as const,
          quality: PRESETS[size].quality,
        }
      : undefined;
    const { data } = await supabase.storage
      .from("family-originals")
      .createSignedUrl(media.original_path, expiresIn, transform ? { transform } : undefined);
    signed = data;
  }

  if (!signed) return new NextResponse("Image unavailable", { status: 502 });

  return NextResponse.redirect(signed.signedUrl, {
    status: 307,
    headers: { "Cache-Control": "private, max-age=1800" },
  });
}
