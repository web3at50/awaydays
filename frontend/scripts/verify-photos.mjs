// Storage/database consistency audit.
// Read-only: reports problems, fixes nothing.
//
// Usage: npm run photos:verify
import { adminClient, loadEnv, walkBucket } from "./lib.mjs";

loadEnv();
const supabase = adminClient();

const { data: mediaRows, error } = await supabase
  .from("media")
  .select(
    "id, original_path, thumbnail_path, display_path, large_path, web_video_path, processing_status, deleted_at",
  );
if (error) {
  console.error("Query failed:", error.message);
  process.exit(1);
}

// Booking PDFs (itinerary documents) share the originals bucket
const { data: documentRows, error: documentError } = await supabase
  .from("itinerary_documents")
  .select("id, original_path, deleted_at");
if (documentError) {
  console.error("Query failed:", documentError.message);
  process.exit(1);
}

const originals = new Set(await walkBucket(supabase, "family-originals"));
const derived = new Set(await walkBucket(supabase, "family-derived"));

const problems = [];

for (const doc of documentRows) {
  if (!originals.has(doc.original_path)) {
    problems.push(
      `document ${doc.id}${doc.deleted_at ? " (removed)" : ""}: file missing from storage: ${doc.original_path}`,
    );
  }
}

for (const media of mediaRows) {
  if (!originals.has(media.original_path)) {
    problems.push(
      `media ${media.id}${media.deleted_at ? " (in bin)" : ""}: original file missing from storage: ${media.original_path}`,
    );
  }
  if (media.processing_status === "ready") {
    for (const key of ["thumbnail_path", "display_path", "large_path", "web_video_path"]) {
      if (media[key] && !derived.has(media[key])) {
        problems.push(`media ${media.id}: derivative missing from storage: ${media[key]}`);
      }
    }
  }
  if (media.processing_status === "processing") {
    problems.push(`media ${media.id}: stuck in 'processing' — rerun photos:process`);
  }
}

const knownOriginals = new Set([
  ...mediaRows.map((m) => m.original_path),
  ...documentRows.map((d) => d.original_path),
]);
const knownDerived = new Set(
  mediaRows.flatMap((m) => [m.thumbnail_path, m.display_path, m.large_path, m.web_video_path]).filter(Boolean),
);
for (const file of originals) {
  if (!knownOriginals.has(file)) {
    problems.push(`orphaned file (no database record): family-originals/${file}`);
  }
}
for (const file of derived) {
  if (!knownDerived.has(file)) {
    problems.push(`orphaned file (no database record): family-derived/${file}`);
  }
}

const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const { data: staleSessions } = await supabase
  .from("upload_sessions")
  .select("id, original_filename, created_at")
  .eq("status", "pending")
  .lt("created_at", dayAgo);
for (const session of staleSessions ?? []) {
  problems.push(
    `upload session ${session.id} (${session.original_filename ?? "?"}) pending since ${session.created_at} — upload probably abandoned`,
  );
}

console.log(
  `Checked ${mediaRows.length} media record(s), ${documentRows.length} document record(s), ${originals.size} original file(s), ${derived.size} derivative file(s).`,
);
if (problems.length === 0) {
  console.log("No problems found — database and storage agree.");
} else {
  console.log(`\n${problems.length} problem(s):`);
  for (const problem of problems) console.log("  - " + problem);
  process.exit(1);
}
