import { format, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import {
  permanentlyDeleteAdventure,
  permanentlyDeleteEntry,
  permanentlyDeleteMedia,
  restoreAdventure,
  restoreEntry,
  restoreMedia,
} from "@/lib/bin-actions";
import { BinItemActions } from "@/components/BinItemActions";

function deletedOn(
  timestamp: string,
  deleter?: { display_name: string } | null,
): string {
  const when = `Deleted ${format(parseISO(timestamp), "d MMM yyyy")}`;
  return deleter ? `${when} by ${deleter.display_name}` : when;
}

interface DeletedAdventure {
  id: string;
  title: string;
  deleted_at: string;
  deleter: { display_name: string } | null;
}

interface DeletedEntry {
  id: string;
  title: string;
  entry_date: string;
  deleted_at: string;
  adventures: { title: string };
  deleter: { display_name: string } | null;
}

interface DeletedMedia {
  id: string;
  caption: string | null;
  original_filename: string | null;
  deleted_at: string;
  adventures: { title: string };
  entries: { title: string };
  deleter: { display_name: string } | null;
}

export default async function BinPage() {
  const supabase = await createClient();
  // Local JWT verification, matching proxy.ts — pages never call the Auth
  // server. Server actions still use auth.getUser() per mutation.
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub ?? null;
  const { data: profile } = userId
    ? await supabase.from("profiles").select("role").eq("id", userId).single()
    : { data: null };

  if (profile?.role !== "admin") {
    return (
      <div className="text-center bg-white rounded-2xl border border-stone-200 p-10">
        <p className="font-medium mb-1">Adults only</p>
        <p className="text-stone-500 text-sm">
          Only adult accounts can open the recycle bin. Ask a grown-up to
          restore anything you deleted by accident.
        </p>
      </div>
    );
  }

  const { data: adventures } = await supabase
    .from("adventures")
    .select(
      "id, title, deleted_at, deleter:profiles!adventures_deleted_by_fkey(display_name)",
    )
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false })
    .overrideTypes<DeletedAdventure[]>();

  const { data: entries } = await supabase
    .from("entries")
    .select(
      "id, title, entry_date, deleted_at, adventures!inner(title, deleted_at), deleter:profiles!entries_deleted_by_fkey(display_name)",
    )
    .not("deleted_at", "is", null)
    .is("adventures.deleted_at", null)
    .order("deleted_at", { ascending: false })
    .overrideTypes<DeletedEntry[]>();

  const { data: media } = await supabase
    .from("media")
    .select(
      // media↔adventures has two FK paths (adventure_id + cover_media_id),
      // so the join must name the one it means or PostgREST rejects it
      "id, caption, original_filename, deleted_at, adventures!media_adventure_id_fkey!inner(title, deleted_at), entries!inner(title, deleted_at), deleter:profiles!media_deleted_by_fkey(display_name)",
    )
    .not("deleted_at", "is", null)
    .is("adventures.deleted_at", null)
    .is("entries.deleted_at", null)
    .order("deleted_at", { ascending: false })
    .overrideTypes<DeletedMedia[]>();

  const isEmpty =
    (adventures?.length ?? 0) === 0 &&
    (entries?.length ?? 0) === 0 &&
    (media?.length ?? 0) === 0;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight mb-2">Recycle bin</h1>
      <p className="text-stone-500 text-sm mb-6">
        Deleted things wait here and can be restored. &ldquo;Delete
        forever&rdquo; removes the records and photo files permanently.
      </p>

      {isEmpty && (
        <div className="text-center bg-white rounded-2xl border border-stone-200 p-10">
          <p className="text-4xl mb-3" aria-hidden>
            🗑️
          </p>
          <p className="text-stone-500 text-sm">The bin is empty.</p>
        </div>
      )}

      {(adventures?.length ?? 0) > 0 && (
        <section className="mb-8">
          <h2 className="font-semibold text-lg mb-3">Trips</h2>
          <ul className="space-y-3">
            {adventures!.map((adventure) => (
              <li
                key={adventure.id}
                className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 flex items-center justify-between gap-3 flex-wrap"
              >
                <div className="min-w-0">
                  <p className="font-medium">{adventure.title}</p>
                  <p className="text-xs text-stone-500">
                    {deletedOn(adventure.deleted_at, adventure.deleter)} ·
                    includes all its entries and photos
                  </p>
                </div>
                <BinItemActions
                  restore={restoreAdventure.bind(null, adventure.id)}
                  destroy={permanentlyDeleteAdventure.bind(null, adventure.id)}
                  confirmText={`Permanently delete the trip "${adventure.title}" with all its entries and photos? This cannot be undone.`}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {(entries?.length ?? 0) > 0 && (
        <section className="mb-8">
          <h2 className="font-semibold text-lg mb-3">Entries</h2>
          <ul className="space-y-3">
            {entries!.map((entry) => (
              <li
                key={entry.id}
                className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 flex items-center justify-between gap-3 flex-wrap"
              >
                <div className="min-w-0">
                  <p className="font-medium">{entry.title}</p>
                  <p className="text-xs text-stone-500">
                    In {entry.adventures.title} ·{" "}
                    {deletedOn(entry.deleted_at, entry.deleter)}
                  </p>
                </div>
                <BinItemActions
                  restore={restoreEntry.bind(null, entry.id)}
                  destroy={permanentlyDeleteEntry.bind(null, entry.id)}
                  confirmText={`Permanently delete the entry "${entry.title}" and its photos? This cannot be undone.`}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {(media?.length ?? 0) > 0 && (
        <section className="mb-8">
          <h2 className="font-semibold text-lg mb-3">Photos</h2>
          <ul className="space-y-3">
            {media!.map((photo) => (
              <li
                key={photo.id}
                className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 flex items-center justify-between gap-3 flex-wrap"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {photo.caption || photo.original_filename || "Photo"}
                  </p>
                  <p className="text-xs text-stone-500">
                    In {photo.adventures.title} / {photo.entries.title} ·{" "}
                    {deletedOn(photo.deleted_at, photo.deleter)}
                  </p>
                </div>
                <BinItemActions
                  restore={restoreMedia.bind(null, photo.id)}
                  destroy={permanentlyDeleteMedia.bind(null, photo.id)}
                  confirmText="Permanently delete this photo? This cannot be undone."
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
