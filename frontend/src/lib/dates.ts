import { format, isSameDay, parseISO } from "date-fns";

export function formatDateRange(start: string, end: string): string {
  const s = parseISO(start);
  const e = parseISO(end);
  if (isSameDay(s, e)) return format(s, "d MMM yyyy");
  return `${format(s, "d MMM")} – ${format(e, "d MMM yyyy")}`;
}

export function formatDate(date: string): string {
  return format(parseISO(date), "EEEE d MMMM yyyy");
}
