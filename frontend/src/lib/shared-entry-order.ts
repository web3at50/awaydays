type DatedEntry = {
  entry_date: string;
  created_at: string;
};

export function newestEntriesFirst<T extends DatedEntry>(entries: readonly T[]): T[] {
  return [...entries].sort((a, b) =>
    a.entry_date === b.entry_date
      ? b.created_at.localeCompare(a.created_at)
      : b.entry_date.localeCompare(a.entry_date),
  );
}
