import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createEntry } from "@/lib/actions";
import { EntryForm } from "@/components/EntryForm";

export default async function NewEntryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: adventure } = await supabase
    .from("adventures")
    .select("id, slug, title, start_date, end_date")
    .eq("slug", slug)
    .is("deleted_at", null)
    .single();
  if (!adventure) notFound();

  // Default to today while the family is mid-adventure, else the start date
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
  }).format(new Date());
  const defaultDate =
    today >= adventure.start_date && today <= adventure.end_date
      ? today
      : adventure.start_date;

  return (
    <div className="max-w-xl">
      <p className="text-sm text-stone-500 mb-1">{adventure.title}</p>
      <h1 className="text-2xl font-semibold tracking-tight mb-6">
        Add diary entry
      </h1>
      <EntryForm
        action={createEntry}
        adventureId={adventure.id}
        adventureSlug={adventure.slug}
        defaultDate={defaultDate}
        submitLabel="Save entry"
      />
      <p className="text-sm text-stone-500 mt-4">
        Save the entry first — then you can add photos to it.
      </p>
    </div>
  );
}
