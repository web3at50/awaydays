"use client";

import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, TileLayer, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "@/components/leaflet-defaults";
import type { JourneyLeg } from "@/lib/journeys";
import { TRAVEL_MODE_EMOJI } from "@/lib/types";
import { arcPoints, easeInOut, resampleEvenly } from "@/lib/map-geometry";
import { TILE_ATTRIBUTION, TILE_SIZE, TILE_URL, TILE_ZOOM_OFFSET } from "@/lib/map-tiles";

const ANIMATION_MS = 4000;

export default function JourneyMap({
  leg,
  className = "h-56",
}: {
  leg: JourneyLeg;
  className?: string;
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
  const vehicleRef = useRef<L.Marker>(null);

  const emoji = leg.mode ? TRAVEL_MODE_EMOJI[leg.mode] : "📍";
  const vehicleIcon = useMemo(
    () =>
      L.divIcon({
        className: "",
        html: `<span style="font-size:26px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.45))">${emoji}</span>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      }),
    [emoji],
  );

  // Drive the vehicle along the route once the map is on screen
  useEffect(() => {
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
      vehicleRef.current?.setLatLng(drivePath[index]);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    const timer = setTimeout(() => {
      frame = requestAnimationFrame(step);
    }, 600);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [drivePath]);

  const bounds = L.latLngBounds(points).pad(0.25);

  return (
    <MapContainer
      bounds={bounds}
      scrollWheelZoom={false}
      attributionControl={true}
      className={`${className} w-full rounded-2xl border border-stone-200 z-0`}
    >
      <TileLayer
        attribution={TILE_ATTRIBUTION}
        url={TILE_URL}
        tileSize={TILE_SIZE}
        zoomOffset={TILE_ZOOM_OFFSET}
      />
      <Polyline
        positions={points}
        pathOptions={{
          color: "#b45309",
          weight: 3,
          opacity: 0.75,
          // Roads draw solid; the fictional arc stays dashed
          dashArray: onRoad ? undefined : "6 8",
        }}
      />
      <Marker position={[leg.from.latitude, leg.from.longitude]}>
        <Tooltip permanent direction="bottom" offset={[-15, 5]}>
          {leg.from.name}
        </Tooltip>
      </Marker>
      <Marker position={[leg.to.latitude, leg.to.longitude]}>
        <Tooltip permanent direction="bottom" offset={[-15, 5]}>
          {leg.to.name}
        </Tooltip>
      </Marker>
      <Marker
        ref={vehicleRef}
        position={points[0]}
        icon={vehicleIcon}
        interactive={false}
        zIndexOffset={1000}
      />
    </MapContainer>
  );
}
