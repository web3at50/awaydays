"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { ReactionBar } from "@/components/ReactionBar";
import type { ReactionRow } from "@/lib/types";
import { galleryPreview } from "@/lib/gallery-preview";

interface Photo {
  id: string;
  caption: string | null;
  alt_text: string | null;
  width: number | null;
  height: number | null;
  mime_type: string;
  processing_status: string;
}

const isVideo = (photo: Photo) => photo.mime_type.startsWith("video/");

function PlayBadge() {
  return (
    <span
      aria-hidden
      className="absolute inset-0 flex items-center justify-center"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-lg text-white shadow-lg">
        ▶
      </span>
    </span>
  );
}

const SWIPE_THRESHOLD_PX = 50;
const TAP_SLOP_PX = 10;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_RADIUS_PX = 40;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;

interface Transform {
  scale: number;
  tx: number;
  ty: number;
}

const IDENTITY: Transform = { scale: 1, tx: 0, ty: 0 };

// Full-screen photo with pinch, double-tap and drag-to-pan zoom, all
// hand-rolled on pointer events (matching the hand-rolled swipe this
// replaced). Horizontal swipe steps between photos only when unzoomed;
// while zoomed a single pointer pans instead. Remounted per photo via
// key so zoom state never leaks between photos.
function ZoomablePhoto({
  photo,
  mediaBasePath,
  onStep,
}: {
  photo: Photo;
  mediaBasePath: string;
  onStep: (delta: number) => void;
}) {
  const areaRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<
    | { type: "swipe" | "pan"; startX: number; startY: number; start: Transform }
    | { type: "pinch"; startDist: number; start: Transform }
    | null
  >(null);
  const lastTap = useRef<{ time: number; x: number; y: number } | null>(null);
  const [transform, setTransform] = useState<Transform>(IDENTITY);
  // Once zoomed, swap in the 2400px derivative — preloaded first so the
  // src swap hits the browser cache and never blanks the image.
  const [hiRes, setHiRes] = useState(false);

  const displaySrc = `${mediaBasePath}/${photo.id}?size=display`;
  const largeSrc = `${mediaBasePath}/${photo.id}?size=large`;

  const wantHiRes = useCallback(() => {
    const loader = new Image();
    loader.onload = () => setHiRes(true);
    loader.src = largeSrc;
  }, [largeSrc]);

  // Keep the image's edges outside the viewport while zoomed; centre any
  // axis where the scaled image is smaller than the area.
  const clamp = useCallback((next: Transform): Transform => {
    const img = imgRef.current;
    const area = areaRef.current;
    if (!img || !area) return next;
    const maxX = Math.max(0, (img.offsetWidth * next.scale - area.clientWidth) / 2);
    const maxY = Math.max(0, (img.offsetHeight * next.scale - area.clientHeight) / 2);
    return {
      scale: next.scale,
      tx: Math.min(maxX, Math.max(-maxX, next.tx)),
      ty: Math.min(maxY, Math.max(-maxY, next.ty)),
    };
  }, []);

  // Pointer position relative to the centre of the viewing area, which is
  // also the transform origin.
  const toAreaPoint = useCallback((clientX: number, clientY: number) => {
    const rect = areaRef.current!.getBoundingClientRect();
    return {
      x: clientX - rect.left - rect.width / 2,
      y: clientY - rect.top - rect.height / 2,
    };
  }, []);

  const beginSingle = useCallback(
    (x: number, y: number, current: Transform) => {
      gesture.current = {
        type: current.scale > 1 ? "pan" : "swipe",
        startX: x,
        startY: y,
        start: current,
      };
    },
    [],
  );

  const pinchDistance = useCallback(() => {
    const [a, b] = [...pointers.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }, []);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Capture is a nicety (keeps drags alive outside the element);
        // gestures still work without it.
      }
      pointers.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
      if (pointers.current.size === 2) {
        gesture.current = { type: "pinch", startDist: pinchDistance(), start: transform };
        wantHiRes();
      } else if (pointers.current.size === 1) {
        beginSingle(event.clientX, event.clientY, transform);
      }
    },
    [beginSingle, pinchDistance, transform, wantHiRes],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!pointers.current.has(event.pointerId)) return;
      pointers.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
      const active = gesture.current;
      if (!active) return;

      if (active.type === "pinch" && pointers.current.size >= 2) {
        const ratio = pinchDistance() / active.startDist;
        const scale = Math.min(MAX_SCALE, Math.max(1, active.start.scale * ratio));
        // Zoom around the area centre; panning refines the framing.
        const grow = scale / active.start.scale;
        setTransform(
          clamp({ scale, tx: active.start.tx * grow, ty: active.start.ty * grow }),
        );
      } else if (active.type === "pan") {
        setTransform(
          clamp({
            scale: active.start.scale,
            tx: active.start.tx + (event.clientX - active.startX),
            ty: active.start.ty + (event.clientY - active.startY),
          }),
        );
      }
      // Swipe is judged on release, so nothing to do here for it.
    },
    [clamp, pinchDistance],
  );

  const onPointerEnd = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
      if (!pointers.current.has(event.pointerId)) return;
      pointers.current.delete(event.pointerId);
      const active = gesture.current;
      gesture.current = null;

      // A finger lifted mid-pinch: carry on as a pan/swipe with the rest.
      if (pointers.current.size === 1) {
        const [remaining] = [...pointers.current.values()];
        beginSingle(remaining.x, remaining.y, transform);
        return;
      }

      if (pointers.current.size > 0 || cancelled || !active) return;

      if (active.type === "swipe" || active.type === "pan") {
        const deltaX = event.clientX - active.startX;
        const deltaY = event.clientY - active.startY;
        const moved = Math.hypot(deltaX, deltaY);

        if (
          active.type === "swipe" &&
          Math.abs(deltaX) >= SWIPE_THRESHOLD_PX &&
          Math.abs(deltaX) > Math.abs(deltaY)
        ) {
          onStep(deltaX < 0 ? 1 : -1);
          return;
        }

        if (moved <= TAP_SLOP_PX) {
          const now = event.timeStamp;
          const tap = lastTap.current;
          if (
            tap &&
            now - tap.time <= DOUBLE_TAP_MS &&
            Math.hypot(event.clientX - tap.x, event.clientY - tap.y) <=
              DOUBLE_TAP_RADIUS_PX
          ) {
            lastTap.current = null;
            if (transform.scale > 1) {
              setTransform(IDENTITY);
            } else {
              wantHiRes();
              const point = toAreaPoint(event.clientX, event.clientY);
              // Keep the tapped detail under the finger as it grows.
              setTransform(
                clamp({
                  scale: DOUBLE_TAP_SCALE,
                  tx: point.x * (1 - DOUBLE_TAP_SCALE),
                  ty: point.y * (1 - DOUBLE_TAP_SCALE),
                }),
              );
            }
          } else {
            lastTap.current = { time: now, x: event.clientX, y: event.clientY };
          }
        }
      }

      // Settle a pinch that ended barely zoomed back to exactly 1:1.
      if (active.type === "pinch" && transform.scale < 1.05) {
        setTransform(IDENTITY);
      }
    },
    [beginSingle, clamp, onStep, toAreaPoint, transform, wantHiRes],
  );

  return (
    <div
      ref={areaRef}
      className="flex h-full w-full touch-none items-center justify-center overflow-hidden"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(event) => onPointerEnd(event, false)}
      onPointerCancel={(event) => onPointerEnd(event, true)}
    >
      <img
        ref={imgRef}
        src={hiRes ? largeSrc : displaySrc}
        alt={photo.alt_text ?? photo.caption ?? ""}
        draggable={false}
        className="max-h-full max-w-full select-none object-contain sm:rounded-lg"
        style={{
          transform: `translate(${transform.tx}px, ${transform.ty}px) scale(${transform.scale})`,
          transformOrigin: "center",
          willChange: "transform",
        }}
      />
    </div>
  );
}

export function Gallery({
  photos,
  mediaBasePath = "/api/media",
  reactionsByMedia,
  myProfileId,
  myName,
  slug,
  entryId,
  previewLimit,
}: {
  photos: Photo[];
  mediaBasePath?: string;
  reactionsByMedia?: Record<string, ReactionRow[]>;
  myProfileId?: string;
  myName?: string;
  slug?: string;
  entryId?: string;
  previewLimit?: number;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const close = useCallback(() => setOpenIndex(null), []);
  const step = useCallback(
    (delta: number) => {
      setOpenIndex((current) => {
        if (current === null) return current;
        const next = current + delta;
        if (next < 0 || next >= photos.length) return current;
        return next;
      });
    },
    [photos.length],
  );

  useEffect(() => {
    if (openIndex === null) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close();
      if (event.key === "ArrowLeft") step(-1);
      if (event.key === "ArrowRight") step(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openIndex, close, step]);

  if (photos.length === 0) {
    return (
      <p className="text-sm text-stone-500 bg-white border border-stone-200 rounded-2xl p-6 text-center">
        No photos yet — add some below.
      </p>
    );
  }

  const open = openIndex !== null ? photos[openIndex] : null;
  const { visiblePhotos, hiddenCount } = galleryPreview(photos, previewLimit);

  return (
    <>
      <ul
        className={`grid gap-1.5 ${previewLimit === undefined ? "grid-cols-3 sm:grid-cols-4" : "grid-cols-3"}`}
      >
        {visiblePhotos.map((photo, index) => {
          const isViewAll = hiddenCount > 0 && index === visiblePhotos.length - 1;
          return (
            <li key={photo.id}>
              <button
                type="button"
                onClick={() => setOpenIndex(index)}
                className="relative block w-full aspect-square overflow-hidden rounded-lg bg-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-600"
                aria-label={
                  isViewAll
                    ? `View all ${photos.length} photos`
                    : photo.alt_text ??
                      photo.caption ??
                      `${isVideo(photo) ? "Video" : "Photo"} ${index + 1}`
                }
              >
                {isVideo(photo) && photo.processing_status !== "ready" ? (
                  // No poster frame until videos:process has run on the PC
                  <span className="flex h-full w-full flex-col items-center justify-center gap-1 bg-stone-200 text-stone-500">
                    <span aria-hidden className="text-2xl">▶</span>
                    <span className="text-xs font-medium">Video</span>
                  </span>
                ) : (
                  <img
                    src={`${mediaBasePath}/${photo.id}?size=thumb`}
                    alt={photo.alt_text ?? photo.caption ?? ""}
                    loading={previewLimit === undefined && index < 8 ? "eager" : "lazy"}
                    className="w-full h-full object-cover"
                  />
                )}
                {isVideo(photo) && photo.processing_status === "ready" && !isViewAll && (
                  <PlayBadge />
                )}
                {isViewAll && (
                  <span className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 px-2 text-center text-white">
                    <span className="text-2xl font-bold">+{hiddenCount}</span>
                    <span className="mt-0.5 text-xs font-semibold">
                      View all photos
                    </span>
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={open.caption ?? "Photo viewer"}
          className="fixed inset-0 z-50 flex flex-col bg-black/95"
          onClick={close}
        >
          {/* Image area: edge-to-edge on phones, breathing room on larger screens */}
          <div className="relative min-h-0 flex-1 sm:p-6">
            {isVideo(open) ? (
              // key remounts the player when stepping between items, so the
              // previous clip never keeps playing underneath the next one
              <div className="flex h-full w-full items-center justify-center">
                <video
                  key={open.id}
                  src={`${mediaBasePath}/${open.id}?size=video`}
                  poster={
                    open.processing_status === "ready"
                      ? `${mediaBasePath}/${open.id}?size=display`
                      : undefined
                  }
                  controls
                  playsInline
                  preload="metadata"
                  className="max-h-full max-w-full rounded-lg bg-black"
                  onClick={(event) => event.stopPropagation()}
                />
              </div>
            ) : (
              // key resets zoom whenever the photo changes
              <ZoomablePhoto
                key={open.id}
                photo={open}
                mediaBasePath={mediaBasePath}
                onStep={step}
              />
            )}

            <button
              type="button"
              onClick={close}
              aria-label="Close photo viewer"
              className="absolute top-3 right-3 h-11 w-11 rounded-full bg-black/50 text-xl text-white hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white"
            >
              ✕
            </button>

            {/* Desktop keeps floating side arrows in the empty space beside
                the image; on phones they'd cover it, so the strip below owns
                navigation there. */}
            {openIndex !== null && openIndex > 0 && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  step(-1);
                }}
                aria-label="Previous photo"
                className="absolute left-5 top-1/2 hidden h-16 w-16 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/90 text-4xl font-semibold leading-none text-stone-900 shadow-xl hover:bg-white focus:outline-none focus:ring-4 focus:ring-amber-400 sm:flex"
              >
                <span aria-hidden className="-mt-1">‹</span>
              </button>
            )}
            {openIndex !== null && openIndex < photos.length - 1 && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  step(1);
                }}
                aria-label="Next photo"
                className="absolute right-5 top-1/2 hidden h-16 w-16 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/90 text-4xl font-semibold leading-none text-stone-900 shadow-xl hover:bg-white focus:outline-none focus:ring-4 focus:ring-amber-400 sm:flex"
              >
                <span aria-hidden className="-mt-1">›</span>
              </button>
            )}
          </div>

          {/* Caption, reactions and controls live below the image so nothing
              ever covers the photo. */}
          <div
            className="flex flex-col items-center gap-2 px-4 pt-2 pb-[max(env(safe-area-inset-bottom),0.75rem)]"
            onClick={(event) => event.stopPropagation()}
          >
            {open.caption && (
              <p className="max-w-xl text-center text-sm whitespace-pre-line text-white/90">
                {open.caption}
              </p>
            )}
            {reactionsByMedia && slug && entryId && (
              <ReactionBar
                reactions={reactionsByMedia[open.id] ?? []}
                myProfileId={myProfileId}
                myName={myName}
                mediaId={open.id}
                slug={slug}
                pageEntryId={entryId}
                variant="dark"
              />
            )}
            <div className="flex items-center gap-4">
              {photos.length > 1 && (
                <button
                  type="button"
                  onClick={() => step(-1)}
                  disabled={openIndex === 0}
                  aria-label="Previous photo"
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-white/70 bg-white/90 text-3xl font-semibold leading-none text-stone-900 shadow-xl hover:bg-white focus:outline-none focus:ring-4 focus:ring-amber-400 disabled:opacity-30 sm:hidden"
                >
                  <span aria-hidden className="-mt-1">‹</span>
                </button>
              )}
              <p
                className="rounded-full bg-white/15 px-3 py-1.5 text-sm font-medium text-white/90"
                aria-live="polite"
              >
                {(openIndex ?? 0) + 1} of {photos.length}
              </p>
              {photos.length > 1 && (
                <button
                  type="button"
                  onClick={() => step(1)}
                  disabled={openIndex === photos.length - 1}
                  aria-label="Next photo"
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-white/70 bg-white/90 text-3xl font-semibold leading-none text-stone-900 shadow-xl hover:bg-white focus:outline-none focus:ring-4 focus:ring-amber-400 disabled:opacity-30 sm:hidden"
                >
                  <span aria-hidden className="-mt-1">›</span>
                </button>
              )}
            </div>
            {!isVideo(open) && (
              <p className="text-xs text-white/50">
                Pinch or double-tap to zoom
                {photos.length > 1 && " · swipe for more"}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
