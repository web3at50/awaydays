// Pure home-page filtering: trip type and year chips. No I/O, covered by
// adventure-filters.test.mjs.

const ADVENTURE_TYPES = ["holiday", "day_trip", "event"] as const;
type FilterableType = (typeof ADVENTURE_TYPES)[number];

export interface AdventureFilter {
  type: FilterableType | null;
  year: number | null;
}

interface FilterableAdventure {
  type: string;
  start_date: string;
}

// Reads ?type= and ?year= from the URL, ignoring anything unrecognised so a
// mistyped or stale link degrades to "show everything".
export function parseAdventureFilter(searchParams: {
  type?: string | string[];
  year?: string | string[];
}): AdventureFilter {
  const rawType = Array.isArray(searchParams.type)
    ? searchParams.type[0]
    : searchParams.type;
  const rawYear = Array.isArray(searchParams.year)
    ? searchParams.year[0]
    : searchParams.year;

  const type = ADVENTURE_TYPES.find((t) => t === rawType) ?? null;
  const year = rawYear && /^\d{4}$/.test(rawYear) ? Number(rawYear) : null;
  return { type, year };
}

// The URL for a filter, so filtered views are shareable and survive the
// back button. basePath keeps shared-index filter links inside the token
// route (/share/<token>), never pointing back into signed-in pages.
export function filterHref(filter: AdventureFilter, basePath = "/"): string {
  const params = new URLSearchParams();
  if (filter.type) params.set("type", filter.type);
  if (filter.year) params.set("year", String(filter.year));
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function filterAdventures<T extends FilterableAdventure>(
  adventures: readonly T[],
  filter: AdventureFilter,
): T[] {
  return adventures.filter(
    (adventure) =>
      (filter.type === null || adventure.type === filter.type) &&
      (filter.year === null ||
        Number(adventure.start_date.slice(0, 4)) === filter.year),
  );
}

// Distinct start years across every trip, newest first, for the year chips.
export function adventureYears(
  adventures: readonly FilterableAdventure[],
): number[] {
  const years = new Set(
    adventures.map((adventure) => Number(adventure.start_date.slice(0, 4))),
  );
  return [...years].filter(Number.isFinite).sort((a, b) => b - a);
}
