import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPanel } from "@/components/MapPanel";
import { formatDate } from "@/lib/dates";
import { recordShareView, resolveShareToken } from "@/lib/share";
import { sharedEntryHref } from "@/lib/shared-links";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MapPin } from "@/lib/types";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type SharedMapEntry = {
  id: string;
  title: string;
  entry_date: string;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  adventure: {
    slug: string;
    title: string;
    latitude: number | null;
    longitude: number | null;
  };
};

export default async function SharedMapPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const resolved = await resolveShareToken(token);
  if (!resolved || resolved.scope !== "all") notFound();

  recordShareView(resolved.shareId);

  const admin = createAdminClient();
  const { data: entries } = await admin
    .from("entries")
    .select(
      "id, title, entry_date, location, latitude, longitude, adventure:adventures!inner(slug, title, latitude, longitude)",
    )
    .eq("status", "published")
    .is("deleted_at", null)
    .is("adventure.deleted_at", null)
    .order("entry_date", { ascending: true })
    .order("created_at", { ascending: true })
    .overrideTypes<SharedMapEntry[]>();

  const pins: MapPin[] = [];
  for (const entry of entries ?? []) {
    const latitude = entry.latitude ?? entry.adventure.latitude;
    const longitude = entry.longitude ?? entry.adventure.longitude;
    if (latitude === null || longitude === null) continue;

    pins.push({
      id: entry.id,
      latitude,
      longitude,
      title: entry.title,
      subtitle: `${formatDate(entry.entry_date)}${
        entry.location ? ` · ${entry.location}` : ""
      } · ${entry.adventure.title}`,
      href: sharedEntryHref(token, entry.adventure.slug, entry.id),
    });
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <header className="border-b border-stone-200 bg-stone-50/90">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-4">
          <Link href={`/share/${token}`} className="font-semibold tracking-tight text-lg">
            <span aria-hidden>🏔️ </span>Holidays
          </Link>
          <Link
            href={`/share/${token}`}
            className="ml-auto text-sm font-medium text-amber-800 hover:underline"
          >
            All trips
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="mb-1 text-2xl font-semibold tracking-tight">
          Everywhere we&apos;ve been
        </h1>
        <p className="mb-5 text-sm text-stone-500">
          Every shared diary event with a location gets a pin. Tap one to revisit
          that day.
        </p>

        {pins.length === 0 ? (
          <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center">
            <p className="mb-3 text-4xl" aria-hidden>
              🗺️
            </p>
            <p className="font-medium">No pins to show yet</p>
          </div>
        ) : (
          <MapPanel pins={pins} className="h-[70vh]" />
        )}
      </main>
    </div>
  );
}
