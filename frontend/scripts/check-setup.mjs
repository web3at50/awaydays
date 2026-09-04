// Setup check for a fresh installation: confirms the environment, the
// schema, the storage buckets and the first admin without anyone having to
// open the Supabase dashboard. Safe to run at any time; it only reads.
//
// Usage (from frontend/):
//   node scripts/check-setup.mjs
import { adminClient, loadEnv } from "./lib.mjs";

loadEnv();

let failures = 0;
const ok = (msg) => console.log(`✅ ${msg}`);
const bad = (msg) => {
  failures += 1;
  console.log(`❌ ${msg}`);
};
const warn = (msg) => console.log(`⚠️  ${msg}`);

// 1. Environment
for (const name of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
]) {
  if (process.env[name]?.trim()) ok(`${name} is set`);
  else bad(`${name} is missing from .env.local`);
}
try {
  // Say which project this .env.local points at, so nobody runs the
  // scripts against the wrong one by accident.
  const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").host;
  console.log(`ℹ️  Supabase project: ${host}`);
} catch {
  bad("NEXT_PUBLIC_SUPABASE_URL is not a valid URL");
}
if (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.startsWith("sb_publishable_")) {
  ok("publishable key uses the current sb_publishable_ format");
} else if (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
  warn("publishable key is not sb_publishable_… — use the newer key format, not the legacy anon JWT");
}
if (process.env.GEO_CONTACT_EMAIL?.trim()) ok("GEO_CONTACT_EMAIL is set (maps will geocode)");
else warn("GEO_CONTACT_EMAIL is not set — entries will get no map pins until it is");
for (const [name, feature] of [
  ["NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "Google Maps (Leaflet fallback otherwise)"],
  ["AI_GATEWAY_API_KEY", "research search on the plan page"],
  ["TRIPADVISOR_API_KEY", "Tripadvisor ratings"],
]) {
  console.log(`ℹ️  ${name} ${process.env[name]?.trim() ? "set" : "not set"} — ${feature}`);
}
if (failures) {
  console.log("\nFix the environment first, then run this again.");
  process.exit(1);
}

const supabase = adminClient();

// 2. Schema
const tables = [
  "profiles",
  "adventures",
  "entries",
  "media",
  "upload_sessions",
  "share_links",
  "reactions",
  "family_settings",
  "itinerary_items",
  "trip_ideas",
  "itinerary_documents",
];
for (const table of tables) {
  const { error } = await supabase.from(table).select("*", { count: "exact", head: true });
  if (error) bad(`table ${table}: ${error.message}`);
}
const missing = failures;
if (!missing) ok(`all ${tables.length} tables present`);

const { data: settings } = await supabase
  .from("family_settings")
  .select("home_location")
  .eq("id", true)
  .maybeSingle();
if (settings) {
  ok(
    settings.home_location
      ? `home location set: ${settings.home_location}`
      : "settings row present (home location not set yet — do that in Settings)",
  );
} else {
  bad("family_settings row is missing — the schema migration was not applied in full");
}

// 3. Storage
const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
if (bucketError) {
  bad(`could not list storage buckets: ${bucketError.message}`);
} else {
  for (const name of ["family-originals", "family-derived"]) {
    const bucket = buckets?.find((b) => b.name === name);
    if (!bucket) bad(`bucket ${name} is missing`);
    else if (bucket.public) bad(`bucket ${name} is public — it must be private`);
    else ok(`bucket ${name} exists and is private`);
  }
}

// 4. People
const { data: profiles, error: profileError } = await supabase
  .from("profiles")
  .select("email, display_name, role")
  .order("created_at");
if (profileError) {
  bad(`could not read profiles: ${profileError.message}`);
} else if (!profiles?.length) {
  bad("no profiles yet — create the first admin: node scripts/create-user.mjs --email … --name … --role admin");
} else if (!profiles.some((p) => p.role === "admin")) {
  bad("profiles exist but none is an admin");
} else {
  ok(
    `${profiles.length} family member${profiles.length === 1 ? "" : "s"}: ` +
      profiles.map((p) => `${p.display_name} (${p.role})`).join(", "),
  );
}

console.log(failures ? `\n${failures} problem${failures === 1 ? "" : "s"} to fix.` : "\nAll good — run npm run dev and sign in.");
process.exit(failures ? 1 : 0);
