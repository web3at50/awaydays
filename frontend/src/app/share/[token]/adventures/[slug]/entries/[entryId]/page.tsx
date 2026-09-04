import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SharedEntryView } from "@/components/SharedEntryView";
import { resolveShareToken } from "@/lib/share";
import type { SharedAdventure } from "@/lib/share";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// A whole-app share's entry page; the single-trip twin lives at
// /share/[token]/entries/[entryId]. Deeper navigation, so no view count —
// only landings on the index or a trip count as arrivals.
export default async function SharedTripEntryPage({
  params,
}: {
  params: Promise<{ token: string; slug: string; entryId: string }>;
}) {
  const { token, slug, entryId } = await params;
  const resolved = await resolveShareToken(token);
  if (!resolved || resolved.scope !== "all") notFound();

  const admin = createAdminClient();
  const { data: adventure } = await admin
    .from("adventures")
    .select(
      "id, slug, title, type, summary, start_date, end_date, location, latitude, longitude, cover_media_id",
    )
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();
  if (!adventure) notFound();

  return (
    <SharedEntryView
      token={token}
      adventure={adventure as SharedAdventure}
      entryId={entryId}
      wholeApp
    />
  );
}
