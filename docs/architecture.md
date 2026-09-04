# Architecture — code layout, commands and framework traps

## Stack

Next.js 16 (App Router) + TypeScript + Tailwind v4 in `frontend/`, Supabase
for auth, Postgres and private storage, deployed to Vercel with the project
root directory set to `frontend`.

## Layout

```
frontend/src/
  app/(app)/        authenticated pages
  app/share/[token]/  public share pages (excluded from the auth proxy)
  app/sign-in/
  app/api/media/[id]/ authenticated image + video route
  app/api/plan-doc/[id]/ authenticated booking-PDF route
  proxy.ts          session refresh + auth gate
  lib/              server actions, domain logic, Supabase clients
  components/       React components
frontend/scripts/   maintenance scripts (Node, run locally against your Supabase project)
supabase/migrations/  SQL migrations
```

### `src/lib`

| File | What it holds |
|---|---|
| `actions.ts` | Server actions: trip/entry CRUD, travel legs, upload handshake, photo management, home location |
| `bin-actions.ts` | Recycle bin restore and permanent delete |
| `share-actions.ts`, `share.ts` | Share-link creation, token resolution, view counting |
| `reaction-actions.ts` | Emoji toggles |
| `journeys.ts` | Journey leg derivation (pure, no I/O) |
| `settings.ts` | `getFamilySettings` / `getHomeOrigin` — the journey origin |
| `geocode.ts` | Nominatim lookup, isolated on purpose |
| `route.ts` | OSRM road routing + `refreshAdventureRoutes`, isolated on purpose |
| `geo-contact.ts` | The Nominatim/OSRM User-Agent built from `GEO_CONTACT_EMAIL`; null (and both services skipped) when unset |
| `google-maps.ts` | Google Maps key, Map ID and the `GOOGLE_MAPS_ENABLED` switch (both must be set) |
| `map-tiles.ts` | Leaflet basemap tiles: Esri with `NEXT_PUBLIC_ARCGIS_API_KEY`, OpenStreetMap without |
| `map-geometry.ts` | Pure geometry shared by the Leaflet and Google renderers (pin spreading, arcs, vehicle pacing) |
| `gallery-preview.ts` | The "show at most N photos, then a +count tile" rule |
| `adventure-filters.ts` | Home-page type/year filter parsing, filtering and URL building (pure, tested) |
| `teaser.ts` | `teaserText` — reduces Markdown link syntax to plain words for clamped card teasers (pure, tested) |
| `plan.ts` | Future-trip helpers: wall-clock time slicing, day grouping, countdowns (pure, tested) |
| `plan-actions.ts` | Server actions for itinerary items, trip ideas and booking PDFs — see [`future-trips.md`](future-trips.md) |
| `plan-search.ts` | Research search via Vercel AI Gateway, isolated on purpose. Needs `AI_GATEWAY_API_KEY`; model from `PLAN_SEARCH_MODEL` |
| `tripadvisor.ts` | Tripadvisor Terra API lookup, wrapped in one function like `geocode.ts`. Needs `TRIPADVISOR_API_KEY` |
| `features.ts` | Which optional integrations have keys (`planSearchEnabled`, `tripadvisorEnabled`) — pages hide UI that can't work |
| `trip-counts.ts` | Entry/photo counts and their card label (pure, tested) |
| `shared-links.ts`, `shared-entry-order.ts` | Share-page URL building (`sharedTripHref`) and newest-first ordering |
| `dates.ts`, `slug.ts`, `types.ts` | Formatting, slugs, shared types |
| `supabase/{server,client,admin}.ts` | Supabase clients — `admin` is service-role, server-only |

`geocode.ts`, `route.ts` and `tripadvisor.ts` each wrap a single external
service in a single function. If Nominatim, OSRM or Tripadvisor ever
disappoint, swap the one function; everything else only sees "coordinates,
or null", "points + km, or null" and "a match, or null".

### `src/components`

Forms: `AdventureForm`, `EntryForm`, `TravelLegForm`, `HomeLocationForm`,
`SettingsPasswordForm`, `PasswordInput`, `ShareLinkCreator`, `ShareLinkUrl`
(copy + share-sheet buttons for stored share URLs), `TripFilterBar`
(type/year dropdowns on the home page and shared index).

Planning: `ItineraryItemForm`, `IdeaForm`, `PlanSearch` (the research
search box), `PlanDocuments` (PDFs on a booking), `CopyButton` (copies a
venue's name and address) — see [`future-trips.md`](future-trips.md).

Media: `UploadManager` (Uppy/TUS mount), `PhotoSection` (management),
`Gallery` (grid + full-screen viewer), `EntryCardPhotos` (feed collage).

Maps: `MapPanel` and `JourneyMapPanel` are dynamic `ssr:false` wrappers
holding the Google-vs-Leaflet switch; `GoogleAdventureMap` and
`GoogleJourneyMap` render via `@vis.gl/react-google-maps`, with
`AdventureMap` and `JourneyMap` as the Leaflet fallback. Every Leaflet
module imports `leaflet-defaults.ts`. See
[`maps-and-journeys.md`](maps-and-journeys.md).

Diary: `RichText` (Markdown with `remark-gfm` + `remark-breaks`, and
share-aware link rewriting), `EntryBody` (diary text through `RichText`),
`ReactionBar`, `TravelLegCards`, `JourneyBanner`, `SharedAdventureView`
(the entire public read-only diary) and `SharedEntryView` (one entry on a
share page).

Bin: `BinItemActions`, `DeleteButton`.

## Commands

Run everything from `frontend/`.

```bash
npm run dev              # dev server on port 3000
```

Required before every commit:

```bash
npx tsc --noEmit && npm run lint && npm run test && npm run build
```

Maintenance, all safe to rerun. They read `frontend/.env.local` and use the
secret key, so they talk to your live Supabase project — see
[`photos-and-video.md`](photos-and-video.md) and
[`backup-and-restore.md`](backup-and-restore.md) before running them for
the first time.

```bash
npm run photos:process -- --all     # WebP derivatives for new photos
npm run videos:process -- --all     # video posters + web-sized copies (needs ffmpeg)
npm run photos:verify               # storage/database consistency audit
npm run backup:storage              # download all originals to backups/
npm run geocode:backfill            # coordinates for rows that have a location but none
npm run routes:backfill             # OSRM road routes for existing car and bus legs
npm run icons                       # regenerate PWA icons
node scripts/create-user.mjs --email a@b.c --name "Name" [--role admin]   # auth user + profile (no public sign-up)
node scripts/check-setup.mjs        # read-only check of env, schema, buckets and admin (fresh installs)
```

Both media processors also accept `--adventure <id>` instead of `--all`, and
`--force` to redo work already marked ready. `scripts/import-folder.mjs` is
run directly with `node`, not through npm — see
[`photos-and-video.md`](photos-and-video.md).

## Tests

`npm run test` runs Node's built-in test runner over `src/lib/*.test.mjs`.
Coverage is the pure helpers only: `gallery-preview`, `shared-links`,
`journeys`, `adventure-filters`, `trip-counts`, `plan` and `teaser`.
Anything with I/O is verified in the browser instead. Add a test file here
when you add a pure helper.

## Framework traps

**Next.js 16 differs from training data.** Read
`frontend/node_modules/next/dist/docs/` when unsure rather than guessing.
Known differences: the middleware file is `proxy.ts`, not `middleware.ts`;
`params`, `searchParams` and `cookies()` are async; page files must not
export helper functions.

**Uppy v5** has no React `<Dashboard>` component — mount the
`@uppy/dashboard` plugin inside a `useEffect`. CSS imports are
`@uppy/*/css/style.min.css`, not `/dist/`.

**Leaflet is client-only.** Real map components must load through a dynamic
`ssr:false` wrapper, and every map module imports `leaflet-defaults.ts` for
the bundler marker-icon fix.

**Turbopack state corruption.** If the dev server starts returning 404 for
dynamic routes after installing packages, delete `frontend/.next` and
restart it.

**Supabase keys** use the newer format (`sb_publishable_` / `sb_secret_`),
not the legacy `anon` / `service_role` JWTs.

**Environment variables** are all listed, with what each one is for and
what happens without it, in `frontend/.env.example` (committed, names
only). Copy it to `frontend/.env.local` for local work, set the same names
in your host's environment for production, and add a new variable there in
the same change that introduces it.
