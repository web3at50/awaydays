// Google Maps configuration shared by the Google map components.
//
// The key is public by design (it ships in the client bundle); its
// protections live in the Google Cloud console: referrer-locked to this
// app's domains, restricted to Maps Platform APIs, and the Map-loads-per-day
// quota capped so the free tier can never be exceeded. When the key is
// absent the wrapper components fall back to the Leaflet + Esri maps —
// see docs/maps-and-journeys.md.
export const GOOGLE_MAPS_API_KEY =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

// Map IDs are not secrets either, but each installation needs its own: a
// Map ID is created in the Google Cloud console under Map management
// (JavaScript, vector), selects the vector renderer and is required for
// AdvancedMarker to work.
export const GOOGLE_MAPS_MAP_ID =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID;

// Google Maps is used only when both halves are configured; otherwise the
// wrapper components render the Leaflet fallback.
export const GOOGLE_MAPS_ENABLED = Boolean(
  GOOGLE_MAPS_API_KEY && GOOGLE_MAPS_MAP_ID,
);

export const JOURNEY_LINE_COLOR = "#b45309";

/**
 * Polyline styling for journey legs: solid amber for real road geometry,
 * dashed for straight-line hops. The Google Maps API has no dash setting,
 * so dashes are drawn by hiding the stroke and repeating a short line
 * symbol along the path (a 2-unit path at scale 3 ≈ the Leaflet "6 8"
 * dash pattern at the same weight).
 */
export function journeyLineOptions(
  onRoad: boolean,
  opacity: number,
): Omit<google.maps.PolylineOptions, "path" | "map"> {
  if (onRoad) {
    return {
      strokeColor: JOURNEY_LINE_COLOR,
      strokeWeight: 3,
      strokeOpacity: opacity,
    };
  }
  return {
    strokeColor: JOURNEY_LINE_COLOR,
    strokeOpacity: 0,
    strokeWeight: 3,
    icons: [
      {
        icon: {
          path: "M 0,-1 0,1",
          strokeColor: JOURNEY_LINE_COLOR,
          strokeOpacity: opacity,
          strokeWeight: 3,
          scale: 3,
        },
        offset: "0",
        repeat: "14px",
      },
    ],
  };
}
