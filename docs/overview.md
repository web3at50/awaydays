# Overview — what Awaydays is and who uses it

The orientation read. Start here, then follow the routing table in
[`AGENTS.md`](../AGENTS.md) to the doc for your task.

## What it is

A private, mobile-first family diary for holidays, day trips and events.
Family members add entries and photos from their phones while they are
away; the app draws the journey on a map and can share a read-only copy
with relatives through a revocable link.

Awaydays is the name of the project and repository. The wordmark users see
inside the app is **"Holidays"**, and that is deliberate — do not rename UI
strings when working on the code.

It is built to be self-hosted by one family: a Next.js app deployed to
Vercel (or any Node host) on top of a Supabase project for auth, Postgres
and private storage. [`SETUP.md`](../SETUP.md) walks through installation.

## Who uses it

There is no public sign-up. An admin creates every account, and there are
two roles:

- **admin** — full control, including creating accounts, share links, setting the home
  location that journeys start from, and the recycle bin's restore and
  permanent-delete actions.
- **editor** — adds and edits trips, entries and photos.

Relatives are not users at all: they view the diary through a share link,
without an account, and can never edit anything.

Write user-facing copy for a capable teenager as much as for an adult:
warm and plain, no baby talk, no jargon. See
[`ui-and-copy.md`](ui-and-copy.md). The recycle bin records who deleted
each item, which is worth knowing in a household with enthusiastic editors.

## The rule that matters most

**Your family will use this for real, and the data is precious.** Every
adventure, entry and photo in the live database is irreplaceable family
history. Test destructive flows only on scratch data you create yourself,
and clean it up afterwards (database rows *and* storage objects).

Keep your own master photo archive somewhere else. The app never
destructively modifies an original in Supabase Storage — derivatives are
written alongside — but it is a diary, not a backup. See
[`backup-and-restore.md`](backup-and-restore.md).

## What exists today

- **Diary** — trips (internally `adventures`) containing dated entries, with
  edit, soft delete and an admin recycle bin that restores or permanently
  deletes. Markdown rendering in entry bodies.
- **Photos and video** — resumable phone uploads, galleries with a
  full-screen viewer, captions, alt text, reordering, cover selection. MP4
  video with poster frames and web-sized copies.
  See [`photos-and-video.md`](photos-and-video.md).
- **Maps and journeys** — entries geocode to coordinates, consecutive stops
  form journey legs decorated by travel mode, and car and bus legs follow
  real roads. Journeys start from the home location set in Settings.
  Geocoding and routing need `GEO_CONTACT_EMAIL`. Maps render with Google
  Maps when both `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` and
  `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` are set, and with Leaflet otherwise
  (Esri tiles with `NEXT_PUBLIC_ARCGIS_API_KEY`, OpenStreetMap without).
  See [`maps-and-journeys.md`](maps-and-journeys.md).
- **Travel legs** — a lightweight entry kind for recording one hop of a
  multi-leg journey, rendered compactly in the diary feed.
  See [`maps-and-journeys.md`](maps-and-journeys.md).
- **Future trips and planning** — itineraries of bookings (with attached
  PDF confirmations and tickets) and trip ideas. Signed-in only. Two
  optional extras appear only when their key is set: AI research search
  (`AI_GATEWAY_API_KEY`, via Vercel AI Gateway) and Tripadvisor ratings on
  saved ideas (`TRIPADVISOR_API_KEY`). See [`future-trips.md`](future-trips.md).
- **Sharing** — revocable, optionally expiring links covering either one
  trip or the whole app, each nameable after whoever holds it, with the URL
  re-copyable any time after creation. See [`sharing.md`](sharing.md).
- **Filtering** — trip type and year dropdowns narrow the trip list, on the
  home page and the shared index (`src/lib/adventure-filters.ts`, tested).
- **Reactions** — a small emoji set on entries and individual photos,
  read-only for share visitors.
- **PWA** — manifest and icons so it installs on a phone home screen.

## Where to look

- [`AGENTS.md`](../AGENTS.md) — the router. Read it first; it maps each
  kind of task to the doc below.
- [`SETUP.md`](../SETUP.md) — installing the app: Supabase project,
  migrations, storage buckets, environment variables, first admin account.
- [`architecture.md`](architecture.md) — code layout, commands, tests and
  framework traps.
- [`backend-supabase.md`](backend-supabase.md) — schema, RLS, storage,
  migrations, soft delete.
- [`photos-and-video.md`](photos-and-video.md) — upload handshake,
  derivatives, processing scripts, bulk import.
- [`maps-and-journeys.md`](maps-and-journeys.md) — geocoding, road routes,
  home origin, journey legs.
- [`future-trips.md`](future-trips.md) — itineraries, ideas, research
  search, Tripadvisor.
- [`sharing.md`](sharing.md) — tokens, scopes, what a visitor may see.
- [`ui-and-copy.md`](ui-and-copy.md) — UK English, tone, palette, card
  patterns.
- [`backup-and-restore.md`](backup-and-restore.md) — keeping a copy of
  everything, and getting it back.
- [`porting.md`](porting.md) — adapting the app for your own family or
  another host.
- `git log` — the authoritative record of what changed and when.

All environment variables, required and optional, are listed with what each
one does in `frontend/.env.example`.
