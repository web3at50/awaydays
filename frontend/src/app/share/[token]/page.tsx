import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordShareView, resolveShareToken } from "@/lib/share";
import type { SharedAdventure } from "@/lib/share";
import { formatDateRange } from "@/lib/dates";
import { ADVENTURE_TYPE_LABELS, type AdventureType } from "@/lib/types";
import { tripCountLabel, tripCounts } from "@/lib/trip-counts";
import {
  adventureYears,
  filterAdventures,
  parseAdventureFilter,
} from "@/lib/adventure-filters";
import { SharedAdventureView } from "@/components/SharedAdventureView";
import { TripFilterBar } from "@/components/TripFilterBar";
import { sharedMapHref } from "@/lib/shared-links";
import { teaserText } from "@/lib/teaser";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

function UnavailableShare() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 p-6">
      <div className="max-w-sm text-center">
        <p className="mb-3 text-4xl" aria-hidden>
          🔒
        </p>
        <h1 className="mb-2 text-xl font-semibold">This link isn&apos;t available</h1>
        <p className="text-sm text-stone-500">
          It may have expired or been switched off. Ask the person who shared it
          with you for a new link.
        </p>
      </div>
    </main>
  );
}

export default async function SharedPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ type?: string; year?: string }>;
}) {
  const { token } = await params;
  const resolved = await resolveShareToken(token);
  if (!resolved) return <UnavailableShare />;

  if (resolved.scope === "adventure") {
    recordShareView(resolved.shareId);
    return <SharedAdventureView token={token} adventure={resolved.adventure} />;
  }

  // A filter click re-renders the same visit, so only an unfiltered landing
  // counts as a view — otherwise browsing the dropdowns inflates the count.
  const filter = parseAdventureFilter(await searchParams);
  if (filter.type === null && filter.year === null) {
    recordShareView(resolved.shareId);
  }

  const admin = createAdminClient();
  const [{ data: adventures }, { data: entryRows }, { data: mediaRows }] =
    await Promise.all([
      admin
        .from("adventures")
        .select(
          "id, slug, title, type, summary, start_date, end_date, location, latitude, longitude, cover_media_id",
        )
        .is("deleted_at", null)
        .order("start_date", { ascending: false })
        .overrideTypes<SharedAdventure[]>(),
      // Visitors only ever see published entries, so only those count.
      admin
        .from("entries")
        .select("id, adventure_id, kind")
        .eq("status", "published")
        .is("deleted_at", null),
      admin.from("media").select("adventure_id, entry_id").is("deleted_at", null),
    ]);
  const counts = tripCounts(entryRows ?? [], mediaRows ?? []);
  const adventureList = adventures ?? [];
  const years = adventureYears(adventureList);
  const visibleAdventures = filterAdventures(adventureList, filter);

  const mediaBase = `/share/${token}/photo`;
  const basePath = `/share/${token}`;

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <header className="border-b border-stone-200 bg-stone-50/90">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-4">
          <span className="font-semibold tracking-tight text-lg">
            <span aria-hidden>🏔️ </span>Holidays
          </span>
          <Link
            href={sharedMapHref(token)}
            className="ml-auto rounded-lg bg-amber-700 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-800"
          >
            Map
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-5">
          <h1 className="text-2xl font-semibold tracking-tight">Our trips</h1>
          <p className="mt-1 text-sm text-stone-500">
            Choose a trip to see its diary and photos.
          </p>
        </div>

        {adventureList.length > 0 && (
          <TripFilterBar filter={filter} years={years} basePath={basePath} />
        )}

        {adventureList.length === 0 ? (
          <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center">
            <p className="font-medium">No trips to show yet</p>
          </div>
        ) : visibleAdventures.length === 0 ? (
          <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center">
            <p className="mb-1 font-medium">Nothing matches those filters</p>
            <p className="mb-5 text-sm text-stone-500">
              Try a different year or type, or show everything.
            </p>
            <Link
              href={basePath}
              className="inline-block rounded-lg bg-amber-700 px-4 py-2.5 font-medium text-white hover:bg-amber-800"
            >
              Show all trips
            </Link>
          </div>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2">
            {visibleAdventures.map((adventure) => (
              <li key={adventure.id}>
                <Link
                  href={`/share/${token}/adventures/${adventure.slug}`}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-amber-600 hover:shadow-md"
                >
                  {adventure.cover_media_id ? (
                    <img
                      src={`${mediaBase}/${adventure.cover_media_id}?size=thumb`}
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
                      {ADVENTURE_TYPE_LABELS[adventure.type as AdventureType]} ·{" "}
                      {formatDateRange(adventure.start_date, adventure.end_date)}
                    </p>
                    <h2 className="mt-1 text-xl font-semibold tracking-tight group-hover:text-amber-800">
                      {adventure.title}
                    </h2>
                    {adventure.location && (
                      <p className="mt-1 text-sm text-stone-500">{adventure.location}</p>
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
                      <span className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white group-hover:bg-amber-800">
                        Open trip <span aria-hidden>→</span>
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-12 pb-6 text-center text-xs text-stone-400">
          A private family album, shared with you.
        </p>
      </main>
    </div>
  );
}
