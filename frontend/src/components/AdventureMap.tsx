"use client";

import L from "leaflet";
import { MapContainer, Marker, Polyline, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "@/components/leaflet-defaults";
import { TRAVEL_MODE_EMOJI, type MapPin, type TravelMode } from "@/lib/types";
import { legMidpoint } from "@/lib/journeys";
import { spreadDuplicates } from "@/lib/map-geometry";
import { TILE_ATTRIBUTION, TILE_SIZE, TILE_URL, TILE_ZOOM_OFFSET } from "@/lib/map-tiles";

export interface MapLeg {
  points: [number, number][];
  mode: TravelMode | null;
  /** True when points trace a real road (drawn solid); false = straight hop (dashed) */
  onRoad: boolean;
}

export default function AdventureMap({
  pins,
  journey = false,
  legs,
  className = "h-72",
}: {
  pins: MapPin[];
  journey?: boolean;
  /** Explicit leg geometry (real roads); when given, replaces pin-to-pin lines */
  legs?: MapLeg[];
  className?: string;
}) {
  if (pins.length === 0) return null;
  const spread = spreadDuplicates(pins);

  const bounds = L.latLngBounds([
    ...spread.map((pin) => [pin.latitude, pin.longitude] as [number, number]),
    ...(legs ?? []).flatMap((leg) => leg.points),
  ]).pad(0.2);

  return (
    <MapContainer
      bounds={bounds}
      scrollWheelZoom={false}
      className={`${className} w-full rounded-2xl border border-stone-200 z-0`}
    >
      <TileLayer
        attribution={TILE_ATTRIBUTION}
        url={TILE_URL}
        tileSize={TILE_SIZE}
        zoomOffset={TILE_ZOOM_OFFSET}
      />
      {/* Explicit legs: real road shapes solid, straight hops dashed */}
      {journey &&
        legs &&
        legs.map((leg, index) => (
          <Polyline
            key={`leg-${index}`}
            positions={leg.points}
            pathOptions={{
              color: "#b45309",
              weight: 3,
              opacity: 0.7,
              dashArray: leg.onRoad ? undefined : "6 8",
            }}
          />
        ))}
      {journey &&
        legs &&
        legs.map((leg, index) => {
          if (!leg.mode) return null;
          const mid = legMidpoint(leg.points);
          if (!mid) return null;
          return (
            <Marker
              key={`leg-mode-${index}`}
              position={mid}
              interactive={false}
              icon={L.divIcon({
                className: "",
                html: `<span style="font-size:20px;filter:drop-shadow(0 1px 1px rgba(0,0,0,.4))">${TRAVEL_MODE_EMOJI[leg.mode]}</span>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12],
              })}
            />
          );
        })}
      {/* No explicit legs: the original pin-to-pin dashed line */}
      {journey && !legs && spread.length > 1 && (
        <Polyline
          positions={spread.map((pin) => [pin.latitude, pin.longitude])}
          pathOptions={{ color: "#b45309", weight: 3, opacity: 0.7, dashArray: "6 8" }}
        />
      )}
      {journey &&
        !legs &&
        spread.slice(1).map((pin, index) => {
          if (!pin.travelMode) return null;
          const prev = spread[index];
          return (
            <Marker
              key={`mode-${pin.id}`}
              position={[
                (prev.latitude + pin.latitude) / 2,
                (prev.longitude + pin.longitude) / 2,
              ]}
              interactive={false}
              icon={L.divIcon({
                className: "",
                html: `<span style="font-size:20px;filter:drop-shadow(0 1px 1px rgba(0,0,0,.4))">${TRAVEL_MODE_EMOJI[pin.travelMode]}</span>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12],
              })}
            />
          );
        })}
      {spread.map((pin) => (
        <Marker key={pin.id} position={[pin.latitude, pin.longitude]}>
          <Popup>
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
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
