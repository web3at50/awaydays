import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/dates";
import { journeyToEntry, type JourneyEntry } from "@/lib/journeys";
import { getHomeOrigin } from "@/lib/settings";
import type { Adventure, Entry, Media, ReactionRow } from "@/lib/types";
import { EntryBody } from "@/components/EntryBody";
import { JourneyBanner } from "@/components/JourneyBanner";
import { JourneyMapPanel } from "@/components/JourneyMapPanel";
import { PhotoSection } from "@/components/PhotoSection";
import { ReactionBar } from "@/components/ReactionBar";
import { UploadManager } from "@/components/UploadManager";

type ReactionQueryRow = {
  emoji: string;
  profile_id: string;
  entry_id: string | null;
  media_id: string | null;
  profile: { display_name: string } | null;
};

export default async function EntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; entryId: string }>;
  searchParams: Promise<{ geocode?: string }>;
}) {
  const { slug, entryId } = await params;
  const { geocode } = await searchParams;
  const supabase = await createClient();

  const { data: adventure } = await supabase
    .from("adventures")
    .select("id, slug, title, cover_media_id")
    .eq("slug", slug)
    .is("deleted_at", null)
    .single<Pick<Adventure, "id" | "slug" | "title" | "cover_media_id">>();
  if (!adventure) notFound();

  const { data: entry } = await supabase
    .from("entries")
    .select("*, author:profiles!entries_created_by_fkey(display_name)")
    .eq("id", entryId)
    .eq("adventure_id", adventure.id)
    .is("deleted_at", null)
    .single<Entry & { author: { display_name: string } | null }>();
  if (!entry) notFound();

  const { data: media } = await supabase
    .from("media")
    .select("id, caption, alt_text, width, height, mime_type, processing_status")
    .eq("entry_id", entry.id)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const photos = (media ?? []) as Pick<
    Media,
    "id" | "caption" | "alt_text" | "width" | "height" | "mime_type" | "processing_status"
  >[];

  // The journey that arrived at this day, derived from sibling entries
  const { data: siblingEntries } = await supabase
    .from("entries")
    .select(
      "id, entry_date, created_at, location, latitude, longitude, travel_mode, route_geometry, route_km",
    )
    .eq("adventure_id", adventure.id)
    .is("deleted_at", null)
    .overrideTypes<JourneyEntry[]>();
  const origin = await getHomeOrigin(supabase);
  const journey = journeyToEntry(siblingEntries ?? [], entry.id, origin);

  // Who is signed in (for the reaction bar) + all reactions on this page
  // Local JWT verification, matching proxy.ts — pages never call the Auth
  // server. Server actions still use auth.getUser() per mutation.
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub ?? null;
  const { data: me } = userId
    ? await supabase
        .from("profiles")
        .select("id, display_name")
        .eq("id", userId)
        .single()
    : { data: null };

  const photoIds = photos.map((p) => p.id);
  const reactionFilter =
    photoIds.length > 0
      ? `entry_id.eq.${entry.id},media_id.in.(${photoIds.join(",")})`
      : `entry_id.eq.${entry.id}`;
  const { data: reactionRows } = await supabase
    .from("reactions")
    .select("emoji, profile_id, entry_id, media_id, profile:profiles(display_name)")
    .or(reactionFilter)
    .order("created_at", { ascending: true })
    .overrideTypes<ReactionQueryRow[]>();

  const entryReactions: ReactionRow[] = [];
  const reactionsByMedia: Record<string, ReactionRow[]> = {};
  for (const row of reactionRows ?? []) {
    const reaction: ReactionRow = {
      emoji: row.emoji,
      profile_id: row.profile_id,
      display_name: row.profile?.display_name ?? "Family",
    };
    if (row.entry_id) entryReactions.push(reaction);
    else if (row.media_id) {
      (reactionsByMedia[row.media_id] ??= []).push(reaction);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <Link
          href={`/adventures/${adventure.slug}`}
          className="text-sm text-amber-800 hover:underline"
        >
          ← {adventure.title}
        </Link>
        <Link
          href={`/adventures/${adventure.slug}/entries/${entry.id}/edit`}
          className="rounded-lg border border-stone-300 text-sm font-medium px-3 py-1.5 text-stone-700 hover:border-amber-600 hover:text-amber-800"
        >
          Edit
        </Link>
      </div>

      {geocode === "failed" && entry.location && (
        <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Saved — but &quot;{entry.location}&quot; couldn&apos;t be found on the
          map, so this day isn&apos;t on the journey yet. Edit it and try a
          fuller place name, like a station or town and country.
        </p>
      )}

      <p className="text-xs text-stone-500 mt-4 mb-0.5">
        {formatDate(entry.entry_date)}
        {entry.location && ` · ${entry.location}`}
        {entry.author && ` · by ${entry.author.display_name}`}
      </p>
      <h1 className="text-2xl font-semibold tracking-tight">{entry.title}</h1>

      {journey && (
        <div className="mt-4 space-y-3">
          <JourneyBanner leg={journey} />
          <JourneyMapPanel leg={journey} />
        </div>
      )}

      {entry.body && <EntryBody body={entry.body} />}

      <div className="mt-4">
        <ReactionBar
          reactions={entryReactions}
          myProfileId={me?.id}
          myName={me?.display_name}
          entryId={entry.id}
          slug={adventure.slug}
          pageEntryId={entry.id}
        />
      </div>

      {entry.itinerary && (
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <h2 className="text-sm font-semibold text-amber-900 mb-1">
            Itinerary
          </h2>
          <p className="text-sm text-amber-950 whitespace-pre-wrap">
            {entry.itinerary}
          </p>
        </div>
      )}

      <h2 className="font-semibold text-lg mt-8 mb-3">
        Photos{photos.length > 0 && ` (${photos.length})`}
      </h2>

      <PhotoSection
        photos={photos}
        entryId={entry.id}
        adventureId={adventure.id}
        adventureSlug={adventure.slug}
        coverMediaId={adventure.cover_media_id}
        reactionsByMedia={reactionsByMedia}
        myProfileId={me?.id}
        myName={me?.display_name}
      />

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-stone-600 mb-2">Add photos</h3>
        <UploadManager entryId={entry.id} />
      </div>
    </div>
  );
}
