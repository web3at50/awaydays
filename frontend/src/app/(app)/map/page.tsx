import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/dates";
import type { MapPin } from "@/lib/types";
import { MapPanel } from "@/components/MapPanel";

type MapEntryRow = {
  id: string;
  title: string;
  entry_date: string;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  adventure: {
    slug: string;
    title: string;
    latitude: number | null;
    longitude: number | null;
  };
  media: { id: string }[];
};

export default async function MapPage() {
  const supabase = await createClient();

  const { data: entries } = await supabase
    .from("entries")
    .select(
      "id, title, entry_date, location, latitude, longitude, adventure:adventures!inner(slug, title, latitude, longitude), media(id)",
    )
    .is("deleted_at", null)
    .is("adventure.deleted_at", null)
    .is("media.deleted_at", null)
    .order("entry_date", { ascending: true })
    .order("created_at", { ascending: true })
    .order("created_at", { referencedTable: "media", ascending: true })
    .overrideTypes<MapEntryRow[]>();

  const pins: MapPin[] = [];
  for (const entry of entries ?? []) {
    // An entry without its own coordinates borrows the adventure's
    const latitude = entry.latitude ?? entry.adventure.latitude;
    const longitude = entry.longitude ?? entry.adventure.longitude;
    if (latitude === null || longitude === null) continue;
    pins.push({
      id: entry.id,
      latitude,
      longitude,
      title: entry.title,
      subtitle: `${formatDate(entry.entry_date)}${
        entry.location ? ` · ${entry.location}` : ""
      } · ${entry.adventure.title}`,
      href: `/adventures/${entry.adventure.slug}/entries/${entry.id}`,
      thumbUrl: entry.media[0]
        ? `/api/media/${entry.media[0].id}?size=thumb`
        : undefined,
    });
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight mb-1">
        Everywhere we&apos;ve been
      </h1>
      <p className="text-stone-500 text-sm mb-5">
        Every diary entry with a location gets a pin. Tap one to revisit that
        day.
      </p>

      {pins.length === 0 ? (
        <div className="text-center bg-white rounded-2xl border border-stone-200 p-10">
          <p className="text-4xl mb-3" aria-hidden>
            🗺️
          </p>
          <p className="font-medium mb-1">No pins yet</p>
          <p className="text-stone-500 text-sm">
            Add a location to a diary entry and it will appear here.
          </p>
        </div>
      ) : (
        <MapPanel pins={pins} className="h-[70vh]" />
      )}
    </div>
  );
}
