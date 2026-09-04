"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshAdventureRoutes } from "@/lib/route";

// Restore and permanent deletion are adult-admin operations.
async function requireAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return profile?.role === "admin";
}

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/bin");
}

export async function restoreAdventure(id: string): Promise<void> {
  if (!(await requireAdmin())) return;
  const supabase = await createClient();
  await supabase
    .from("adventures")
    .update({ deleted_at: null, deleted_by: null })
    .eq("id", id);
  revalidateAll();
}

export async function restoreEntry(id: string): Promise<void> {
  if (!(await requireAdmin())) return;
  const supabase = await createClient();
  const { data: entry } = await supabase
    .from("entries")
    .update({ deleted_at: null, deleted_by: null })
    .eq("id", id)
    .select("adventure_id")
    .single();
  if (entry) await refreshAdventureRoutes(supabase, entry.adventure_id);
  revalidateAll();
}

export async function restoreMedia(id: string): Promise<void> {
  if (!(await requireAdmin())) return;
  const supabase = await createClient();
  await supabase
    .from("media")
    .update({ deleted_at: null, deleted_by: null })
    .eq("id", id);
  revalidateAll();
}

interface MediaPaths {
  original_path: string;
  thumbnail_path: string | null;
  display_path: string | null;
  large_path: string | null;
  web_video_path: string | null;
}

async function removeStorageObjects(media: MediaPaths[]): Promise<void> {
  const admin = createAdminClient();
  const originals = media.map((m) => m.original_path).filter(Boolean);
  const derived = media
    .flatMap((m) => [m.thumbnail_path, m.display_path, m.large_path, m.web_video_path])
    .filter((p): p is string => Boolean(p));
  if (originals.length) {
    await admin.storage.from("family-originals").remove(originals);
  }
  if (derived.length) {
    await admin.storage.from("family-derived").remove(derived);
  }
}

export async function permanentlyDeleteAdventure(id: string): Promise<void> {
  if (!(await requireAdmin())) return;
  const admin = createAdminClient();
  const { data: media } = await admin
    .from("media")
    .select("original_path, thumbnail_path, display_path, large_path, web_video_path")
    .eq("adventure_id", id);
  await removeStorageObjects(media ?? []);
  // Booking PDFs live in family-originals too; the cascade deletes their
  // rows, so the objects must go here or the storage audit flags orphans
  const { data: docs } = await admin
    .from("itinerary_documents")
    .select("original_path")
    .eq("adventure_id", id);
  if (docs?.length) {
    await admin.storage
      .from("family-originals")
      .remove(docs.map((d) => d.original_path));
  }
  await admin.from("adventures").delete().eq("id", id);
  revalidateAll();
}

export async function permanentlyDeleteEntry(id: string): Promise<void> {
  if (!(await requireAdmin())) return;
  const admin = createAdminClient();
  const { data: media } = await admin
    .from("media")
    .select("original_path, thumbnail_path, display_path, large_path, web_video_path")
    .eq("entry_id", id);
  await removeStorageObjects(media ?? []);
  await admin.from("entries").delete().eq("id", id);
  revalidateAll();
}

export async function permanentlyDeleteMedia(id: string): Promise<void> {
  if (!(await requireAdmin())) return;
  const admin = createAdminClient();
  const { data: media } = await admin
    .from("media")
    .select("original_path, thumbnail_path, display_path, large_path, web_video_path")
    .eq("id", id);
  await removeStorageObjects(media ?? []);
  await admin.from("media").delete().eq("id", id);
  revalidateAll();
}
