"use client";

// Client-only wrapper for the animated journey map, and the Google-vs-
// Leaflet switch: Google Maps when a key is present, the Leaflet + Esri
// fallback when it is absent or the Maps script fails to load.
import dynamic from "next/dynamic";
import { useState } from "react";
import type { JourneyLeg } from "@/lib/journeys";
import { GOOGLE_MAPS_ENABLED } from "@/lib/google-maps";

const loading = () => (
  <div className="h-56 w-full rounded-2xl border border-stone-200 bg-stone-100 animate-pulse" />
);

const JourneyMap = dynamic(() => import("@/components/JourneyMap"), {
  ssr: false,
  loading,
});

const GoogleJourneyMap = dynamic(
  () => import("@/components/GoogleJourneyMap"),
  { ssr: false, loading },
);

export function JourneyMapPanel(props: { leg: JourneyLeg; className?: string }) {
  const [googleFailed, setGoogleFailed] = useState(false);
  if (GOOGLE_MAPS_ENABLED && !googleFailed) {
    return (
      <GoogleJourneyMap {...props} onLoadError={() => setGoogleFailed(true)} />
    );
  }
  return <JourneyMap {...props} />;
}
