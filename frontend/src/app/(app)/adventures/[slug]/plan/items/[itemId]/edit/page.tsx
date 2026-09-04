import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { deleteItineraryItem } from "@/lib/plan-actions";
import type { Adventure, ItineraryDocument, ItineraryItem } from "@/lib/types";
import { DeleteButton } from "@/components/DeleteButton";
import { ItineraryItemForm } from "@/components/ItineraryItemForm";
import { PlanDocuments } from "@/components/PlanDocuments";

export default async function EditItineraryItemPage({
  params,
}: {
  params: Promise<{ slug: string; itemId: string }>;
}) {
  const { slug, itemId } = await params;
  const supabase = await createClient();

  const { data: adventure } = await supabase
    .from("adventures")
    .select("*")
    .eq("slug", slug)
    .is("deleted_at", null)
    .single<Adventure>();
  if (!adventure) notFound();

  const { data: item } = await supabase
    .from("itinerary_items")
    .select("*")
    .eq("id", itemId)
    .eq("adventure_id", adventure.id)
    .is("deleted_at", null)
    .single<ItineraryItem>();
  if (!item) notFound();

  const { data: documentRows } = await supabase
    .from("itinerary_documents")
    .select("*")
    .eq("itinerary_item_id", item.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  const documents = (documentRows ?? []) as ItineraryDocument[];

  return (
    <div>
      <Link
        href={`/adventures/${adventure.slug}/plan`}
        className="text-sm text-amber-800 hover:underline"
      >
        ← Plans and bookings
      </Link>
      <h1 className="mt-2 mb-4 text-2xl font-semibold tracking-tight">
        Edit booking
      </h1>
      <ItineraryItemForm
        adventureId={adventure.id}
        adventureSlug={adventure.slug}
        item={item}
      />
      <PlanDocuments
        itemId={item.id}
        adventureSlug={adventure.slug}
        documents={documents}
      />
      <div className="mt-4">
        <DeleteButton
          action={deleteItineraryItem.bind(null, item.id, adventure.slug)}
          label="Remove this booking"
          confirmText={`Remove "${item.title}" from the itinerary?`}
        />
      </div>
    </div>
  );
}
