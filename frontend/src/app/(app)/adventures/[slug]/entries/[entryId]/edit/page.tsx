import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { deleteEntry, updateEntry } from "@/lib/actions";
import { EntryForm } from "@/components/EntryForm";
import { DeleteButton } from "@/components/DeleteButton";
import type { Entry } from "@/lib/types";

export default async function EditEntryPage({
  params,
}: {
  params: Promise<{ slug: string; entryId: string }>;
}) {
  const { slug, entryId } = await params;
  const supabase = await createClient();

  const { data: adventure } = await supabase
    .from("adventures")
    .select("id, slug, title, start_date")
    .eq("slug", slug)
    .is("deleted_at", null)
    .single();
  if (!adventure) notFound();

  const { data: entry } = await supabase
    .from("entries")
    .select("*")
    .eq("id", entryId)
    .eq("adventure_id", adventure.id)
    .is("deleted_at", null)
    .single<Entry>();
  if (!entry) notFound();

  return (
    <div className="max-w-xl">
      <p className="text-sm text-stone-500 mb-1">{adventure.title}</p>
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Edit entry</h1>

      <EntryForm
        action={updateEntry.bind(null, entry.id)}
        adventureId={adventure.id}
        adventureSlug={adventure.slug}
        defaultDate={adventure.start_date}
        initial={{
          entry_date: entry.entry_date,
          title: entry.title,
          body: entry.body,
          itinerary: entry.itinerary,
          location: entry.location,
          travel_mode: entry.travel_mode,
        }}
        submitLabel="Save changes"
      />

      <div className="mt-8">
        <DeleteButton
          action={deleteEntry.bind(null, entry.id)}
          label="Delete this entry"
          confirmText={`Delete "${entry.title}" and its photos? It will be moved to the recycle bin and can be restored.`}
        />
      </div>
    </div>
  );
}
