# Awaydays: start here (for coding agents and humans)

A private, mobile-first family diary for holidays, day trips and events:
phone photo uploads, journey maps, revocable read-only sharing with
relatives and a planning layer for trips that haven't happened yet. The
app calls itself "Holidays" in its own UI.

**This file is a router.** Read it, then [`docs/overview.md`](docs/overview.md),
then the doc for your task from the table below.

## If you are installing it

Follow [`SETUP.md`](SETUP.md) top to bottom. It is written as a runbook
an agent can execute, with the steps only a human can do (creating
accounts, generating keys) clearly marked. Never paste keys into chat or
into any file other than `frontend/.env.local`.

## If you are changing it

| If the task is about… | Read |
|---|---|
| **Orientation**: what the app is, what exists today | [`docs/overview.md`](docs/overview.md) |
| **Code layout, commands, framework traps** (Next 16, Uppy, Leaflet, Turbopack, tests) | [`docs/architecture.md`](docs/architecture.md) |
| **Database, RLS, storage, migrations** (schema, buckets, soft delete, PostgREST join trap) | [`docs/backend-supabase.md`](docs/backend-supabase.md) |
| **Photos or video** (upload handshake, derivatives, processing scripts, importing a folder) | [`docs/photos-and-video.md`](docs/photos-and-video.md) |
| **Maps, journeys, travel legs** (geocoding, road routes, home origin, Google vs Leaflet) | [`docs/maps-and-journeys.md`](docs/maps-and-journeys.md) |
| **Future trips, itineraries, planning, research search** | [`docs/future-trips.md`](docs/future-trips.md) |
| **Sharing with relatives** (tokens, scopes, what a visitor may see) | [`docs/sharing.md`](docs/sharing.md) |
| **Any user-facing text or screen** (UK English, tone, amber/stone palette, card patterns) | [`docs/ui-and-copy.md`](docs/ui-and-copy.md) |
| **Backup and restore** | [`docs/backup-and-restore.md`](docs/backup-and-restore.md) |
| **Porting to a different stack** (what depends on Supabase, what's already swappable) | [`docs/porting.md`](docs/porting.md) |

## Three rules that override convenience

- **The data is precious.** This app holds a family's irreplaceable
  photos and diary. Test destructive flows only on scratch data you
  create and clean it up afterwards: database rows *and* storage
  objects. Originals in storage are never modified.
- **Never edit an applied migration.** Add a new timestamped file in
  `supabase/migrations/` and apply it to the database, so disk and
  database always agree.
- **Verify in the browser, then run the checks, before every commit.**
  From `frontend/`:
  `npx tsc --noEmit && npm run lint && npm run test && npm run build`

## Framework traps, in one line each

Detail in [`docs/architecture.md`](docs/architecture.md).

- **Next.js 16 differs from your training data.** Read
  `frontend/node_modules/next/dist/docs/` when unsure. The middleware
  file is `proxy.ts`; `params`, `searchParams` and `cookies()` are async.
- **Uppy v5** has no React `<Dashboard>`; mount the plugin in `useEffect`.
- **Leaflet and Google Maps are client-only**, always through the
  dynamic `ssr:false` wrappers (`MapPanel`, `JourneyMapPanel`).
- **Turbopack** occasionally corrupts state after installing packages;
  delete `frontend/.next` and restart.
- **Supabase keys** use the newer `sb_publishable_` / `sb_secret_`
  format. Sessions verify locally against asymmetric JWT signing keys
  (the default on new projects); legacy HS256 projects still work but
  cost an Auth call per request.
- **Every env var** is documented in `frontend/.env.example`; add new
  ones there in the same change.

## Keeping the docs honest

When you learn, change or decide something durable, edit the relevant
`docs/` file in the same change. Docs are organised by subsystem so they
get edited in place, not appended to.
