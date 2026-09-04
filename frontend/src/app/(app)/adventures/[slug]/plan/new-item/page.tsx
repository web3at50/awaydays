import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Adventure } from "@/lib/types";
import { ItineraryItemForm } from "@/components/ItineraryItemForm";

export default async function NewItineraryItemPage({
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
    <div>
      <Link
        href={`/adventures/${adventure.slug}/plan`}
        className="text-sm text-amber-800 hover:underline"
      >
        ← Plans and bookings
      </Link>
      <h1 className="mt-2 mb-4 text-2xl font-semibold tracking-tight">
        Add a booking
      </h1>
      <ItineraryItemForm
        adventureId={adventure.id}
        adventureSlug={adventure.slug}
      />
    </div>
  );
}
