// Shared helpers for the maintenance scripts.
import { createClient } from "@supabase/supabase-js";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function loadEnv() {
  const envPath = path.join(
    path.dirname(path.dirname(fileURLToPath(import.meta.url))),
    ".env.local",
  );
  process.loadEnvFile(envPath);
}

export function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local");
    process.exit(1);
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Nominatim and OSRM require an identifying User-Agent with a real contact
// (GEO_CONTACT_EMAIL in .env.local). The scripts refuse to run without it
// rather than call those services anonymously.
export function geoUserAgent() {
  const email = process.env.GEO_CONTACT_EMAIL?.trim();
  if (!email) {
    console.error(
      "Missing GEO_CONTACT_EMAIL in .env.local — Nominatim and OSRM need a real contact address (see .env.example)",
    );
    process.exit(1);
  }
  return `holidays-diary/1.0 (${email})`;
}

// Recursively lists every file path in a bucket beneath a prefix.
export async function walkBucket(supabase, bucket, prefix = "") {
  const files = [];
  const { data: items, error } = await supabase.storage
    .from(bucket)
    .list(prefix, { limit: 1000 });
  if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
  for (const item of items ?? []) {
    const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id === null) {
      files.push(...(await walkBucket(supabase, bucket, itemPath)));
    } else {
      files.push(itemPath);
    }
  }
  return files;
}
