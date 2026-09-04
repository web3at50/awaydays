import type { JourneyStop } from "@/lib/journeys";
import type { MapPin } from "@/lib/types";

// Pure geometry shared by the Leaflet and Google Maps renderers. Keeping it
// here means the two implementations cannot drift apart on how pins spread,
// arcs curve or the vehicle paces itself.

/**
 * Nudge pins that share exact coordinates so none hide behind another
 * (e.g. several days all geocoded to the same village).
 */
export function spreadDuplicates(pins: MapPin[]): MapPin[] {
  const seen = new Map<string, number>();
  return pins.map((pin) => {
    const key = `${pin.latitude},${pin.longitude}`;
    const count = seen.get(key) ?? 0;
    seen.set(key, count + 1);
    if (count === 0) return pin;
    const angle = (count * 2 * Math.PI) / 8;
    return {
      ...pin,
      latitude: pin.latitude + 0.0004 * Math.sin(angle),
      longitude: pin.longitude + 0.0004 * Math.cos(angle),
    };
  });
}

/**
 * A gently curved arc between two stops — the fallback when we don't have
 * the real road route (trains, ferries, planes, or routing misses).
 */
export function arcPoints(leg: {
  from: JourneyStop;
  to: JourneyStop;
}): [number, number][] {
  const from: [number, number] = [leg.from.latitude, leg.from.longitude];
  const to: [number, number] = [leg.to.latitude, leg.to.longitude];
  const mid: [number, number] = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
  // Offset the midpoint perpendicular to the line by ~15% of its length
  const dx = to[1] - from[1];
  const dy = to[0] - from[0];
  const control: [number, number] = [mid[0] + dx * 0.15, mid[1] - dy * 0.15];

  const points: [number, number][] = [];
  for (let i = 0; i <= 64; i++) {
    const t = i / 64;
    const a = (1 - t) ** 2;
    const b = 2 * (1 - t) * t;
    const c = t ** 2;
    points.push([
      a * from[0] + b * control[0] + c * to[0],
      a * from[1] + b * control[1] + c * to[1],
    ]);
  }
  return points;
}

export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

/**
 * Road geometry has dense points in towns and sparse ones on motorways;
 * resample to points evenly spaced by distance so the animated vehicle moves
 * at a steady pace instead of crawling then teleporting.
 */
export function resampleEvenly(
  points: [number, number][],
  count: number,
): [number, number][] {
  const step = (a: [number, number], b: [number, number]) =>
    Math.hypot(b[0] - a[0], (b[1] - a[1]) * Math.cos((a[0] * Math.PI) / 180));
  const cumulative = [0];
  for (let i = 1; i < points.length; i++) {
    cumulative.push(cumulative[i - 1] + step(points[i - 1], points[i]));
  }
  const total = cumulative[cumulative.length - 1];
  if (total === 0) return points;

  const result: [number, number][] = [];
  let seg = 0;
  for (let i = 0; i <= count; i++) {
    const target = (i / count) * total;
    while (seg < points.length - 2 && cumulative[seg + 1] < target) seg++;
    const span = cumulative[seg + 1] - cumulative[seg];
    const t = span === 0 ? 0 : (target - cumulative[seg]) / span;
    result.push([
      points[seg][0] + (points[seg + 1][0] - points[seg][0]) * t,
      points[seg][1] + (points[seg + 1][1] - points[seg][1]) * t,
    ]);
  }
  return result;
}

/**
 * The bounds enclosing every given point, expanded by `ratio` on each side —
 * the Google Maps equivalent of Leaflet's `bounds.pad(ratio)`. A minimum
 * span stops a single-pin map from zooming in to street level.
 */
export function paddedBounds(
  points: [number, number][],
  ratio: number,
): google.maps.LatLngBoundsLiteral {
  let north = -90;
  let south = 90;
  let east = -180;
  let west = 180;
  for (const [lat, lng] of points) {
    if (lat > north) north = lat;
    if (lat < south) south = lat;
    if (lng > east) east = lng;
    if (lng < west) west = lng;
  }
  const MIN_SPAN = 0.005;
  const latPad = Math.max(((north - south) * ratio), (MIN_SPAN - (north - south)) / 2, 0);
  const lngPad = Math.max(((east - west) * ratio), (MIN_SPAN - (east - west)) / 2, 0);
  return {
    north: north + latPad,
    south: south - latPad,
    east: east + lngPad,
    west: west - lngPad,
  };
}
