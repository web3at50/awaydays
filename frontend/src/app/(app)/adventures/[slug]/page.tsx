import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateRange } from "@/lib/dates";
import {
  ADVENTURE_TYPE_LABELS,
  type Adventure,
  type Entry,
  type MapPin,
} from "@/lib/types";
import { journeyToEntry } from "@/lib/journeys";
import { getHomeOrigin } from "@/lib/settings";
import type { MapLeg } from "@/components/AdventureMap";
import { EntryCardPhotos } from "@/components/EntryCardPhotos";
import { JourneyBanner } from "@/components/JourneyBanner";
import { MapPanel } from "@/components/MapPanel";
import { RichText } from "@/components/RichText";
import { TravelLegCards, type TravelLegItem } from "@/components/TravelLegCards";

type EntryWithMedia = Entry & {
  media: {
    id: string;
    alt_text: string | null;
    mime_type: string;
    processing_status: string;
  }[];
  author: { display_name: string } | null;
};

// A travel leg with no photos renders as a compact strip or chain card;
// adding photos promotes it back to a full event card.
function isCompactLeg(entry: EntryWithMedia): boolean {
  return entry.kind === "travel" && (entry.media?.length ?? 0) === 0;
}

// The feed, newest first, with runs of consecutive travel legs grouped
type FeedBlock =
  | { type: "entry"; entry: EntryWithMedia }
  | { type: "legs"; entries: EntryWithMedia[] };

function buildFeedBlocks(entries: EntryWithMedia[]): FeedBlock[] {
  const blocks: FeedBlock[] = [];
  for (const entry of entries) {
    if (!isCompactLeg(entry)) {
      blocks.push({ type: "entry", entry });
      continue;
    }
    const last = blocks[blocks.length - 1];
    if (last?.type === "legs") {
      // The list is newest first, so earlier legs go in front
      last.entries.unshift(entry);
    } else {
      blocks.push({ type: "legs", entries: [entry] });
    }
  }
  return blocks;
}

export default async function AdventurePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ geocode?: string }>;
}) {
  const { slug } = await params;
  const { geocode } = await searchParams;
  const supabase = await createClient();

  // Local JWT verification, matching proxy.ts — pages never call the Auth
  // server. Server actions still use auth.getUser() per mutation.
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub ?? null;
  const { data: profile } = userId
    ? await supabase.from("profiles").select("role").eq("id", userId).single()
    : { data: null };
  const isAdmin = profile?.role === "admin";

  const { data: adventure } = await supabase
    .from("adventures")
    .select("*")
    .eq("slug", slug)
    .is("deleted_at", null)
    .single<Adventure>();
  if (!adventure) notFound();

  const { data: entries } = await supabase
    .from("entries")
    .select(
      "*, media(id, alt_text, mime_type, processing_status), author:profiles!entries_created_by_fkey(display_name)",
    )
    .eq("adventure_id", adventure.id)
    .is("deleted_at", null)
    .is("media.deleted_at", null)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })
    .order("sort_order", { referencedTable: "media", ascending: true });

  // The diary displays newest first, while maps and journey legs still need
  // the same entries in chronological order.
  const entryList = (entries ?? []) as EntryWithMedia[];
  const chronologicalEntries = [...entryList].reverse();

  // Journeys start from home (family settings), so the first leg of every
  // trip is drawn without needing a "setting off" entry.
  const origin = await getHomeOrigin(supabase);

  // Pins for this adventure's journey: entries with coordinates, oldest
  // first; fall back to a single adventure pin when no entry has any.
  const pins: MapPin[] = chronologicalEntries
    .filter((entry) => entry.latitude !== null && entry.longitude !== null)
    .map((entry) => ({
      id: entry.id,
      latitude: entry.latitude as number,
      longitude: entry.longitude as number,
      title: entry.title,
      subtitle: `${formatDate(entry.entry_date)}${
        entry.location ? ` · ${entry.location}` : ""
      }`,
      href: `/adventures/${adventure.slug}/entries/${entry.id}`,
      travelMode: entry.travel_mode,
    }));
  if (pins.length === 0 && adventure.latitude !== null && adventure.longitude !== null) {
    pins.push({
      id: adventure.id,
      latitude: adventure.latitude,
      longitude: adventure.longitude,
      title: adventure.title,
      subtitle: adventure.location ?? undefined,
    });
  }

  // Leg geometry for the mini-map: real roads solid, straight hops dashed
  const legs: MapLeg[] = [];
  for (const entry of chronologicalEntries) {
    const leg = journeyToEntry(chronologicalEntries, entry.id, origin);
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

  // When the journey's first leg sets off from home, show home on the map
  const firstLocated = chronologicalEntries.find(
    (entry) => entry.latitude !== null && entry.longitude !== null,
  );
  if (
    origin &&
    firstLocated &&
    journeyToEntry(chronologicalEntries, firstLocated.id, origin) !== null
  ) {
    pins.unshift({
      id: "home",
      latitude: origin.latitude,
      longitude: origin.longitude,
      title: "Home",
      subtitle: origin.name,
    });
  }

  return (
    <div>
      {adventure.cover_media_id && (
        <img
          src={`/api/media/${adventure.cover_media_id}?size=display`}
          alt=""
          className="w-full aspect-[2/1] object-cover rounded-2xl bg-stone-100 mb-5"
        />
      )}

      <div className="flex items-center gap-2 text-xs text-stone-500 mb-1">
        <span className="rounded-full bg-amber-100 text-amber-900 px-2 py-0.5 font-medium">
          {ADVENTURE_TYPE_LABELS[adventure.type]}
        </span>
        <span>{formatDateRange(adventure.start_date, adventure.end_date)}</span>
        {adventure.location && <span>· {adventure.location}</span>}
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">{adventure.title}</h1>
      {adventure.summary && (
        <RichText
          text={adventure.summary}
          className="prose prose-stone max-w-none mt-2 prose-p:my-2 prose-p:text-stone-600 prose-a:text-amber-800"
        />
      )}

      {pins.length > 0 && (
        <div className="mt-5">
          <MapPanel pins={pins} journey legs={legs} className="h-64" />
        </div>
      )}

      <div className="mt-8 mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 className="font-semibold text-lg">Diary</h2>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <Link
              href={`/adventures/${adventure.slug}/share`}
              className="whitespace-nowrap rounded-lg border border-stone-300 text-sm font-medium px-3 py-2 text-stone-700 hover:border-amber-600 hover:text-amber-800"
            >
              Share
            </Link>
          )}
          <Link
            href={`/adventures/${adventure.slug}/plan`}
            className="whitespace-nowrap rounded-lg border border-stone-300 text-sm font-medium px-3 py-2 text-stone-700 hover:border-amber-600 hover:text-amber-800"
          >
            Plans
          </Link>
          <Link
            href={`/adventures/${adventure.slug}/edit`}
            className="whitespace-nowrap rounded-lg border border-stone-300 text-sm font-medium px-3 py-2 text-stone-700 hover:border-amber-600 hover:text-amber-800"
          >
            Edit
          </Link>
          <Link
            href={`/adventures/${adventure.slug}/entries/new-leg`}
            className="whitespace-nowrap rounded-lg border border-amber-600 text-sm font-medium px-3 py-2 text-amber-800 hover:bg-amber-50"
          >
            + Leg
          </Link>
          <Link
            href={`/adventures/${adventure.slug}/entries/new`}
            className="whitespace-nowrap rounded-lg bg-amber-700 text-white text-sm font-medium px-3 py-2 hover:bg-amber-800"
          >
            + Add entry
          </Link>
        </div>
      </div>

      {geocode === "failed" && (
        <p className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Saved — but that place couldn&apos;t be found on the map, so this leg
          won&apos;t appear on the journey yet. Open it and try a fuller place
          name, like &quot;Edinburgh Waverley station&quot;.
        </p>
      )}

      {entryList.length === 0 ? (
        <div className="text-center bg-white rounded-2xl border border-stone-200 p-8">
          <p className="text-stone-500 text-sm">
            No entries yet. Add the first day of this trip.
          </p>
        </div>
      ) : (
        <ul className="space-y-6">
          {buildFeedBlocks(entryList).map((block) => {
            if (block.type === "legs") {
              const items: TravelLegItem[] = block.entries.map((entry) => ({
                id: entry.id,
                title: entry.title,
                entry_date: entry.entry_date,
                mode: entry.travel_mode,
                leg: journeyToEntry(entryList, entry.id, origin),
                notes: entry.body || null,
                href: `/adventures/${adventure.slug}/entries/${entry.id}`,
              }));
              return (
                <li key={block.entries[0].id}>
                  <TravelLegCards items={items} />
                </li>
              );
            }

            const entry = block.entry;
            const photoCount = entry.media?.length ?? 0;
            return (
              <li key={entry.id}>
                <Link
                  href={`/adventures/${adventure.slug}/entries/${entry.id}`}
                  className="group block overflow-hidden rounded-2xl border-2 border-stone-300 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-amber-600 hover:shadow-md"
                >
                  <div className="border-b border-stone-300 bg-stone-100 px-4 py-3">
                    <p className="text-xs font-medium text-stone-500">
                      {formatDate(entry.entry_date)}
                      {entry.location && ` · ${entry.location}`}
                      {entry.author && ` · by ${entry.author.display_name}`}
                    </p>
                    <h3 className="mt-0.5 text-lg font-semibold tracking-tight text-stone-900 group-hover:text-amber-900">
                      {entry.title}
                    </h3>
                  </div>

                  <EntryCardPhotos photos={entry.media ?? []} />
                  <div className="p-4">
                    {(() => {
                      const leg = journeyToEntry(entryList, entry.id, origin);
                      return leg ? (
                        <div className="mb-3">
                          <JourneyBanner leg={leg} />
                        </div>
                      ) : null;
                    })()}
                    {entry.body && (
                      <p className="line-clamp-2 text-sm text-stone-600">
                        {entry.body}
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
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
