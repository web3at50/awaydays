import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDateRange } from "@/lib/dates";
import { countdownLabel, todayInLondon } from "@/lib/plan";
import { ADVENTURE_TYPE_LABELS, type Adventure } from "@/lib/types";

export const metadata = { title: "Future trips — Holidays" };

// Future trips: every adventure that hasn't finished yet, soonest first.
// A future trip is a normal trip created ahead of time — its plans,
// bookings and ideas live on the planning page and stay with the trip
// afterwards as the record of how the family travelled.
export default async function PlansPage() {
  const supabase = await createClient();
  const today = todayInLondon();

  const { data: adventures } = await supabase
    .from("adventures")
    .select("*")
    .is("deleted_at", null)
    .gte("end_date", today)
    .order("start_date", { ascending: true });
  const upcoming = (adventures ?? []) as Adventure[];

  const ids = upcoming.map((adventure) => adventure.id);
  const [{ data: itineraryRows }, { data: ideaRows }] = ids.length
    ? await Promise.all([
        supabase
          .from("itinerary_items")
          .select("adventure_id")
          .in("adventure_id", ids)
          .is("deleted_at", null),
        supabase
          .from("trip_ideas")
          .select("adventure_id")
          .in("adventure_id", ids)
          .is("deleted_at", null),
      ])
    : [{ data: [] }, { data: [] }];

  const bookingCounts = new Map<string, number>();
  for (const row of itineraryRows ?? []) {
    bookingCounts.set(row.adventure_id, (bookingCounts.get(row.adventure_id) ?? 0) + 1);
  }
  const ideaCounts = new Map<string, number>();
  for (const row of ideaRows ?? []) {
    ideaCounts.set(row.adventure_id, (ideaCounts.get(row.adventure_id) ?? 0) + 1);
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Future trips</h1>
        <p className="text-sm text-stone-500 mt-1">
          Everything booked and planned for the adventures still to come.
        </p>
      </div>

      {upcoming.length === 0 ? (
        <div className="text-center bg-white rounded-2xl border border-stone-200 p-10">
          <p className="text-4xl mb-3" aria-hidden>
            🗓️
          </p>
          <p className="font-medium mb-1">Nothing planned yet</p>
          <p className="text-stone-500 text-sm mb-5">
            Create the trip with its future dates, then add bookings and ideas
            here.
          </p>
          <Link
            href="/adventures/new"
            className="inline-block rounded-lg bg-amber-700 text-white font-medium px-4 py-2.5 hover:bg-amber-800"
          >
            + Start planning a trip
          </Link>
        </div>
      ) : (
        <ul className="space-y-4">
          {upcoming.map((adventure) => {
            const bookings = bookingCounts.get(adventure.id) ?? 0;
            const ideas = ideaCounts.get(adventure.id) ?? 0;
            const counts = [
              bookings === 1 ? "1 booking" : `${bookings} bookings`,
              ideas === 1 ? "1 idea" : `${ideas} ideas`,
            ].join(" · ");
            return (
              <li key={adventure.id}>
                <Link
                  href={`/adventures/${adventure.slug}/plan`}
                  className="group block rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-amber-600 hover:shadow-md"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-900">
                      {countdownLabel(adventure.start_date, adventure.end_date, today)}
                    </span>
                    <span className="text-stone-500">
                      {ADVENTURE_TYPE_LABELS[adventure.type]} ·{" "}
                      {formatDateRange(adventure.start_date, adventure.end_date)}
                    </span>
                  </div>
                  <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-stone-900 group-hover:text-amber-800">
                    {adventure.title}
                  </h2>
                  {adventure.location && (
                    <p className="mt-0.5 text-sm text-stone-500">
                      {adventure.location}
                    </p>
                  )}
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-stone-100 pt-3">
                    <p className="text-xs text-stone-500">{counts}</p>
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-700 px-3 py-2 text-sm font-semibold text-white transition-colors group-hover:bg-amber-800">
                      Open plans <span aria-hidden>→</span>
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-6 text-center text-xs text-stone-400">
        Planning somewhere new? Create the trip first, then its plans live
        here.{" "}
        <Link href="/adventures/new" className="text-amber-800 hover:underline">
          + Trip
        </Link>
      </p>
    </div>
  );
}
