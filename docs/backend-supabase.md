# Backend: Supabase schema, security and migrations

Awaydays runs on a single Supabase project: Postgres for data, Supabase
Auth for sign-in and Supabase Storage for photos and video. Credentials go
in `frontend/.env.local` (gitignored), using the variable names in
`frontend/.env.example`. **Never commit them and never paste them into
chat.**

## Tables

| Table | Purpose |
|---|---|
| `profiles` | One per user. `role` is `admin` or `editor` |
| `adventures` | A trip. Slug, type (`holiday`/`day_trip`/`event`), date range, location + coordinates, `cover_media_id` |
| `entries` | A diary entry within a trip. See columns below |
| `media` | A photo or video belonging to an entry |
| `upload_sessions` | Upload idempotency, keyed on `(user_id, client_upload_id)` |
| `share_links` | Share links: SHA-256 token hash (what resolution matches on), the raw token so URLs can be re-copied and an optional `label` naming who holds the link; see [`sharing.md`](sharing.md) |
| `reactions` | Emoji on an entry or a single media item |
| `family_settings` | Single row (`id boolean primary key default true`) holding the household's home: `home_location` plus coordinates. Admin-only update |
| `itinerary_items` | A booking on a trip's itinerary (train, hotel, …). Signed-in only, never on share pages; see [`future-trips.md`](future-trips.md) |
| `trip_ideas` | A thing-to-do on a trip, added by hand or saved from a research search. Signed-in only; see [`future-trips.md`](future-trips.md) |
| `itinerary_documents` | A PDF attached to a booking (confirmation email, tickets). Signed-in only; see [`future-trips.md`](future-trips.md) |

Columns on `entries` worth knowing:

- `kind`: `diary` or `travel`. Travel legs render compactly in the feed.
- `travel_mode`: car / bus / train / plane / ferry / hovercraft / walk. It
  describes the leg that **arrives at** this entry.
- `latitude` / `longitude`: set by geocoding the `location` field.
- `route_geometry` / `route_km`: cached OSRM road route for car and bus legs.
- `status`: `draft` or `published`. Share pages only serve `published`.

Columns on `media` worth knowing: `thumbnail_path`, `display_path`,
`large_path` (WebP derivatives), `duration_seconds` and `web_video_path`
(video only), `processing_status`, `sort_order`, `caption`, `alt_text`.

## Security

Row Level Security is enabled on every table. The helper functions
`is_family_member()` and `current_user_role()` are `SECURITY DEFINER`.
`record_share_view()` increments a share link's view count atomically; it
is callable only through the service role (revoked from anon and
authenticated).

Soft delete is universal: `deleted_at` plus `deleted_by` (cleared again on
restore, so the bin can show who deleted something and when). Every query
that lists live data filters `deleted_at is null`. Hard delete is
admin-only through the bin and **must also remove the storage objects**,
otherwise the storage audit will flag orphans.

### Auth keys: check these on a fresh project

Sessions are verified locally. `proxy.ts` and `/api/media` call
`supabase.auth.getClaims()`, which checks the session JWT's signature
against the project's cached public key (JWKS), with no Auth server round trip
per page view or image. That local check needs the project to sign JWTs
with **asymmetric keys (ECC P-256)**, the default on new projects. On a
legacy project still using a shared HS256 secret, `getClaims()` falls back
to a network `getUser()` call, so sessions still work but every page view
and image costs an Auth round trip. Migrate the key to get the fast path.
`auth.getUser()` remains in server actions, where a fresh server-side
check per mutation is fine.

Before first run, confirm in the Supabase dashboard:

- **Project Settings → JWT keys** shows an asymmetric (ECC P-256) key.
  Newly created projects do; only an older project on a legacy shared
  secret needs migrating there.
- **Project Settings → API**: the app authenticates with the new key
  format: `sb_publishable_…` in `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and
  `sb_secret_…` in `SUPABASE_SECRET_KEY`. Do not use the legacy
  `anon`/`service_role` JWT keys; Supabase is retiring them.

Leaked-password protection in Supabase Auth is an optional setting the app
does not depend on either way.

## Storage

Two private buckets:

- `family-originals`: exactly what was uploaded, never modified.
- `family-derived`: WebP `thumb`/`display`/`large` plus web-sized video
  copies, written by `photos:process` and `videos:process`.

Object keys follow
`adventures/<adventureId>/entries/<entryId>/<mediaId>/original.<ext>` and
derivatives sit alongside as `<name>.webp`. Bulk imports use the same
convention so imported photos are indistinguishable from app uploads.
Booking PDFs (`itinerary_documents`) also live in `family-originals` (the
bucket accepts `application/pdf`) under
`adventures/<adventureId>/plan-items/<itemId>/<documentId>/original.pdf`,
served signed-in-only via `/api/plan-doc/[id]`; `verify-photos.mjs` and
the adventure hard-delete both know about these paths.

Images and video are served through `/api/media/[id]?size=` when signed in
or `/share/[token]/photo/[mediaId]` for visitors. Both prefer the permanent
derivative and fall back to a transformed signed URL.
**Never expose originals on a shared page.**

Both routes answer with a 307 redirect to a signed storage URL and cache
that redirect (signed-in: `private`, 12 h for a permanent derivative and
30 min for the transformed fallback; shared: 30 min in the browser plus 1 h
at the edge) with signed URLs that outlive the cache window (24 h).
Accepted trade-off: a deleted photo can stay viewable for up to the cache
window. `/api/media` is excluded from the `proxy.ts` matcher because the
route enforces auth itself; gating it twice would just add a second Auth
round trip per image.

## Migrations

The schema lives in `supabase/migrations/`. A fresh checkout has one file,
`20260903120000_initial_schema.sql`: the complete schema (tables, RLS,
helper functions, storage buckets and their policies) squashed into a
single migration. Applying it to an empty Supabase project gives you
exactly what the app expects. Every later schema change arrives as a
separate, later-dated file in the same directory.

Apply migrations with whichever you prefer: the Supabase CLI
(`supabase db push`), the dashboard's SQL editor or an MCP tool that
applies migrations. Whatever you use, the files on disk and the hosted
database must agree.

**Never edit a migration that has already been applied.** Add a new one.

This also applies to **data repairs**, not just schema. A migration file is
the sanctioned route for a one-off data fix: it is reviewable and it is
recorded.

**But know the boundary: a data *repair* is not data *content*.** A repair
accompanies the schema (reclassifying existing rows when a new column
arrives, say) and must run wherever the schema does. Trip content (entries,
diary text, summaries, covers, travel legs) is **user data**: it
goes in through the importer (`frontend/scripts/import-folder.mjs`) or the
app and **never gets a migration**. Content migrations reference rows the
importer created, so they crash with foreign-key errors on any fresh
database and break the whole replay chain. When back-filling a trip needs
bulk text, put it in the importer run or a throwaway script, not the
migration chain.

## Query traps

**`media` ↔ `adventures` joins are ambiguous** because two foreign keys
connect them (`media.adventure_id` and `adventures.cover_media_id`).
Embedding adventures from media must name the key explicitly:

```
adventures!media_adventure_id_fkey!inner(...)
```

Without it PostgREST rejects the whole query and the symptom is usually an
empty list rather than a visible error.
