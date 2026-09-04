// Downloads every photo (originals + derivatives) to a local folder so
// Supabase is never the only copy.
//
// Usage: npm run backup:storage [-- --dest <folder>]
// Default destination: ../backups/storage relative to the repo root.
// Files that already exist locally are skipped, so reruns are incremental.
import { mkdir, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { adminClient, loadEnv, walkBucket } from "./lib.mjs";

loadEnv();
const supabase = adminClient();

const args = process.argv.slice(2);
const destFlag = args.indexOf("--dest");
const repoRoot = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const dest =
  destFlag !== -1 ? path.resolve(args[destFlag + 1]) : path.join(repoRoot, "backups", "storage");

let downloaded = 0;
let skipped = 0;
let failed = 0;

for (const bucket of ["family-originals", "family-derived"]) {
  const files = await walkBucket(supabase, bucket);
  console.log(`${bucket}: ${files.length} file(s)`);
  for (const file of files) {
    const target = path.join(dest, bucket, file);
    try {
      await access(target);
      skipped += 1;
      continue;
    } catch {
      // not downloaded yet
    }
    try {
      const { data: blob, error } = await supabase.storage.from(bucket).download(file);
      if (error) throw new Error(error.message);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, Buffer.from(await blob.arrayBuffer()));
      downloaded += 1;
      console.log(`saved ${bucket}/${file}`);
    } catch (error) {
      failed += 1;
      console.error(`FAILED ${bucket}/${file}: ${error.message}`);
    }
  }
}

console.log(`\nBackup to ${dest}: ${downloaded} downloaded, ${skipped} already present, ${failed} failed.`);
if (failed > 0) process.exit(1);
