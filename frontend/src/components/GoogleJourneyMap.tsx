"use client";

import { useEffect, useMemo } from "react";
import {
  APIProvider,
  AdvancedMarker,
  Map,
  Polyline,
  useAdvancedMarkerRef,
} from "@vis.gl/react-google-maps";
import type { JourneyLeg } from "@/lib/journeys";
import { TRAVEL_MODE_EMOJI } from "@/lib/types";
import {
  arcPoints,
  easeInOut,
  paddedBounds,
  resampleEvenly,
} from "@/lib/map-geometry";
import {
  GOOGLE_MAPS_API_KEY,
  GOOGLE_MAPS_MAP_ID,
  journeyLineOptions,
} from "@/lib/google-maps";

// The Google Maps rendering of the animated single-leg journey map on entry
// pages. Mirrors JourneyMap.tsx (the Leaflet fallback): arc or road
// polyline, permanent stop labels, and the emoji vehicle driven along the
// path.

const ANIMATION_MS = 4000;

// A pin plus a permanent name label just below it — the Google equivalent
// of Leaflet's permanent Tooltip.
function StopMarker({
  position,
  label,
}: {
  position: { lat: number; lng: number };
  label: string;
}) {
  return (
    <>
      <AdvancedMarker position={position} clickable={false} />
      <AdvancedMarker
        position={position}
        clickable={false}
        anchorLeft="-50%"
        anchorTop="6px"
        zIndex={10}
      >
        <div className="whitespace-nowrap rounded border border-stone-200 bg-white px-1.5 py-0.5 text-xs text-stone-700 shadow">
          {label}
        </div>
      </AdvancedMarker>
    </>
  );
}

function VehicleMarker({
  drivePath,
  emoji,
}: {
  drivePath: [number, number][];
  emoji: string;
}) {
  const [markerRef, marker] = useAdvancedMarkerRef();

  // Drive the vehicle along the route once the map is on screen. Position
  // updates mutate the marker instance directly — routing them through
  // React state would re-render the map on every animation frame.
  useEffect(() => {
    if (!marker) return;
    let frame = 0;
    let start: number | null = null;
    const step = (now: number) => {
      if (start === null) start = now;
      const t = Math.min((now - start) / ANIMATION_MS, 1);
      const eased = easeInOut(t);
      const index = Math.min(
        Math.round(eased * (drivePath.length - 1)),
        drivePath.length - 1,
      );
      marker.position = { lat: drivePath[index][0], lng: drivePath[index][1] };
      if (t < 1) frame = requestAnimationFrame(step);
    };
    const timer = setTimeout(() => {
      frame = requestAnimationFrame(step);
    }, 600);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [drivePath, marker]);

  return (
    <AdvancedMarker
      ref={markerRef}
      position={{ lat: drivePath[0][0], lng: drivePath[0][1] }}
      clickable={false}
      anchorLeft="-50%"
      anchorTop="-50%"
      zIndex={1000}
    >
      <span
        style={{
          fontSize: 26,
          filter: "drop-shadow(0 1px 2px rgba(0,0,0,.45))",
        }}
      >
        {emoji}
      </span>
    </AdvancedMarker>
  );
}

export default function GoogleJourneyMap({
  leg,
  className = "h-56",
  onLoadError,
}: {
  leg: JourneyLeg;
  className?: string;
  /** Called when the Maps JS API fails to load (ad blockers, outages) */
  onLoadError?: () => void;
}) {
  // Real road geometry when we have it, decorative arc when we don't
  const onRoad = (leg.routePoints?.length ?? 0) >= 2;
  const points = useMemo(
    () => (onRoad ? leg.routePoints! : arcPoints(leg)),
    [leg, onRoad],
  );
  const drivePath = useMemo(
    () => (onRoad ? resampleEvenly(points, 256) : points),
    [points, onRoad],
  );

  const emoji = leg.mode ? TRAVEL_MODE_EMOJI[leg.mode] : "📍";
  const bounds = paddedBounds(points, 0.25);

  return (
    <div
      className={`${className} w-full rounded-2xl border border-stone-200 overflow-hidden z-0`}
    >
      <APIProvider
        apiKey={GOOGLE_MAPS_API_KEY ?? ""}
        language="en"
        region="GB"
        onError={onLoadError}
      >
        <Map
          mapId={GOOGLE_MAPS_MAP_ID}
          defaultBounds={bounds}
          gestureHandling="cooperative"
          mapTypeControl={false}
          streetViewControl={false}
          fullscreenControl={false}
          clickableIcons={false}
          reuseMaps
          className="h-full w-full"
        >
          <Polyline
            path={points.map(([lat, lng]) => ({ lat, lng }))}
            {...journeyLineOptions(onRoad, 0.75)}
          />
          <StopMarker
            position={{ lat: leg.from.latitude, lng: leg.from.longitude }}
            label={leg.from.name}
          />
          <StopMarker
            position={{ lat: leg.to.latitude, lng: leg.to.longitude }}
            label={leg.to.name}
          />
          <VehicleMarker drivePath={drivePath} emoji={emoji} />
        </Map>
      </APIProvider>
    </div>
  );
}
