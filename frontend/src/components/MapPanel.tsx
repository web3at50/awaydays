"use client";

// The Google-vs-Leaflet switch lives here: with a Google Maps key the map
// renders through the Google Maps JS API, and without one (or if the Maps
// script fails to load — ad blockers, outages) it falls back to the
// Leaflet + Esri map. Rollback to Leaflet everywhere is deleting the
// NEXT_PUBLIC_GOOGLE_MAPS_API_KEY env var. Both real map components are
// client-only, so this thin wrapper handles the dynamic ssr:false import.
import dynamic from "next/dynamic";
import { useState } from "react";
import type { MapPin } from "@/lib/types";
import type { MapLeg } from "@/components/AdventureMap";
import { GOOGLE_MAPS_ENABLED } from "@/lib/google-maps";

const loading = () => (
  <div className="h-72 w-full rounded-2xl border border-stone-200 bg-stone-100 animate-pulse" />
);

const AdventureMap = dynamic(() => import("@/components/AdventureMap"), {
  ssr: false,
  loading,
});

const GoogleAdventureMap = dynamic(
  () => import("@/components/GoogleAdventureMap"),
  { ssr: false, loading },
);

export function MapPanel({
  clickablePois,
  ...props
}: {
  pins: MapPin[];
  journey?: boolean;
  legs?: MapLeg[];
  className?: string;
  /** Google only: let base-map POI icons open their info cards (plan page) */
  clickablePois?: boolean;
}) {
  const [googleFailed, setGoogleFailed] = useState(false);
  if (GOOGLE_MAPS_ENABLED && !googleFailed) {
    return (
      <GoogleAdventureMap
        {...props}
        clickablePois={clickablePois}
        onLoadError={() => setGoogleFailed(true)}
      />
    );
  }
  // The Leaflet fallback has no interactive POIs to enable
  return <AdventureMap {...props} />;
}
