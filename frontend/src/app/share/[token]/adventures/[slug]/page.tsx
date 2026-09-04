import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SharedAdventureView } from "@/components/SharedAdventureView";
import { recordShareView, resolveShareToken } from "@/lib/share";
import type { SharedAdventure } from "@/lib/share";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function SharedTripPage({
  params,
}: {
  params: Promise<{ token: string; slug: string }>;
}) {
  const { token, slug } = await params;
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

  recordShareView(resolved.shareId);

  return (
    <SharedAdventureView
      token={token}
      adventure={adventure as SharedAdventure}
      showAllTripsLink
    />
  );
}
