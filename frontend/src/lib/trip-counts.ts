// Entry and photo counts shown on trip cards. Pure, no I/O; covered by
// trip-counts.test.mjs. Callers pre-filter the rows (soft-deleted rows out,
// and published-only for share pages) so the same logic serves both the
// signed-in home page and the shared trip index.

export interface TripCounts {
  entries: number;
  photos: number;
}

// Diary entries count as entries; travel legs don't, but photos attached to
// them still count as photos — they're still photos of the trip.
export function tripCounts(
  entries: readonly { id: string; adventure_id: string; kind: string }[],
  media: readonly { adventure_id: string; entry_id: string | null }[],
): Map<string, TripCounts> {
  const counts = new Map<string, TripCounts>();
  const countsFor = (adventureId: string): TripCounts => {
    let existing = counts.get(adventureId);
    if (!existing) {
      existing = { entries: 0, photos: 0 };
      counts.set(adventureId, existing);
    }
    return existing;
  };

  const entryIds = new Set(entries.map((entry) => entry.id));
  for (const entry of entries) {
    if (entry.kind === "diary") countsFor(entry.adventure_id).entries += 1;
  }
  for (const item of media) {
    if (item.entry_id && entryIds.has(item.entry_id)) {
      countsFor(item.adventure_id).photos += 1;
    }
  }
  return counts;
}

export function tripCountLabel(counts: TripCounts | undefined): string | null {
  if (!counts) return null;
  const parts: string[] = [];
  if (counts.entries > 0) {
    parts.push(counts.entries === 1 ? "1 entry" : `${counts.entries} entries`);
  }
  if (counts.photos > 0) {
    parts.push(counts.photos === 1 ? "1 photo" : `${counts.photos} photos`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}
