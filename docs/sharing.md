# Sharing: read-only links for relatives

## How links work

An admin creates a link that is revocable and optionally expiring. They can
name it after whoever it is sent to ("Grandparents", "the cousins") so the
view counts and last-viewed dates show who is actually looking.

Token resolution matches on a **SHA-256 hash** of the token. The raw token
is *also* stored, so an admin can copy a link's URL again any time from the
Existing links list. This is a deliberate softening of a hash-only design:
`share_links` is admin-only under RLS (the anon role has no access at all)
and being able to re-copy a link was judged worth more than the extra
protection of hashing alone. The token column is nullable; a link with no
stored token cannot have its URL shown again and the UI says so.

Stored URLs show a Copy button and, on phones with a system share sheet, a
Share button too (`ShareLinkUrl`, hidden where `navigator.share` is
unsupported).

View counts and last-viewed dates are recorded by the `record_share_view`
database function: a single atomic increment, scheduled with Next's
`after()` so visitors never wait on the bookkeeping.

Two scopes:

- **Single trip**: created from a trip's Share page, exposes that trip only.
- **Whole app**: created from Settings, exposes every current *and future*
  active trip. Visitors land on a trip-card index and can open each diary.

Both live under `/share/[token]`, which is excluded from the auth proxy in
`proxy.ts` and marked `noindex`.

## What a visitor may see

Shared pages render server-side through the service-role admin client, so
the rules below are the only thing standing between a visitor and private
data. Treat them as load-bearing.

- Only `published` entries, only rows where `deleted_at is null`.
- **Web-sized photos only.** Images come from `/share/[token]/photo/[mediaId]`,
  which serves derivatives. Originals are never exposed.
- **Videos only once processed.** A video with no web copy is hidden
  entirely rather than falling back to the original.
- Reactions are visible but read-only.
- Every link on a shared page must stay inside the same token route. Map
  pins and entry links must never point into signed-in pages;
  `src/lib/shared-links.ts` builds these and is covered by tests.

Itinerary bookings, ideas and booking documents are never rendered on a
shared page at all; see [`backend-supabase.md`](backend-supabase.md).

## Layout

Shared diaries mirror the signed-in app deliberately, so signed-in users
see the same thing their visitors do. A shared trip page shows the same
teaser cards as the signed-in diary (photo collage, journey banner, a
two-line teaser and a "View entry" button) and each entry has its own
shared page (`SharedEntryView`: full text, journey map, read-only
reactions and the complete photo gallery with the zoom viewer). Whole-app
shares reach entries at
`/share/[token]/adventures/[slug]/entries/[entryId]`; single-trip shares at
`/share/[token]/entries/[entryId]`; `sharedEntryHref` builds both and is
tested. Entry pages are scoped to the share's trip and to published, live
entries. Deeper navigation (entries, map, filters) never increments the
view count; only an unfiltered landing does. Travel legs collapse into the
same compact strips and chained "Travelling" cards, linking to their entry
pages.

Whole-app visitors additionally get a read-only master map of every pin
and the same type/year filter dropdowns and trip-card entry/photo counts as
the signed-in home page. Filter URLs stay inside the token route (covered by
the `adventure-filters` tests) and a filter click does not increment the
link's view count; only an unfiltered landing does.
