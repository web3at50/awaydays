import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getHomeOrigin } from "@/lib/settings";
import { TravelLegForm } from "@/components/TravelLegForm";

export default async function NewTravelLegPage({
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

  // Where this leg will set off from: the latest located entry, or home
  const { data: latest } = await supabase
    .from("entries")
    .select("location")
    .eq("adventure_id", adventure.id)
    .is("deleted_at", null)
    .not("latitude", "is", null)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const fromName =
    latest?.location ?? (await getHomeOrigin(supabase))?.name ?? null;

  return (
    <div className="max-w-xl">
      <p className="text-sm text-stone-500 mb-1">{adventure.title}</p>
      <h1 className="text-2xl font-semibold tracking-tight mb-6">
        Add travel leg
      </h1>
      <TravelLegForm
        adventureId={adventure.id}
        adventureSlug={adventure.slug}
        defaultDate={defaultDate}
        fromName={fromName}
      />
      <p className="text-sm text-stone-500 mt-4">
        One leg per hop — home to King&apos;s Cross, King&apos;s Cross to Edinburgh.
        Photos from the journey can be added to the leg afterwards.
      </p>
    </div>
  );
}
