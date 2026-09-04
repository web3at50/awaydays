// Bulk photo import from a local folder (e.g. a synced Dropbox holiday folder).
//
// Creates one adventure, one entry per calendar day photos were taken, and
// uploads each photo to family-originals under the same object-key convention
// as the in-app upload flow, so imported photos are indistinguishable from
// app uploads. Dates come from EXIF (DateTimeOriginal/CreateDate) with a
// filename fallback for phone-camera and WhatsApp names. Videos and any
// files named in the skip list are left out.
//
// After a successful import, run:
//   npm run photos:process -- --adventure <id>
//
// Usage:
//   node scripts/import-folder.mjs --folder "<path>" --title "Paris" \
//     --type holiday --location "Paris, France" --user "Alex" \
//     [--skip skip.json] [--dry-run]
//
// --user is the display name of the family member the import is attributed
// to (matched against profiles.display_name, prefix match).
//
// skip.json format: { "skip": ["file1.jpg", ...] }  (from a contact sheet)
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import exifr from "exifr";
import { adminClient, geoUserAgent, loadEnv } from "./lib.mjs";

loadEnv();
const supabase = adminClient();

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : fallback;
}
const folder = arg("folder");
const title = arg("title");
const type = arg("type", "holiday");
const location = arg("location");
const userName = arg("user");
const skipFile = arg("skip");
const dryRun = process.argv.includes("--dry-run");

if (!folder || !title || !userName) {
  console.log('Usage: node scripts/import-folder.mjs --folder "<path>" --title "<title>" [--type holiday|day_trip|event] [--location "..."] --user "<display name of the importing family member>" [--skip skip.json] [--dry-run]');
  process.exit(1);
}

const skip = new Set(
  skipFile ? JSON.parse(await readFile(skipFile, "utf8")).skip : [],
);

// Same fallback patterns as the contact-sheet generator.
function filenameDate(name) {
  let m = name.match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  m = name.match(/^(?:IMG|VID)-(\d{4})(\d{2})(\d{2})-WA(\d+)/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], 0, 0, Math.min(+m[4], 59));
  return null;
}

const localDay = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// ---------------------------------------------------------------------------
// Scan the folder
// ---------------------------------------------------------------------------
const allFiles = await readdir(folder);
const videos = allFiles.filter((f) => /\.(mp4|mov)$/i.test(f));
const jpegs = allFiles.filter((f) => /\.jpe?g$/i.test(f));
const skipped = jpegs.filter((f) => skip.has(f));
const keepers = jpegs.filter((f) => !skip.has(f));

console.log(`${jpegs.length} photos in folder, ${skipped.length} skipped by list, ${keepers.length} to import.`);
if (videos.length) console.log(`${videos.length} video(s) NOT imported (video support pending): ${videos.join(", ")}`);

const photos = [];
for (const file of keepers) {
  const full = path.join(folder, file);
  let taken = null;
  try {
    const exif = await exifr.parse(full, ["DateTimeOriginal", "CreateDate"]);
    taken = exif?.DateTimeOriginal ?? exif?.CreateDate ?? null;
  } catch {
    // fall through to filename
  }
  if (!(taken instanceof Date) || isNaN(taken)) taken = filenameDate(file);
  if (!taken) {
    console.error(`Cannot date ${file} (no EXIF, unrecognised filename) — aborting; remove it or add it to the skip list.`);
    process.exit(1);
  }
  photos.push({ file, full, taken });
}
photos.sort((a, b) => a.taken - b.taken || a.file.localeCompare(b.file));

const startDate = localDay(photos[0].taken);
const endDate = localDay(photos[photos.length - 1].taken);

// Group into one entry per calendar day
const days = new Map();
for (const p of photos) {
  const key = localDay(p.taken);
  if (!days.has(key)) days.set(key, []);
  days.get(key).push(p);
}

console.log(`\nPlan: adventure "${title}" (${type}), ${startDate} → ${endDate}, ${days.size} entries:`);
for (const [day, list] of days) {
  console.log(`  ${day}: ${list.length} photo(s)`);
}

// ---------------------------------------------------------------------------
// Resolve uploader + slug
// ---------------------------------------------------------------------------
const { data: profile, error: profileError } = await supabase
  .from("profiles")
  .select("id, display_name")
  .ilike("display_name", `${userName}%`)
  .single();
if (profileError || !profile) {
  console.error(`Could not find profile matching "${userName}": ${profileError?.message ?? "no match"}`);
  process.exit(1);
}

const baseSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
let slug = baseSlug;
const { data: slugClash } = await supabase
  .from("adventures")
  .select("id")
  .eq("slug", slug)
  .is("deleted_at", null)
  .maybeSingle();
if (slugClash) slug = `${baseSlug}-${startDate}`;

console.log(`Uploader: ${profile.display_name}, slug: ${slug}`);

if (dryRun) {
  console.log("\nDry run — nothing written.");
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Create adventure + entries + media
// ---------------------------------------------------------------------------
let coords = null;
if (location) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(location)}`;
    const response = await fetch(url, {
      headers: { "User-Agent": geoUserAgent() },
      signal: AbortSignal.timeout(4000),
    });
    const hit = response.ok ? (await response.json())?.[0] : null;
    if (hit && Number.isFinite(+hit.lat) && Number.isFinite(+hit.lon)) {
      coords = { latitude: +hit.lat, longitude: +hit.lon };
    }
  } catch {
    // best-effort, same as the app
  }
}

const { data: adventure, error: adventureError } = await supabase
  .from("adventures")
  .insert({
    title,
    slug,
    type,
    start_date: startDate,
    end_date: endDate,
    location,
    latitude: coords?.latitude ?? null,
    longitude: coords?.longitude ?? null,
    created_by: profile.id,
  })
  .select("id, slug")
  .single();
if (adventureError) {
  console.error(`Adventure insert failed: ${adventureError.message}`);
  process.exit(1);
}
console.log(`\nAdventure created: ${adventure.id}`);

let uploadedCount = 0;
let firstMediaId = null;

for (const [day, list] of days) {
  const entryDate = new Date(`${day}T12:00:00`);
  const entryTitle = entryDate.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const { data: entry, error: entryError } = await supabase
    .from("entries")
    .insert({
      adventure_id: adventure.id,
      entry_date: day,
      title: entryTitle,
      body: "",
      created_by: profile.id,
      updated_by: profile.id,
    })
    .select("id")
    .single();
  if (entryError) {
    console.error(`Entry insert failed for ${day}: ${entryError.message}`);
    process.exit(1);
  }

  for (let i = 0; i < list.length; i += 1) {
    const p = list[i];
    const mediaId = crypto.randomUUID();
    const objectName = `adventures/${adventure.id}/entries/${entry.id}/${mediaId}/original.jpg`;

    const buffer = await readFile(p.full);
    const meta = await sharp(buffer).metadata();
    const swapped = (meta.orientation ?? 1) >= 5;

    const { error: uploadError } = await supabase.storage
      .from("family-originals")
      .upload(objectName, buffer, { contentType: "image/jpeg" });
    if (uploadError) {
      console.error(`Upload failed for ${p.file}: ${uploadError.message}`);
      process.exit(1);
    }

    const { error: mediaError } = await supabase.from("media").insert({
      id: mediaId,
      adventure_id: adventure.id,
      entry_id: entry.id,
      original_path: objectName,
      original_filename: p.file,
      mime_type: "image/jpeg",
      byte_size: (await stat(p.full)).size,
      width: (swapped ? meta.height : meta.width) ?? null,
      height: (swapped ? meta.width : meta.height) ?? null,
      taken_at: p.taken.toISOString(),
      sort_order: i,
      uploaded_by: profile.id,
    });
    if (mediaError) {
      await supabase.storage.from("family-originals").remove([objectName]);
      console.error(`Media insert failed for ${p.file}: ${mediaError.message}`);
      process.exit(1);
    }

    firstMediaId ??= mediaId;
    uploadedCount += 1;
    process.stdout.write(".");
  }
  console.log(` ${day} done (${list.length})`);
}

// First photo becomes the cover, matching the in-app upload behaviour
if (firstMediaId) {
  await supabase
    .from("adventures")
    .update({ cover_media_id: firstMediaId })
    .eq("id", adventure.id);
}

console.log(`\nImported ${uploadedCount} photos into "${title}" (/adventures/${adventure.slug}).`);
console.log(`Now run: npm run photos:process -- --adventure ${adventure.id}`);
