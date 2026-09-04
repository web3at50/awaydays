"use client";

import { useEffect, useState } from "react";
import {
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map,
  Pin,
  Polyline,
  useAdvancedMarkerRef,
} from "@vis.gl/react-google-maps";
import { TRAVEL_MODE_EMOJI, type MapPin, type TravelMode } from "@/lib/types";
import { legMidpoint } from "@/lib/journeys";
import { paddedBounds, spreadDuplicates } from "@/lib/map-geometry";
import {
  GOOGLE_MAPS_API_KEY,
  GOOGLE_MAPS_MAP_ID,
  journeyLineOptions,
} from "@/lib/google-maps";
import type { MapLeg } from "@/components/AdventureMap";

// The Google Maps rendering of the trip mini-map and /map. Mirrors
// AdventureMap.tsx (the Leaflet fallback) feature for feature — pins with
// popups, journey legs, travel-mode emoji — so the two stay interchangeable.

function ModeEmojiMarker({
  position,
  mode,
}: {
  position: [number, number];
  mode: TravelMode;
}) {
  return (
    <AdvancedMarker
      position={{ lat: position[0], lng: position[1] }}
      clickable={false}
      anchorLeft="-50%"
      anchorTop="-50%"
    >
      <span
        style={{
          fontSize: 20,
          filter: "drop-shadow(0 1px 1px rgba(0,0,0,.4))",
        }}
      >
        {TRAVEL_MODE_EMOJI[mode]}
      </span>
    </AdvancedMarker>
  );
}

function PinMarker({
  pin,
  open,
  onOpen,
  onClose,
}: {
  pin: MapPin;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  return (
    <>
      {/* The hotel stands out from the idea pins: amber, with a hotel glyph.
          Only the hotel gets a child at all — even a `false` child makes
          AdvancedMarker render an empty custom container instead of the
          default pin, which left every idea pin invisible. */}
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: pin.latitude, lng: pin.longitude }}
        onClick={onOpen}
        {...(pin.kind === "hotel"
          ? {
              children: (
                <Pin
                  background="#b45309"
                  borderColor="#7c2d12"
                  glyphColor="#ffffff"
                  glyph="🏨"
                  scale={1.2}
                />
              ),
            }
          : {})}
      />
      {open && (
        <InfoWindow anchor={marker} onCloseClick={onClose}>
          <a
            href={pin.href}
            className="block no-underline text-stone-900 min-w-36"
          >
            {pin.thumbUrl && (
              <img
                src={pin.thumbUrl}
                alt=""
                className="w-full h-24 object-cover rounded-lg mb-1.5"
              />
            )}
            <span className="block font-semibold text-sm">{pin.title}</span>
            {pin.subtitle && (
              <span className="block text-xs text-stone-500 mt-0.5">
                {pin.subtitle}
              </span>
            )}
          </a>
        </InfoWindow>
      )}
    </>
  );
}

export default function GoogleAdventureMap({
  pins,
  journey = false,
  legs,
  className = "h-72",
  clickablePois = false,
  onLoadError,
}: {
  pins: MapPin[];
  journey?: boolean;
  /** Explicit leg geometry (real roads); when given, replaces pin-to-pin lines */
  legs?: MapLeg[];
  className?: string;
  /** Let Google's own POI icons (restaurants, sights…) open their info cards */
  clickablePois?: boolean;
  /** Called when the Maps JS API fails to load (ad blockers, outages) */
  onLoadError?: () => void;
}) {
  const [openPinId, setOpenPinId] = useState<string | null>(null);

  // Google reports key problems (referrer not allowed, billing, invalid
  // key) through this global callback rather than a script error, so
  // without it a misconfigured key shows Google's own "Oops" box where the
  // Leaflet fallback should be
  useEffect(() => {
    const w = window as Window & { gm_authFailure?: () => void };
    w.gm_authFailure = () => onLoadError?.();
    return () => {
      delete w.gm_authFailure;
    };
  }, [onLoadError]);

  if (pins.length === 0) return null;
  const spread = spreadDuplicates(pins);

  const bounds = paddedBounds(
    [
      ...spread.map((pin) => [pin.latitude, pin.longitude] as [number, number]),
      ...(legs ?? []).flatMap((leg) => leg.points),
    ],
    0.2,
  );

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
          clickableIcons={clickablePois}
          reuseMaps
          className="h-full w-full"
        >
          {/* Explicit legs: real road shapes solid, straight hops dashed */}
          {journey &&
            legs &&
            legs.map((leg, index) => (
              <Polyline
                key={`leg-${index}`}
                path={leg.points.map(([lat, lng]) => ({ lat, lng }))}
                {...journeyLineOptions(leg.onRoad, 0.7)}
              />
            ))}
          {journey &&
            legs &&
            legs.map((leg, index) => {
              if (!leg.mode) return null;
              const mid = legMidpoint(leg.points);
              if (!mid) return null;
              return (
                <ModeEmojiMarker
                  key={`leg-mode-${index}`}
                  position={mid}
                  mode={leg.mode}
                />
              );
            })}
          {/* No explicit legs: the original pin-to-pin dashed line */}
          {journey && !legs && spread.length > 1 && (
            <Polyline
              path={spread.map((pin) => ({
                lat: pin.latitude,
                lng: pin.longitude,
              }))}
              {...journeyLineOptions(false, 0.7)}
            />
          )}
          {journey &&
            !legs &&
            spread.slice(1).map((pin, index) => {
              if (!pin.travelMode) return null;
              const prev = spread[index];
              return (
                <ModeEmojiMarker
                  key={`mode-${pin.id}`}
                  position={[
                    (prev.latitude + pin.latitude) / 2,
                    (prev.longitude + pin.longitude) / 2,
                  ]}
                  mode={pin.travelMode}
                />
              );
            })}
          {spread.map((pin) => (
            <PinMarker
              key={pin.id}
              pin={pin}
              open={openPinId === pin.id}
              onOpen={() => setOpenPinId(pin.id)}
              onClose={() => setOpenPinId(null)}
            />
          ))}
        </Map>
      </APIProvider>
    </div>
  );
}
