import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SharedEntryView } from "@/components/SharedEntryView";
import { resolveShareToken } from "@/lib/share";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// A single-trip share's entry page — the trip is implied by the token.
// Deeper navigation, so no view count, matching filter clicks and the map.
export default async function SharedSingleTripEntryPage({
  params,
}: {
  params: Promise<{ token: string; entryId: string }>;
}) {
  const { token, entryId } = await params;
  const resolved = await resolveShareToken(token);
  if (!resolved || resolved.scope !== "adventure") notFound();

  return (
    <SharedEntryView
      token={token}
      adventure={resolved.adventure}
      entryId={entryId}
      wholeApp={false}
    />
  );
}
