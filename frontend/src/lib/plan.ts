import { format, parseISO } from "date-fns";

// Pure helpers for the future-trips planning screens. Covered by
// plan.test.mjs.
//
// Itinerary times are wall-clock: a 09:15 London departure is stored as
// 09:15 "UTC" and always shown as 09:15, so nothing here (or anywhere)
// converts timezones. That is why these helpers slice the ISO string
// textually instead of going through Date.

/** "2030-05-03T09:15:00+00:00" → "2030-05-03" */
export function itineraryDayKey(iso: string): string {
  return iso.slice(0, 10);
}

/** "2030-05-03T09:15:00+00:00" → "09:15" */
export function itineraryTime(iso: string): string {
  return iso.slice(11, 16);
}

/** "2030-05-03" → "Friday 3 May 2030" */
export function formatItineraryDay(dayKey: string): string {
  return format(parseISO(dayKey), "EEEE d MMMM yyyy");
}

export interface ItineraryDayGroup<T> {
  /** Day key like "2030-05-03", or null for items with no date yet */
  day: string | null;
  items: T[];
}

/**
 * Group itinerary items into days, earliest day first, timed items in time
 * order within the day, and undated items collected at the end.
 */
export function groupItineraryByDay<T extends { starts_at: string | null }>(
  items: T[],
): ItineraryDayGroup<T>[] {
  const dated = items
    .filter((item) => item.starts_at !== null)
    .sort((a, b) => (a.starts_at as string).localeCompare(b.starts_at as string));
  const undated = items.filter((item) => item.starts_at === null);

  const groups: ItineraryDayGroup<T>[] = [];
  for (const item of dated) {
    const day = itineraryDayKey(item.starts_at as string);
    const last = groups[groups.length - 1];
    if (last && last.day === day) {
      last.items.push(item);
    } else {
      groups.push({ day, items: [item] });
    }
  }
  if (undated.length > 0) groups.push({ day: null, items: undated });
  return groups;
}

/**
 * Countdown label for a future trip card. Dates are date-only strings
 * (YYYY-MM-DD), compared as UTC days so the label never wobbles with
 * timezones.
 */
export function countdownLabel(
  startDate: string,
  endDate: string,
  todayIso: string,
): string {
  if (todayIso >= startDate && todayIso <= endDate) return "Happening now";
  const msPerDay = 24 * 60 * 60 * 1000;
  const days = Math.round(
    (Date.parse(`${startDate}T00:00:00Z`) - Date.parse(`${todayIso}T00:00:00Z`)) /
      msPerDay,
  );
  if (days === 1) return "Starts tomorrow";
  return `In ${days} days`;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: "£",
  EUR: "€",
  USD: "$",
};

/** 420 + "GBP" → "£420"; 736.2 + "EUR" → "€736.20"; unknown codes suffix. */
export function formatCost(amount: number, currency: string | null): string {
  const rounded = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  if (currency && CURRENCY_SYMBOLS[currency]) {
    return `${CURRENCY_SYMBOLS[currency]}${rounded}`;
  }
  return currency ? `${rounded} ${currency}` : rounded;
}

/** 394106 → "385 kB"; 3400000 → "3.2 MB" — size label on a document row. */
export function documentSizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  const mb = bytes / (1024 * 1024);
  return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1).replace(/\.0$/, "")} MB`;
}

/**
 * Today's date (YYYY-MM-DD) in the family's timezone. The app is used from
 * UK phones while the server runs in UTC; London's civil date is what "is
 * the trip still upcoming?" should mean.
 */
export function todayInLondon(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "Europe/London" });
}

/**
 * Google Maps search link for a place. On a phone at the destination, Maps
 * opens with the user's live location, so distance and walking routes come
 * free; planning from home, the family can measure from the hotel.
 */
export function mapsSearchUrl(
  title: string,
  address: string | null,
  fallbackPlace: string,
): string {
  const query = `${title}, ${address ?? fallbackPlace}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** Tripadvisor search link — their search handles "venue + town" well. */
export function tripAdvisorSearchUrl(title: string, place: string): string {
  return `https://www.tripadvisor.com/Search?q=${encodeURIComponent(`${title} ${place}`)}`;
}

/** Plain Google search — often the fastest route to reviews and deals. */
export function googleSearchUrl(title: string, place: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(`${title} ${place}`)}`;
}

/** "https://www.visitbruges.be/en/pubs" → "visitbruges.be", for link labels. */
export function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "source";
  }
}

/**
 * "≈ 650 m · 8 min walk" from the hotel to an idea, straight-line
 * haversine at 80 m/min. Beyond a sensible walk it drops the minutes:
 * "≈ 12 km away".
 */
export function walkFromHotelLabel(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
): string {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusM = 6371000;
  const dLat = toRad(toLat - fromLat);
  const dLon = toRad(toLon - fromLon);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(fromLat)) * Math.cos(toRad(toLat)) * Math.sin(dLon / 2) ** 2;
  const metres = 2 * earthRadiusM * Math.asin(Math.sqrt(a));

  if (metres >= 5000) return `≈ ${(metres / 1000).toFixed(0)} km away`;
  const rounded =
    metres < 1000
      ? `${Math.max(50, Math.round(metres / 50) * 50)} m`
      : `${(metres / 1000).toFixed(1)} km`;
  const minutes = Math.max(1, Math.round(metres / 80));
  return `≈ ${rounded} · ${minutes} min walk`;
}
