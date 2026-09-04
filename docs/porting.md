# Porting Awaydays to a different stack

Awaydays is deliberately built on one stack (Supabase for auth, database
and storage, Next.js for everything else) and the main repository will
stay that way. Nobody is stopped from taking it somewhere else, though:
that's what the MIT licence is for. This page is the map for anyone (or
anyone's coding agent) doing that in a fork.

## The short version

- **Supabase is load-bearing.** Replacing it means replacing auth,
  storage, resumable uploads and every database query. It is a real port,
  not a configuration change.
- **Hosting is not load-bearing.** The frontend is ordinary Next.js and
  runs anywhere Next.js runs. Vercel is just the documented path.
- **The external services are already single-function swaps.** Geocoding,
  routing, research search and Tripadvisor each live behind one function.

If your objection to Supabase is "I don't want a cloud account", note that
Supabase is itself open source and can be self-hosted with Docker. That is
far less work than a port.

## What touches Supabase

Everything below would need replacing or reworking.

| Area | Where | What it relies on |
|---|---|---|
| Auth | `src/proxy.ts`, `src/app/api/media/[id]/route.ts`, every server action in `src/lib/*-actions.ts` and `src/lib/actions.ts` | `@supabase/ssr` cookie sessions; `auth.getClaims()` verified locally against the project's JWKS; `auth.getUser()` in mutations |
| Clients | `src/lib/supabase/{server,client,admin}.ts` | Three clients: server (cookie session), browser and the service-role admin client used for share pages and scripts |
| Data access | every page and action that calls `.from(...)` | PostgREST query builder, including embedded joins such as `adventures!media_adventure_id_fkey!inner(...)` |
| Authorisation | `supabase/migrations/` | Row-level security policies and the `is_family_member()` / `current_user_role()` helper functions. Without RLS the service-role and user clients are equivalent, so a port must rebuild authorisation in the application layer |
| Storage | `src/lib/actions.ts` (upload handshake), `src/app/api/media/[id]/`, `src/app/share/[token]/photo/[mediaId]/`, `src/app/api/plan-doc/[id]/`, `scripts/*.mjs` | Private buckets `family-originals` and `family-derived`; signed URLs with 307 redirects; object keys `adventures/<adventureId>/entries/<entryId>/<mediaId>/original.<ext>` |
| Resumable uploads | `src/components/UploadManager.tsx` | Uppy's TUS plugin pointed at Supabase Storage's TUS endpoint, authenticated with the user's session |
| Share view counting | `record_share_view()` in the migrations | A `SECURITY DEFINER` function callable only through the service role |

A port to, say, Postgres + your own auth would keep the schema (it is plain
Postgres) but replace the query builder calls, the RLS-backed
authorisation, the session handling and the storage layer.

## What is already swappable

Each of these wraps one external service in one function that returns
"result or null". Swap the function body; nothing else notices.

| Service | File | Contract |
|---|---|---|
| Geocoding (Nominatim) | `src/lib/geocode.ts`, `geocodeLocation()` | text → `{ latitude, longitude }` or null |
| Road routing (OSRM) | `src/lib/route.ts`, `fetchDrivingRoute()` | two points → `{ points, km }` or null |
| Research search (Vercel AI Gateway) | `src/lib/plan-search.ts`, `searchPlaces()`, `deepDive()` | query → typed suggestions / Markdown or a friendly error |
| Venue ratings (Tripadvisor Terra) | `src/lib/tripadvisor.ts`, `lookupTripadvisor()` | name + town → match or null |
| Map rendering | `src/components/MapPanel.tsx`, `JourneyMapPanel.tsx` | Google Maps when configured, Leaflet otherwise; geometry shared in `src/lib/map-geometry.ts` |
| Map tiles for Leaflet | `src/lib/map-tiles.ts` | Esri with a key, OpenStreetMap without |

The AI search uses the `ai` package's gateway provider. Pointing it at a
different model provider is a change inside `plan-search.ts` only.

## What is plain, portable Next.js

Everything else: pages, components, the pure helpers in `src/lib` (which
have tests), the Markdown rendering, the PWA manifest. The only
Vercel-specific line in the codebase is `export const maxDuration = 90` on
the plan page, which other hosts ignore. To run elsewhere:

```bash
cd frontend
npm ci
npm run build
npm run start   # listens on 3000; put it behind your reverse proxy
```

Or wrap that in a container. Environment variables are the same as
`frontend/.env.example`.

## A note on scope

Ports live in forks. Pull requests that add a second backend or an
abstraction layer to the main repository will be declined, not because
the work is bad, but because keeping one stack simple is the whole point
here. See `CONTRIBUTING.md`.
