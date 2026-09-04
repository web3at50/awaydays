// One-off backfill: geocode adventures/entries with a Location, and trip
// ideas with an address, that have no coordinates yet. Safe to rerun — it only touches rows missing coords.
// Respects Nominatim's 1 request/second policy.
//
// Usage: node scripts/backfill-geocode.mjs
import { adminClient, geoUserAgent, loadEnv } from "./lib.mjs";

loadEnv();
const supabase = adminClient();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function geocode(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: { "User-Agent": geoUserAgent() },
  });
  if (!response.ok) return null;
  const results = await response.json();
  const hit = results?.[0];
  if (!hit) return null;
  const latitude = Number(hit.lat);
  const longitude = Number(hit.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

async function backfill(table, column = "location") {
  const { data: rows, error } = await supabase
    .from(table)
    .select(`id, ${column}`)
    .not(column, "is", null)
    .is("latitude", null)
    .is("deleted_at", null);
  if (error) {
    console.error(`${table}: query failed: ${error.message}`);
    process.exit(1);
  }

  for (const row of rows) {
    if (!row[column].trim()) continue;
    const coords = await geocode(row[column]);
    if (coords) {
      const { error: updateError } = await supabase
        .from(table)
        .update(coords)
        .eq("id", row.id);
      if (updateError) {
        console.error(`${table} ${row.id}: update failed: ${updateError.message}`);
      } else {
        console.log(
          `${table} ${row.id}: "${row[column]}" → ${coords.latitude}, ${coords.longitude}`,
        );
      }
    } else {
      console.log(`${table} ${row.id}: "${row[column]}" → no result, left blank`);
    }
    await sleep(1100);
  }
  console.log(`${table}: done (${rows.length} row${rows.length === 1 ? "" : "s"} checked)`);
}

await backfill("adventures");
await backfill("entries");
await backfill("trip_ideas", "address");
