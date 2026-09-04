import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDateRange } from "@/lib/dates";
import { ADVENTURE_TYPE_LABELS, type Adventure } from "@/lib/types";
import {
  adventureYears,
  filterAdventures,
  parseAdventureFilter,
} from "@/lib/adventure-filters";
import { teaserText } from "@/lib/teaser";
import { tripCountLabel, tripCounts } from "@/lib/trip-counts";
import { TripFilterBar } from "@/components/TripFilterBar";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; year?: string }>;
}) {
  const filter = parseAdventureFilter(await searchParams);
  const supabase = await createClient();

  const [{ data: adventures }, { data: entryRows }, { data: mediaRows }] =
    await Promise.all([
      supabase
        .from("adventures")
        .select("*")
        .is("deleted_at", null)
        .order("start_date", { ascending: false }),
      supabase
        .from("entries")
        .select("id, adventure_id, kind")
        .is("deleted_at", null),
      supabase
        .from("media")
        .select("adventure_id, entry_id")
        .is("deleted_at", null),
    ]);
  const adventureList = (adventures ?? []) as Adventure[];
  const counts = tripCounts(entryRows ?? [], mediaRows ?? []);

  if (adventureList.length === 0) {
    return (
      <div className="text-center bg-white rounded-2xl border border-stone-200 p-10">
        <p className="text-4xl mb-3" aria-hidden>
          🧭
        </p>
        <p className="font-medium mb-1">No trips yet</p>
        <p className="text-stone-500 text-sm mb-5">
          Record your first holiday, day trip or family event.
        </p>
        <Link
          href="/adventures/new"
          className="inline-block rounded-lg bg-amber-700 text-white font-medium px-4 py-2.5 hover:bg-amber-800"
        >
          Start your first trip
        </Link>
      </div>
    );
  }

  const years = adventureYears(adventureList);
  const visibleAdventures = filterAdventures(adventureList, filter);

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Our trips</h1>
        <p className="text-sm text-stone-500 mt-1">
          Choose a trip to see its diary, photos and journey.
        </p>
      </div>

      <TripFilterBar filter={filter} years={years} />

      {visibleAdventures.length === 0 ? (
        <div className="text-center bg-white rounded-2xl border border-stone-200 p-10">
          <p className="font-medium mb-1">Nothing matches those filters</p>
          <p className="text-stone-500 text-sm mb-5">
            Try a different year or type, or show everything.
          </p>
          <Link
            href="/"
            className="inline-block rounded-lg bg-amber-700 text-white font-medium px-4 py-2.5 hover:bg-amber-800"
          >
            Show all trips
          </Link>
        </div>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2">
          {visibleAdventures.map((adventure) => (
            <li key={adventure.id}>
              <Link
                href={`/adventures/${adventure.slug}`}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-amber-600 hover:shadow-md"
              >
                {adventure.cover_media_id ? (
                  <img
                    src={`/api/media/${adventure.cover_media_id}?size=thumb`}
                    alt=""
                    loading="lazy"
                    className="aspect-[4/3] w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="flex aspect-[4/3] w-full items-center justify-center bg-gradient-to-br from-amber-700 to-stone-700 text-5xl">
                    <span aria-hidden>🧭</span>
                  </div>
                )}

                <div className="flex flex-1 flex-col p-4">
                  <p className="text-xs font-medium text-amber-800">
                    {ADVENTURE_TYPE_LABELS[adventure.type]} ·{" "}
                    {formatDateRange(adventure.start_date, adventure.end_date)}
                  </p>
                  <h2 className="mt-1 text-xl font-semibold tracking-tight text-stone-900 group-hover:text-amber-800">
                    {adventure.title}
                  </h2>
                  {adventure.location && (
                    <p className="mt-1 text-sm text-stone-500">
                      {adventure.location}
                    </p>
                  )}
                  {adventure.summary && (
                    <p className="mt-3 line-clamp-3 text-sm text-stone-600">
                      {teaserText(adventure.summary)}
                    </p>
                  )}
                  <div className="mt-auto pt-4">
                    {tripCountLabel(counts.get(adventure.id)) && (
                      <p className="mb-2 text-xs text-stone-500">
                        {tripCountLabel(counts.get(adventure.id))}
                      </p>
                    )}
                    <span className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors group-hover:bg-amber-800">
                      Open trip <span aria-hidden>→</span>
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
