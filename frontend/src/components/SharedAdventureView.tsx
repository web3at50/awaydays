import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate, formatDateRange } from "@/lib/dates";
import { ADVENTURE_TYPE_LABELS, type AdventureType } from "@/lib/types";
import { EntryCardPhotos } from "@/components/EntryCardPhotos";
import { RichText, type ShareLinkContext } from "@/components/RichText";
import type { SharedAdventure } from "@/lib/share";
import { MapPanel } from "@/components/MapPanel";
import { JourneyBanner } from "@/components/JourneyBanner";
import { journeyToEntry, type JourneyEntry } from "@/lib/journeys";
import { getHomeOrigin } from "@/lib/settings";
import { TravelLegCards, type TravelLegItem } from "@/components/TravelLegCards";
import type { MapLeg } from "@/components/AdventureMap";
import type { MapPin } from "@/lib/types";
import { sharedEntryHref, sharedMapHref } from "@/lib/shared-links";
import { newestEntriesFirst } from "@/lib/shared-entry-order";
import { teaserText } from "@/lib/teaser";

interface SharedEntry extends JourneyEntry {
  id: string;
  entry_date: string;
  created_at: string;
  kind: "diary" | "travel";
  title: string;
  body: string;
  itinerary: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  travel_mode: JourneyEntry["travel_mode"];
  route_geometry: [number, number][] | null;
  route_km: number | null;
}

interface SharedMedia {
  id: string;
  entry_id: string;
  caption: string | null;
  alt_text: string | null;
  width: number | null;
  height: number | null;
  mime_type: string;
  processing_status: string;
}

export async function SharedAdventureView({
  token,
  adventure,
  showAllTripsLink = false,
}: {
  token: string;
  adventure: SharedAdventure;
  showAllTripsLink?: boolean;
}) {
  const admin = createAdminClient();

  // Only a whole-app share can follow a diary link through to another trip;
  // showAllTripsLink is set exactly on that scope.
  const shareLinks: ShareLinkContext = { token, wholeApp: showAllTripsLink };

  const { data: entries } = await admin
    .from("entries")
    .select(
      "id, entry_date, created_at, kind, title, body, itinerary, location, latitude, longitude, travel_mode, route_geometry, route_km",
    )
    .eq("adventure_id", adventure.id)
    .eq("status", "published")
    .is("deleted_at", null)
    .order("entry_date", { ascending: true })
    .order("created_at", { ascending: true })
    .overrideTypes<SharedEntry[]>();

  const { data: media } = await admin
    .from("media")
    .select("id, entry_id, caption, alt_text, width, height, mime_type, processing_status")
    .eq("adventure_id", adventure.id)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .overrideTypes<SharedMedia[]>();

  // Visitors only ever see the web-sized video copy, so videos stay hidden
  // from shared pages until videos:process has produced one.
  const visibleMedia = (media ?? []).filter(
    (item) => !item.mime_type.startsWith("video/") || item.processing_status === "ready",
  );

  const mediaBase = `/share/${token}/photo`;
  const mediaByEntry = new Map<string, SharedMedia[]>();
  for (const item of visibleMedia) {
    const list = mediaByEntry.get(item.entry_id) ?? [];
    list.push(item);
    mediaByEntry.set(item.entry_id, list);
  }

  const entryList = entries ?? [];
  const displayEntries = newestEntriesFirst(entryList);
  const adventureSlug = showAllTripsLink ? adventure.slug : null;
  const pins: MapPin[] = entryList
    .filter((entry) => entry.latitude !== null && entry.longitude !== null)
    .map((entry) => ({
      id: entry.id,
      latitude: entry.latitude as number,
      longitude: entry.longitude as number,
      title: entry.title,
      subtitle: `${formatDate(entry.entry_date)}${
        entry.location ? ` · ${entry.location}` : ""
      }`,
      href: sharedEntryHref(token, adventureSlug, entry.id),
      travelMode: entry.travel_mode,
    }));
  if (
    pins.length === 0 &&
    adventure.latitude !== null &&
    adventure.longitude !== null
  ) {
    pins.push({
      id: adventure.id,
      latitude: adventure.latitude,
      longitude: adventure.longitude,
      title: adventure.title,
      subtitle: adventure.location ?? undefined,
    });
  }

  // Journeys start from home, same as the signed-in app
  const origin = await getHomeOrigin(admin);

  const legs: MapLeg[] = [];
  for (const entry of entryList) {
    const leg = journeyToEntry(entryList, entry.id, origin);
    if (!leg) continue;
    legs.push({
      points: leg.routePoints ?? [
        [leg.from.latitude, leg.from.longitude],
        [leg.to.latitude, leg.to.longitude],
      ],
      mode: leg.mode,
      onRoad: leg.routePoints !== null,
    });
  }

  const firstLocated = entryList.find(
    (entry) => entry.latitude !== null && entry.longitude !== null,
  );
  if (
    origin &&
    firstLocated &&
    journeyToEntry(entryList, firstLocated.id, origin) !== null
  ) {
    pins.unshift({
      id: "home",
      latitude: origin.latitude,
      longitude: origin.longitude,
      title: "Home",
      subtitle: origin.name,
    });
  }

  // Runs of consecutive photo-less travel legs collapse into one chain card
  type FeedBlock =
    | { type: "entry"; entry: SharedEntry }
    | { type: "legs"; entries: SharedEntry[] };
  const blocks: FeedBlock[] = [];
  for (const entry of displayEntries) {
    const compactLeg =
      entry.kind === "travel" && (mediaByEntry.get(entry.id)?.length ?? 0) === 0;
    if (!compactLeg) {
      blocks.push({ type: "entry", entry });
      continue;
    }
    const last = blocks[blocks.length - 1];
    if (last?.type === "legs") {
      // displayEntries is newest first, so earlier legs go in front
      last.entries.unshift(entry);
    } else {
      blocks.push({ type: "legs", entries: [entry] });
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <header className="border-b border-stone-200 bg-stone-50/90">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-4">
          {showAllTripsLink ? (
            <Link
              href={`/share/${token}`}
              className="font-semibold tracking-tight text-lg"
            >
              <span aria-hidden>🏔️ </span>Holidays
            </Link>
          ) : (
            <span className="font-semibold tracking-tight text-lg">
              <span aria-hidden>🏔️ </span>Holidays
            </span>
          )}
          {showAllTripsLink ? (
            <Link
              href={sharedMapHref(token)}
              className="ml-auto rounded-lg bg-amber-700 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-800"
            >
              Map
            </Link>
          ) : (
            <span className="ml-auto text-xs text-stone-400">Shared album</span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {showAllTripsLink && (
          <Link
            href={`/share/${token}`}
            className="mb-4 inline-block text-sm font-medium text-amber-800 hover:underline"
          >
            ← All trips
          </Link>
        )}

        {adventure.cover_media_id && (
          <img
            src={`${mediaBase}/${adventure.cover_media_id}?size=display`}
            alt=""
            className="mb-5 aspect-[2/1] w-full rounded-2xl bg-stone-100 object-cover"
          />
        )}

        <div className="mb-1 flex items-center gap-2 text-xs text-stone-500">
          <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-900">
            {ADVENTURE_TYPE_LABELS[adventure.type as AdventureType]}
          </span>
          <span>{formatDateRange(adventure.start_date, adventure.end_date)}</span>
          {adventure.location && <span>· {adventure.location}</span>}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{adventure.title}</h1>
        {adventure.summary && (
          <RichText
            text={adventure.summary}
            share={shareLinks}
            className="prose prose-stone max-w-none mt-2 prose-p:my-2 prose-p:text-stone-600 prose-a:text-amber-800"
          />
        )}

        {pins.length > 0 && (
          <div className="mt-5">
            <MapPanel pins={pins} journey legs={legs} className="h-64" />
          </div>
        )}

        <div className="mt-8 space-y-8">
          {blocks.map((block) => {
            if (block.type === "legs") {
              const items: TravelLegItem[] = block.entries.map((entry) => ({
                id: entry.id,
                title: entry.title,
                entry_date: entry.entry_date,
                mode: entry.travel_mode,
                leg: journeyToEntry(entryList, entry.id, origin),
                notes: entry.body || null,
                href: sharedEntryHref(token, adventureSlug, entry.id),
              }));
              return (
                <div key={block.entries[0].id}>
                  <TravelLegCards items={items} />
                </div>
              );
            }

            const entry = block.entry;
            const photos = mediaByEntry.get(entry.id) ?? [];
            const journey = journeyToEntry(entryList, entry.id, origin);
            const photoCount = photos.length;
            // Teaser card matching the signed-in trip diary: collage, a
            // two-line teaser, and View entry into the full shared page.
            return (
              <Link
                key={entry.id}
                href={sharedEntryHref(token, adventureSlug, entry.id)}
                className="group block overflow-hidden rounded-2xl border-2 border-stone-300 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-amber-600 hover:shadow-md"
              >
                <div className="border-b border-stone-300 bg-stone-100 px-4 py-3">
                  <p className="text-xs font-medium text-stone-500">
                    {formatDate(entry.entry_date)}
                    {entry.location && ` · ${entry.location}`}
                  </p>
                  <h2 className="mt-0.5 text-xl font-semibold tracking-tight text-stone-900 group-hover:text-amber-900">
                    {entry.title}
                  </h2>
                </div>
                <EntryCardPhotos photos={photos} mediaBasePath={mediaBase} />
                <div className="p-4">
                  {journey && (
                    <div className="mb-3">
                      <JourneyBanner leg={journey} />
                    </div>
                  )}
                  {entry.body && (
                    <p className="line-clamp-2 text-sm text-stone-600">
                      {teaserText(entry.body)}
                    </p>
                  )}
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-stone-100 pt-3">
                    <p className="text-xs text-stone-400">
                      {photoCount === 0
                        ? "No photos yet"
                        : photoCount === 1
                          ? "1 photo"
                          : `${photoCount} photos`}
                    </p>
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-700 px-3 py-2 text-sm font-semibold text-white transition-colors group-hover:bg-amber-800">
                      View entry <span aria-hidden>→</span>
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <p className="mt-12 pb-6 text-center text-xs text-stone-400">
          A private family album, shared with you.
        </p>
      </main>
    </div>
  );
}
