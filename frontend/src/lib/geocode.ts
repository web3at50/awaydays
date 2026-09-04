// Server-side geocoding, isolated here on purpose: if Nominatim's results
// disappoint for attraction names, swap this one function for Google's
// Geocoding API (server-side key) — map tiles stay Leaflet/OSM either way.

import { geoUserAgent } from "@/lib/geo-contact";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export async function geocodeLocation(
  query: string,
): Promise<Coordinates | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  // Nominatim's usage policy requires an identifying User-Agent with a
  // contact; without one we don't call it at all.
  const userAgent = geoUserAgent();
  if (!userAgent) return null;

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(trimmed)}`;
    const response = await fetch(url, {
      headers: { "User-Agent": userAgent },
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    });
    if (!response.ok) return null;

    const results = (await response.json()) as { lat?: string; lon?: string }[];
    const hit = results?.[0];
    if (!hit) return null;

    const latitude = Number(hit.lat);
    const longitude = Number(hit.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return { latitude, longitude };
  } catch {
    // Geocoding is best-effort — a failure must never block a save
    return null;
  }
}
