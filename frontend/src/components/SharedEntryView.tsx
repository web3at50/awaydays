import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/dates";
import { EntryBody } from "@/components/EntryBody";
import type { ShareLinkContext } from "@/components/RichText";
import { Gallery } from "@/components/Gallery";
import { JourneyBanner } from "@/components/JourneyBanner";
import { JourneyMapPanel } from "@/components/JourneyMapPanel";
import { ReactionBar } from "@/components/ReactionBar";
import type { ReactionRow } from "@/lib/types";
import type { SharedAdventure } from "@/lib/share";
import { journeyToEntry, type JourneyEntry } from "@/lib/journeys";
import { getHomeOrigin } from "@/lib/settings";
import { sharedMapHref } from "@/lib/shared-links";

// The read-only twin of the signed-in entry page: full diary text, the
// journey that arrived here, reactions, and every photo through the
// full-screen viewer. Reached from a teaser card on the shared trip view.
export async function SharedEntryView({
  token,
  adventure,
  entryId,
  wholeApp,
}: {
  token: string;
  adventure: SharedAdventure;
  entryId: string;
  wholeApp: boolean;
}) {
  const admin = createAdminClient();
  const shareLinks: ShareLinkContext = { token, wholeApp };

  // Scoped to this share's trip and to published, live entries, so a
  // guessed URL can never surface a draft or another trip's day.
  const { data: entry } = await admin
    .from("entries")
    .select(
      "id, entry_date, kind, title, body, location, latitude, longitude, travel_mode, route_geometry, route_km",
    )
    .eq("id", entryId)
    .eq("adventure_id", adventure.id)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle();
  if (!entry) notFound();

  const { data: media } = await admin
    .from("media")
    .select("id, caption, alt_text, width, height, mime_type, processing_status")
    .eq("entry_id", entry.id)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  // Visitors only ever see the web-sized video copy, so videos stay hidden
  // until videos:process has produced one — matching the trip view.
  const photos = (media ?? []).filter(
    (item) =>
      !item.mime_type.startsWith("video/") || item.processing_status === "ready",
  );

  const { data: siblingEntries } = await admin
    .from("entries")
    .select(
      "id, entry_date, created_at, location, latitude, longitude, travel_mode, route_geometry, route_km",
    )
    .eq("adventure_id", adventure.id)
    .eq("status", "published")
    .is("deleted_at", null)
    .overrideTypes<JourneyEntry[]>();
  const origin = await getHomeOrigin(admin);
  const journey = journeyToEntry(siblingEntries ?? [], entry.id, origin);

  const { data: reactionRows } = await admin
    .from("reactions")
    .select("emoji, profile_id, profile:profiles(display_name)")
    .eq("entry_id", entry.id)
    .order("created_at", { ascending: true })
    .overrideTypes<
      {
        emoji: string;
        profile_id: string;
        profile: { display_name: string } | null;
      }[]
    >();
  const reactions: ReactionRow[] = (reactionRows ?? []).map((row) => ({
    emoji: row.emoji,
    profile_id: row.profile_id,
    display_name: row.profile?.display_name ?? "Family",
  }));

  const tripHref = wholeApp
    ? `/share/${token}/adventures/${adventure.slug}`
    : `/share/${token}`;

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <header className="border-b border-stone-200 bg-stone-50/90">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-4">
          {wholeApp ? (
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
          {wholeApp ? (
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
        <Link
          href={tripHref}
          className="text-sm font-medium text-amber-800 hover:underline"
        >
          ← {adventure.title}
        </Link>

        <p className="mt-4 mb-0.5 text-xs text-stone-500">
          {formatDate(entry.entry_date)}
          {entry.location && ` · ${entry.location}`}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{entry.title}</h1>

        {journey && (
          <div className="mt-4 space-y-3">
            <JourneyBanner leg={journey} />
            <JourneyMapPanel leg={journey} />
          </div>
        )}

        {entry.body && <EntryBody body={entry.body} share={shareLinks} />}

        {reactions.length > 0 && (
          <div className="mt-4">
            <ReactionBar reactions={reactions} readOnly />
          </div>
        )}

        {photos.length > 0 && (
          <>
            <h2 className="mt-8 mb-3 text-lg font-semibold">
              Photos ({photos.length})
            </h2>
            <Gallery photos={photos} mediaBasePath={`/share/${token}/photo`} />
          </>
        )}
      </main>
    </div>
  );
}
