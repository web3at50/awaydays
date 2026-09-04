"use client";

import { useRouter } from "next/navigation";
import { filterHref, type AdventureFilter } from "@/lib/adventure-filters";

const selectStyle =
  "min-w-0 flex-1 sm:flex-none rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-600";

// Two compact dropdowns instead of chip rows, so filtering doesn't push the
// trips below the fold on a phone. basePath keeps shared-index filter URLs
// inside the token route.
export function TripFilterBar({
  filter,
  years,
  basePath,
}: {
  filter: AdventureFilter;
  years: number[];
  basePath?: string;
}) {
  const router = useRouter();
  const apply = (next: AdventureFilter) => router.push(filterHref(next, basePath));

  return (
    <div className="mb-5 flex gap-2">
      <label htmlFor="filter-type" className="sr-only">
        Trip type
      </label>
      <select
        id="filter-type"
        value={filter.type ?? ""}
        onChange={(event) =>
          apply({
            ...filter,
            type: (event.target.value || null) as AdventureFilter["type"],
          })
        }
        className={selectStyle}
      >
        <option value="">All trips</option>
        <option value="holiday">Holidays</option>
        <option value="day_trip">Day trips</option>
        <option value="event">Events</option>
      </select>

      {years.length > 1 && (
        <>
          <label htmlFor="filter-year" className="sr-only">
            Year
          </label>
          <select
            id="filter-year"
            value={filter.year ?? ""}
            onChange={(event) =>
              apply({
                ...filter,
                year: event.target.value ? Number(event.target.value) : null,
              })
            }
            className={selectStyle}
          >
            <option value="">All years</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </>
      )}
    </div>
  );
}
