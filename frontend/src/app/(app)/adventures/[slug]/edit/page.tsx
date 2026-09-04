import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { deleteAdventure, updateAdventure } from "@/lib/actions";
import { AdventureForm } from "@/components/AdventureForm";
import { DeleteButton } from "@/components/DeleteButton";
import type { Adventure } from "@/lib/types";

export default async function EditAdventurePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: adventure } = await supabase
    .from("adventures")
    .select("*")
    .eq("slug", slug)
    .is("deleted_at", null)
    .single<Adventure>();
  if (!adventure) notFound();

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">
        Edit trip
      </h1>

      <AdventureForm
        action={updateAdventure.bind(null, adventure.id)}
        initial={{
          title: adventure.title,
          type: adventure.type,
          start_date: adventure.start_date,
          end_date: adventure.end_date,
          location: adventure.location,
          summary: adventure.summary,
        }}
        submitLabel="Save changes"
      />

      <div className="mt-8">
        <DeleteButton
          action={deleteAdventure.bind(null, adventure.id)}
          label="Delete this trip"
          confirmText={`Delete "${adventure.title}" and all its entries and photos? The trip will be moved to the recycle bin and can be restored.`}
        />
      </div>
    </div>
  );
}
