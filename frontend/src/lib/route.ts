import type { SupabaseClient } from "@supabase/supabase-js";
import { journeyToEntry, type JourneyEntry } from "@/lib/journeys";
import { getHomeOrigin } from "@/lib/settings";
import { geoUserAgent } from "@/lib/geo-contact";

// Road routing, isolated here like geocoding: OSRM's public server (the
// OpenStreetMap routing project, no key needed). If its results or uptime
// ever disappoint, swap this one function — everything else just sees
// "points + km or null", and null falls back to the straight-line arc.

export interface RoadRoute {
  points: [number, number][]; // [lat, lng]
  km: number;
}

// Full geometry can run to thousands of points on a long drive; cap what we
// store — a few hundred still hugs the roads at any zoom the app shows.
const MAX_ROUTE_POINTS = 400;

function downsample(points: [number, number][]): [number, number][] {
  if (points.length <= MAX_ROUTE_POINTS) return points;
  const step = (points.length - 1) / (MAX_ROUTE_POINTS - 1);
  return Array.from(
    { length: MAX_ROUTE_POINTS },
    (_, i) => points[Math.round(i * step)],
  );
}

export async function fetchDrivingRoute(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): Promise<RoadRoute | null> {
  // The public OSRM server asks for an identifying User-Agent too
  const userAgent = geoUserAgent();
  if (!userAgent) return null;

  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${from.longitude},${from.latitude};${to.longitude},${to.latitude}` +
      `?overview=full&geometries=geojson`;
    const response = await fetch(url, {
      headers: { "User-Agent": userAgent },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!response.ok) return null;

    const data = (await response.json()) as {
      code?: string;
      routes?: { distance?: number; geometry?: { coordinates?: [number, number][] } }[];
    };
    const route = data.routes?.[0];
    if (data.code !== "Ok" || !route?.geometry?.coordinates?.length) return null;

    // GeoJSON is [lng, lat] — flip to Leaflet's [lat, lng]
    const points = downsample(
      route.geometry.coordinates
        .map(([lng, lat]) => [lat, lng] as [number, number])
        .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng)),
    );
    const km = (route.distance ?? 0) / 1000;
    if (points.length < 2 || km <= 0) return null;

    return { points, km };
  } catch {
    // Routing is decoration — a failure must never block a save
    return null;
  }
}

/**
 * Recompute the stored road routes for every entry in an adventure.
 * Called after an entry is saved, deleted or restored, because any change
 * can rewire which entry follows which. Car and bus legs get a road route;
 * everything else (train, ferry, hovercraft, plane, short hops) is cleared to null so
 * stale roads never linger after an edit.
 */
export async function refreshAdventureRoutes(
  supabase: SupabaseClient,
  adventureId: string,
): Promise<void> {
  try {
    const { data: rows } = await supabase
      .from("entries")
      .select(
        "id, entry_date, created_at, location, latitude, longitude, travel_mode, route_km",
      )
      .eq("adventure_id", adventureId)
      .is("deleted_at", null);
    const entries = (rows ?? []) as (JourneyEntry & { route_km: number | null })[];
    const origin = await getHomeOrigin(supabase);

    for (const entry of entries) {
      const leg = journeyToEntry(entries, entry.id, origin);
      const wantsRoute =
        leg !== null &&
        (entry.travel_mode === "car" || entry.travel_mode === "bus");

      if (!wantsRoute) {
        if (entry.route_km !== null) {
          await supabase
            .from("entries")
            .update({ route_geometry: null, route_km: null })
            .eq("id", entry.id);
        }
        continue;
      }

      const route = await fetchDrivingRoute(leg.from, leg.to);
      if (route) {
        await supabase
          .from("entries")
          .update({ route_geometry: route.points, route_km: route.km })
          .eq("id", entry.id);
      }
      // No route found: keep whatever we had — the arc still displays
    }
  } catch {
    // Best-effort by design
  }
}
