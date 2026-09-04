import type { TravelMode } from "@/lib/types";

// A journey is derived, never stored: consecutive diary entries whose
// coordinates are meaningfully far apart form a leg from one to the next.

export interface JourneyStop {
  name: string;
  latitude: number;
  longitude: number;
}

/**
 * Where a trip's journey begins before its first located entry — normally
 * the family home from settings. Passing it means nobody needs a fake
 * "setting off" entry just to plant the starting pin.
 */
export type JourneyOrigin = JourneyStop;

export interface JourneyLeg {
  from: JourneyStop;
  to: JourneyStop;
  mode: TravelMode | null;
  /** Straight-line distance, always present */
  distanceKm: number;
  /** Real road route when one was found (car and bus legs) */
  routePoints: [number, number][] | null;
  roadKm: number | null;
}

// Short hops (walking into town, geocoder jitter) are not journeys
const MIN_LEG_KM = 5;

export interface JourneyEntry {
  id: string;
  entry_date: string;
  created_at: string;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  travel_mode: TravelMode | null;
  route_geometry?: [number, number][] | null;
  route_km?: number | null;
}

export function distanceKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/**
 * The point halfway *along* a drawn leg, for planting the travel-mode emoji
 * on the map.
 *
 * Indexing the middle of the array does not work. A straight hop — plane,
 * train, ferry, walk — is only ever two points, so `points[length / 2]` is
 * the destination, and the emoji ended up hidden underneath the arrival pin:
 * cars showed on the map and planes and trains did not. Road geometry has the
 * opposite problem, being dense in towns and sparse on motorways, so the
 * middle *index* can sit a long way from the middle of the drive.
 *
 * Walking the polyline by cumulative distance fixes both.
 */
export function legMidpoint(
  points: readonly [number, number][],
): [number, number] | null {
  if (points.length === 0) return null;
  if (points.length === 1) return [points[0][0], points[0][1]];

  const at = (p: readonly [number, number]) => ({ latitude: p[0], longitude: p[1] });

  const cumulative: number[] = [0];
  for (let i = 1; i < points.length; i += 1) {
    cumulative.push(cumulative[i - 1] + distanceKm(at(points[i - 1]), at(points[i])));
  }

  const total = cumulative[cumulative.length - 1];
  // Every point in the same place (a leg that goes nowhere): any of them will do.
  if (total === 0) return [points[0][0], points[0][1]];

  const target = total / 2;
  let i = 1;
  while (i < cumulative.length - 1 && cumulative[i] < target) i += 1;

  const span = cumulative[i] - cumulative[i - 1];
  const t = span === 0 ? 0 : (target - cumulative[i - 1]) / span;
  return [
    points[i - 1][0] + (points[i][0] - points[i - 1][0]) * t,
    points[i - 1][1] + (points[i][1] - points[i - 1][1]) * t,
  ];
}

export function formatDistance(km: number): string {
  const miles = km * 0.621371;
  return miles >= 100 ? `${Math.round(miles)} miles` : `${Math.round(miles * 10) / 10} miles`;
}

function sortChronologically(entries: JourneyEntry[]): JourneyEntry[] {
  return [...entries].sort((a, b) =>
    a.entry_date === b.entry_date
      ? a.created_at.localeCompare(b.created_at)
      : a.entry_date.localeCompare(b.entry_date),
  );
}

/**
 * The leg that ARRIVES at the given entry: from the most recent earlier
 * entry (with coordinates) to this one, when they're far enough apart.
 * The first located entry's leg starts at `origin` (home) when given.
 */
export function journeyToEntry(
  entries: JourneyEntry[],
  entryId: string,
  origin?: JourneyOrigin | null,
): JourneyLeg | null {
  const ordered = sortChronologically(entries).filter(
    (e) => e.latitude !== null && e.longitude !== null,
  );
  const index = ordered.findIndex((e) => e.id === entryId);
  if (index === -1) return null;
  if (index === 0 && !origin) return null;

  const from: JourneyStop =
    index === 0
      ? origin!
      : {
          name: ordered[index - 1].location ?? "Last stop",
          latitude: ordered[index - 1].latitude!,
          longitude: ordered[index - 1].longitude!,
        };
  const to = ordered[index];
  const km = distanceKm(from, {
    latitude: to.latitude!,
    longitude: to.longitude!,
  });
  if (km < MIN_LEG_KM) return null;

  const routePoints =
    Array.isArray(to.route_geometry) && to.route_geometry.length >= 2
      ? to.route_geometry
      : null;

  return {
    from,
    to: {
      name: to.location ?? "Here",
      latitude: to.latitude!,
      longitude: to.longitude!,
    },
    mode: to.travel_mode,
    distanceKm: km,
    routePoints,
    roadKm: routePoints ? (to.route_km ?? null) : null,
  };
}
