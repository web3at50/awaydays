// A whole-app share reaches an entry through its trip's slug; a single-trip
// share has its trip implied by the token, so slug is null there.
export function sharedEntryHref(
  token: string,
  adventureSlug: string | null,
  entryId: string,
): string {
  const base = adventureSlug
    ? `/share/${token}/adventures/${adventureSlug}`
    : `/share/${token}`;
  return `${base}/entries/${entryId}`;
}

export function sharedMapHref(token: string): string {
  return `/share/${token}/map`;
}

export function sharedPhotoHref(
  token: string,
  mediaId: string,
  size: "thumb" | "display" | "large" = "display",
): string {
  return `/share/${token}/photo/${mediaId}?size=${size}`;
}

// Diary text and trip summaries can link to another trip as
// `/adventures/<slug>`. A share visitor has no session, so following that
// path would dump them on the sign-in page. A whole-app share can reach the
// trip through its own token; a single-trip share cannot reach it at all, so
// null means "drop the link and keep only its text" rather than offer a dead
// end. Anything else internal (/map, /settings, a deeper /adventures route)
// has no shared equivalent either; external links are left alone.
export function sharedTripHref(
  token: string,
  href: string,
  wholeApp: boolean,
): string | null {
  if (!href.startsWith("/")) return href;
  const match = /^\/adventures\/([^/?#]+)([?#].*)?$/.exec(href);
  if (!match || !wholeApp) return null;
  return `/share/${token}/adventures/${match[1]}${match[2] ?? ""}`;
}
