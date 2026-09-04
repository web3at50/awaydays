import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDateRange } from "@/lib/dates";
import {
  formatCost,
  formatItineraryDay,
  googleSearchUrl,
  groupItineraryByDay,
  itineraryDayKey,
  itineraryTime,
  mapsSearchUrl,
  tripAdvisorSearchUrl,
  ideaCoords,
  walkFromHotelLabel,
} from "@/lib/plan";
import { CopyButton } from "@/components/CopyButton";
import {
  deleteTripIdea,
  fetchTripadvisorRating,
  toggleIdeaDone,
} from "@/lib/plan-actions";
import {
  ADVENTURE_TYPE_LABELS,
  IDEA_CATEGORY_EMOJI,
  IDEA_CATEGORY_LABELS,
  ITINERARY_KIND_EMOJI,
  ITINERARY_KIND_LABELS,
  type Adventure,
  type ItineraryDocument,
  type ItineraryItem,
  type MapPin,
  type TripIdea,
} from "@/lib/types";
import { teaserText } from "@/lib/teaser";
import { planSearchEnabled, tripadvisorEnabled } from "@/lib/features";
import { IdeaForm } from "@/components/IdeaForm";
import { MapPanel } from "@/components/MapPanel";
import { PlanSearch } from "@/components/PlanSearch";
import { RichText } from "@/components/RichText";

// The planning page for one trip: bookings grouped by day, the ideas list,
// and the research search. Signed-in only — nothing here is shared.

// The research search server actions POST to this route; a deep dive with
// two searches can run 40s+, so don't let the platform default cut it off.
export const maxDuration = 90;
export default async function PlanPage({
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

  const [{ data: itineraryRows }, { data: ideaRows }, { data: documentRows }] =
    await Promise.all([
      supabase
        .from("itinerary_items")
        .select("*")
        .eq("adventure_id", adventure.id)
        .is("deleted_at", null)
        .order("starts_at", { ascending: true, nullsFirst: false }),
      supabase
        .from("trip_ideas")
        .select("*")
        .eq("adventure_id", adventure.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: true }),
      supabase
        .from("itinerary_documents")
        .select("*")
        .eq("adventure_id", adventure.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: true }),
    ]);
  const items = (itineraryRows ?? []) as ItineraryItem[];
  const ideas = (ideaRows ?? []) as TripIdea[];
  const documentsByItem = new Map<string, ItineraryDocument[]>();
  for (const doc of (documentRows ?? []) as ItineraryDocument[]) {
    const list = documentsByItem.get(doc.itinerary_item_id) ?? [];
    list.push(doc);
    documentsByItem.set(doc.itinerary_item_id, list);
  }
  const sortedIdeas = [...ideas.filter((i) => !i.done), ...ideas.filter((i) => i.done)];
  const groups = groupItineraryByDay(items);
  const placeName = adventure.location ?? adventure.title;

  // The hotel anchors "walk from the hotel" labels on ideas with known
  // coordinates (see ideaCoords: Tripadvisor's match, else the geocoded address)
  const hotel = items.find(
    (item) => item.kind === "hotel" && item.latitude !== null && item.longitude !== null,
  );

  // The ideas map: the hotel (its own amber pin) plus every idea with
  // coordinates. Pin links open Google Maps at the venue, same as the
  // 📍 Maps link on the cards.
  const planPins: MapPin[] = [
    ...(hotel
      ? [
          {
            id: hotel.id,
            latitude: hotel.latitude as number,
            longitude: hotel.longitude as number,
            title: hotel.title,
            subtitle: "Where we're staying",
            href: mapsSearchUrl(hotel.title, hotel.location, placeName),
            kind: "hotel" as const,
          },
        ]
      : []),
    ...sortedIdeas.flatMap((idea) => {
      const coords = ideaCoords(idea);
      if (!coords) return [];
      return [
        {
          id: idea.id,
          ...coords,
          title: idea.title,
          subtitle: `${IDEA_CATEGORY_LABELS[idea.category]}${idea.done ? " · done ✓" : ""}`,
          href: mapsSearchUrl(idea.title, idea.address, placeName),
        },
      ];
    }),
  ];

  // "≈ 650 m · 8 min walk" from the hotel, when both ends are known
  const walkFromHotel = (idea: TripIdea): string | null => {
    const coords = ideaCoords(idea);
    if (!hotel || !coords) return null;
    return walkFromHotelLabel(
      hotel.latitude as number,
      hotel.longitude as number,
      coords.latitude,
      coords.longitude,
    );
  };

  return (
    <div>
      <Link
        href={`/adventures/${adventure.slug}`}
        className="text-sm text-amber-800 hover:underline"
      >
        ← {adventure.title}
      </Link>

      <div className="mt-2 flex items-center gap-2 text-xs text-stone-500">
        <span className="rounded-full bg-amber-100 text-amber-900 px-2 py-0.5 font-medium">
          {ADVENTURE_TYPE_LABELS[adventure.type]}
        </span>
        <span>{formatDateRange(adventure.start_date, adventure.end_date)}</span>
        {adventure.location && <span>· {adventure.location}</span>}
      </div>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        Plans and bookings
      </h1>

      <div className="mt-6 mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 className="font-semibold text-lg">Itinerary</h2>
        <Link
          href={`/adventures/${adventure.slug}/plan/new-item`}
          className="whitespace-nowrap rounded-lg bg-amber-700 text-white text-sm font-medium px-3 py-2 hover:bg-amber-800"
        >
          + Add booking
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="text-center bg-white rounded-2xl border border-stone-200 p-8">
          <p className="text-stone-500 text-sm">
            Nothing booked yet. Add trains, hotels and anything else that&apos;s
            sorted.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.day ?? "undated"}>
              <h3 className="mb-2 text-sm font-medium text-stone-500">
                {group.day ? formatItineraryDay(group.day) : "Not dated yet"}
              </h3>
              <ul className="space-y-3">
                {group.items.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-amber-800">
                          <span aria-hidden>
                            {ITINERARY_KIND_EMOJI[item.kind]}
                          </span>{" "}
                          {ITINERARY_KIND_LABELS[item.kind]}
                          {item.starts_at && (
                            <>
                              {" · "}
                              {itineraryTime(item.starts_at)}
                              {/* A range only reads as one when it ends the same day —
                                  a hotel's check-out lives on its own day heading */}
                              {item.ends_at &&
                                itineraryDayKey(item.ends_at) ===
                                  itineraryDayKey(item.starts_at) &&
                                ` – ${itineraryTime(item.ends_at)}`}
                            </>
                          )}
                        </p>
                        <p className="mt-0.5 font-semibold text-stone-900">
                          {item.title}
                        </p>
                        {(item.from_location || item.to_location) && (
                          <p className="mt-0.5 text-sm text-stone-600">
                            {item.from_location}
                            {item.from_location && item.to_location && " → "}
                            {item.to_location}
                          </p>
                        )}
                        {item.location && (
                          <p className="mt-0.5 text-sm text-stone-600">
                            {item.location}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-stone-500">
                          {[
                            item.provider,
                            item.booking_reference && `ref ${item.booking_reference}`,
                            item.cost_amount !== null &&
                              formatCost(item.cost_amount, item.cost_currency),
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <Link
                        href={`/adventures/${adventure.slug}/plan/items/${item.id}/edit`}
                        className="shrink-0 rounded-lg border border-stone-300 px-2.5 py-1.5 text-xs font-medium text-stone-600 hover:border-amber-600 hover:text-amber-800"
                      >
                        Edit
                      </Link>
                    </div>
                    {item.notes && (
                      <p className="mt-2 whitespace-pre-line border-t border-stone-100 pt-2 text-sm text-stone-600">
                        {item.notes}
                      </p>
                    )}
                    {(item.url || documentsByItem.has(item.id)) && (
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm text-amber-800 hover:underline"
                          >
                            View booking ↗
                          </a>
                        )}
                        {(documentsByItem.get(item.id) ?? []).map((doc) => (
                          <a
                            key={doc.id}
                            href={`/api/plan-doc/${doc.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="min-w-0 break-words text-sm text-amber-800 hover:underline"
                          >
                            📄 {doc.original_filename}
                          </a>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {planPins.length > 0 && (
        <div className="mt-8">
          <h2 className="font-semibold text-lg">Ideas map</h2>
          <p className="text-sm text-stone-500 mt-1 mb-4">
            The hotel and every idea with a location. Google&apos;s own place
            icons are tappable too, for whatever else is nearby.
          </p>
          <MapPanel pins={planPins} className="h-72" clickablePois />
        </div>
      )}

      <div className="mt-8 mb-4">
        <h2 className="font-semibold text-lg">Ideas — things to do</h2>
        <p className="text-sm text-stone-500 mt-1">
          Saved finds and family suggestions. Tick them off as you do them.
        </p>
      </div>

      {sortedIdeas.length === 0 ? (
        <div className="mb-4 text-center bg-white rounded-2xl border border-stone-200 p-8">
          <p className="text-stone-500 text-sm">
            No ideas saved yet — try a search below, or add your own.
          </p>
        </div>
      ) : (
        <ul className="mb-4 space-y-3">
          {sortedIdeas.map((idea) => (
            <li
              key={idea.id}
              className={`rounded-2xl border bg-white p-4 shadow-sm ${
                idea.done ? "border-stone-200 opacity-70" : "border-stone-200"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-amber-800">
                    <span aria-hidden>{IDEA_CATEGORY_EMOJI[idea.category]}</span>{" "}
                    {IDEA_CATEGORY_LABELS[idea.category]}
                    {idea.source !== "manual" && (
                      <span className="text-stone-400">
                        {" "}
                        · found with {idea.source === "exa" ? "Exa" : "Parallel"}
                      </span>
                    )}
                  </p>
                  <p
                    className={`mt-0.5 flex items-center gap-1.5 font-semibold ${
                      idea.done ? "text-stone-500 line-through" : "text-stone-900"
                    }`}
                  >
                    {idea.url ? (
                      <a
                        href={idea.url}
                        target="_blank"
                        rel="noreferrer"
                        className="min-w-0 break-words hover:text-amber-800 underline decoration-stone-300 underline-offset-2"
                      >
                        {idea.title}
                      </a>
                    ) : (
                      <span className="min-w-0 break-words">{idea.title}</span>
                    )}
                    <CopyButton
                      text={`${idea.title}, ${idea.address ?? placeName}`}
                    />
                  </p>
                  {idea.description &&
                    (idea.description.length > 350 ? (
                      // Deep-dive reports are long — show a taster, open on tap
                      <details className="group mt-1">
                        <summary className="cursor-pointer list-none">
                          <span className="line-clamp-3 break-words text-sm text-stone-600 group-open:hidden">
                            {teaserText(idea.description).replace(/[*_#]+/g, "")}
                          </span>
                          <span className="mt-0.5 inline-block text-xs font-medium text-amber-800 group-open:hidden">
                            Read the full report ▾
                          </span>
                          <span className="hidden text-xs font-medium text-amber-800 group-open:inline-block">
                            Hide the report ▴
                          </span>
                        </summary>
                        <RichText
                          text={idea.description}
                          className="prose prose-stone prose-sm mt-1 max-w-none break-words [overflow-wrap:anywhere] prose-a:text-amber-800"
                        />
                      </details>
                    ) : (
                      <p className="mt-1 whitespace-pre-line break-words text-sm text-stone-600">
                        {idea.description}
                      </p>
                    ))}
                  {idea.address && (
                    <p className="mt-1 break-words text-xs text-stone-400">
                      {idea.address}
                    </p>
                  )}
                  {walkFromHotel(idea) && (
                    <p className="mt-1 text-xs text-stone-500">
                      🚶 {walkFromHotel(idea)} from the hotel
                    </p>
                  )}
                  {idea.ta_rating !== null && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-sm text-stone-600">
                      {idea.ta_icon_url && (
                        // Tripadvisor's own rating bubbles — required
                        // attribution, and clearer than stars anyway
                        <img
                          src={idea.ta_icon_url}
                          alt={`Rated ${idea.ta_rating} on Tripadvisor`}
                          className="h-3.5"
                        />
                      )}
                      <span>
                        {idea.ta_rating}
                        {idea.ta_review_count !== null &&
                          ` · ${idea.ta_review_count.toLocaleString("en-GB")} reviews`}
                      </span>
                    </p>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 text-sm">
                    <a
                      href={mapsSearchUrl(idea.title, idea.address, placeName)}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-amber-800 hover:underline"
                    >
                      📍 Maps
                    </a>
                    <a
                      href={googleSearchUrl(idea.title, placeName)}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-amber-800 hover:underline"
                    >
                      Google
                    </a>
                    <a
                      href={idea.ta_url ?? tripAdvisorSearchUrl(idea.title, placeName)}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-amber-800 hover:underline"
                    >
                      Tripadvisor
                    </a>
                    {idea.ta_checked_at === null && tripadvisorEnabled() && (
                      <form
                        action={fetchTripadvisorRating.bind(
                          null,
                          idea.id,
                          adventure.slug,
                        )}
                        className="inline"
                      >
                        <button
                          type="submit"
                          className="text-xs text-stone-400 hover:text-amber-800 hover:underline"
                        >
                          Get rating
                        </button>
                      </form>
                    )}
                  </div>
                </div>
                <form action={deleteTripIdea.bind(null, idea.id, adventure.slug)}>
                  <button
                    type="submit"
                    aria-label={`Remove ${idea.title}`}
                    className="shrink-0 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs text-stone-400 hover:border-red-300 hover:text-red-600"
                  >
                    ✕
                  </button>
                </form>
              </div>
              <form
                action={toggleIdeaDone.bind(null, idea.id, adventure.slug, !idea.done)}
                className="mt-2.5"
              >
                <button
                  type="submit"
                  className={`w-full rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    idea.done
                      ? "bg-stone-100 text-stone-500 hover:bg-stone-200"
                      : "border border-amber-600 text-amber-800 hover:bg-amber-50"
                  }`}
                >
                  {idea.done ? "Done ✓ — tap to untick" : "We did this"}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-4">
        <IdeaForm adventureId={adventure.id} adventureSlug={adventure.slug} />
        {planSearchEnabled() && (
          <PlanSearch
            adventureId={adventure.id}
            adventureSlug={adventure.slug}
            placeName={placeName}
          />
        )}
      </div>
    </div>
  );
}
