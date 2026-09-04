// One-off backfill: fetch real road routes (OSRM) for existing car and bus legs.
// Safe to rerun — recomputes every adventure's routes the same way the app
// does on save. Respects the public server with a pause between requests.
//
// Usage: npm run routes:backfill
import { adminClient, geoUserAgent, loadEnv } from "./lib.mjs";

loadEnv();
const supabase = adminClient();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const MIN_LEG_KM = 5;

function haversineKm(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

async function fetchDrivingRoute(from, to) {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${from.longitude},${from.latitude};${to.longitude},${to.latitude}` +
    `?overview=full&geometries=geojson`;
  const response = await fetch(url, {
    headers: { "User-Agent": geoUserAgent() },
  });
  if (!response.ok) return null;
  const data = await response.json();
  const route = data.routes?.[0];
  if (data.code !== "Ok" || !route?.geometry?.coordinates?.length) return null;
  let points = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
  const MAX_POINTS = 400;
  if (points.length > MAX_POINTS) {
    const step = (points.length - 1) / (MAX_POINTS - 1);
    points = Array.from({ length: MAX_POINTS }, (_, i) => points[Math.round(i * step)]);
  }
  const km = (route.distance ?? 0) / 1000;
  return points.length >= 2 && km > 0 ? { points, km } : null;
}

const { data: adventures, error } = await supabase
  .from("adventures")
  .select("id, title")
  .is("deleted_at", null);
if (error) {
  console.error(`adventures query failed: ${error.message}`);
  process.exit(1);
}

// Journeys start from home (family settings), matching the app
const { data: familySettings } = await supabase
  .from("family_settings")
  .select("home_location, home_latitude, home_longitude")
  .eq("id", true)
  .maybeSingle();
const home =
  familySettings?.home_latitude != null && familySettings?.home_longitude != null
    ? {
        location: familySettings.home_location ?? "Home",
        latitude: familySettings.home_latitude,
        longitude: familySettings.home_longitude,
      }
    : null;

for (const adventure of adventures) {
  const { data: entries } = await supabase
    .from("entries")
    .select("id, title, entry_date, created_at, location, latitude, longitude, travel_mode, route_km")
    .eq("adventure_id", adventure.id)
    .is("deleted_at", null);

  const ordered = (entries ?? [])
    .filter((e) => e.latitude !== null && e.longitude !== null)
    .sort((a, b) =>
      a.entry_date === b.entry_date
        ? a.created_at.localeCompare(b.created_at)
        : a.entry_date.localeCompare(b.entry_date),
    );

  for (let i = 0; i < ordered.length; i++) {
    const entry = ordered[i];
    const prev = i > 0 ? ordered[i - 1] : home;
    const km = prev ? haversineKm(prev, entry) : 0;
    const wantsRoute =
      prev &&
      km >= MIN_LEG_KM &&
      (entry.travel_mode === "car" || entry.travel_mode === "bus");

    if (!wantsRoute) {
      if (entry.route_km !== null) {
        await supabase
          .from("entries")
          .update({ route_geometry: null, route_km: null })
          .eq("id", entry.id);
        console.log(`${adventure.title} / ${entry.title}: cleared stale route`);
      }
      continue;
    }

    const route = await fetchDrivingRoute(prev, entry);
    if (route) {
      await supabase
        .from("entries")
        .update({ route_geometry: route.points, route_km: route.km })
        .eq("id", entry.id);
      console.log(
        `${adventure.title} / ${entry.title}: ${prev.location} → ${entry.location}, ${Math.round(route.km * 0.621371)} road miles (${route.points.length} points)`,
      );
    } else {
      console.log(`${adventure.title} / ${entry.title}: no route found, arc stays`);
    }
    await sleep(1100);
  }
}
console.log("done");
