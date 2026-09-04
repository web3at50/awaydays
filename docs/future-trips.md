# Future trips — planning, itineraries and research

The signed-in planning layer. Nothing here appears on share pages.

## The model: a future trip is just an adventure

There is no separate "future trip" object. A trip is created as normal (an
`adventures` row) with its future dates; planning data hangs off it. When
the holiday happens, diary entries and photos land on the *same* trip — so
every past trip keeps its itinerary for ever as the record of how your
family travelled, where they stayed and what they planned. That is the
whole integration story with historical trips, and it falls out of the
data model for free.

## Screens

- **`/plans`** — the "Future trips" tab (header link "Plans"). Lists
  adventures whose `end_date` is today or later (London civil date, see
  `todayInLondon`), soonest first, with a countdown chip and booking/idea
  counts. Empty state points at + Trip.
- **`/adventures/[slug]/plan`** — one trip's planning page: itinerary
  grouped by day, the **Ideas map**, ideas list, manual idea form,
  research search. Reached from the tab or the "Plans" button on the trip
  page. The Ideas map pins the hotel and every idea with cached
  coordinates via the shared `MapPanel`; pin popups link out to Google
  Maps, and it passes `clickablePois` so Google's own place icons open
  their info cards — the "what's near us right now" view. It counts as
  one Google map load per visit (see the quota cap in
  [`maps-and-journeys.md`](maps-and-journeys.md)).
- **`/adventures/[slug]/plan/new-item`** and
  **`.../plan/items/[itemId]/edit`** — booking create/edit, with soft
  delete via the shared `DeleteButton`.

Code: `lib/plan.ts` (pure helpers, tested in `plan.test.mjs`),
`lib/plan-actions.ts` (CRUD server actions), `lib/plan-search.ts` (research
search), components `ItineraryItemForm`, `IdeaForm`, `PlanSearch`.

## Tables

`itinerary_items` — one booking: kind (train / flight / ferry / hotel /
car_hire / restaurant / activity / other), title, provider, booking
reference, wall-clock start/end, from/to (transport) or location (stays),
cost + currency, URL, free-text notes. `trip_ideas` — one thing to do:
title, category, description, URL, address, `source`
(`manual`/`exa`/`parallel`) and a `done` flag so after the trip the list
doubles as a record of what you actually did.
`itinerary_documents` — a PDF attached to a booking (see below). All three:
standard RLS (family read/write, admin hard-delete), `set_updated_at`
trigger, soft delete columns. All of it is in the single schema file under
`supabase/migrations/`.

## Documents on bookings (PDFs)

Each booking can carry PDF attachments — the confirmation email, tickets —
added from the **edit booking** page ("Documents" card, 20 MB cap, PDF
only) and shown as 📄 links on the plan page's booking cards. Rows live in
`itinerary_documents`; the bytes live in `family-originals` under
`adventures/<adventureId>/plan-items/<itemId>/<documentId>/original.pdf`
(the bucket accepts `application/pdf`).

The upload reuses the photo handshake philosophy in miniature
(`plan-actions.ts`): `registerPlanDocumentUpload` validates and returns an
object key, the browser sends the bytes **straight to storage** with the
plain supabase-js client (a server action would hit Vercel's ~4.5 MB
request-body cap), and `finalizePlanDocumentUpload` creates the row only
after checking storage actually has the object — recomputing the key
server-side rather than trusting the client. Serving is
`/api/plan-doc/[id]`: auth via `getClaims`, then a 307 redirect to a
24-hour signed URL, exactly like `/api/media`. Signed-in only — documents
are planning data and never appear on share pages.

Removal is the usual soft delete (`deletePlanDocument`). Like other
planning rows, documents don't appear in the recycle bin; the storage
object stays until an admin hard-deletes the trip (`bin-actions.ts` removes
document objects then), and `photos:verify` counts document paths as known
so they are never flagged as orphans.

## The wall-clock time rule

Itinerary times are **the local time printed on the ticket**, stored as if
UTC and never converted — a 09:15 departure and a 12:40 arrival in another
timezone are saved and shown exactly as typed, whatever timezone the server
or reader is in. `lib/plan.ts` therefore slices ISO strings textually
(`itineraryDayKey`, `itineraryTime`); nothing may pass these values through
`Date` timezone maths. The form's `datetime-local` values get `:00+00:00`
appended on save (`plan-actions.ts`).

## Research search (Vercel AI Gateway)

**Optional.** The research box appears on the plan page only when
`AI_GATEWAY_API_KEY` is set (`planSearchEnabled()` in `lib/features.ts`);
without it the page simply omits it. A Supabase-only installation is
complete.

`searchPlaces` in `lib/plan-search.ts` runs a model through the gateway —
`openai/gpt-5.6-luna` by default, overridable with the `PLAN_SEARCH_MODEL`
env var — with one of the gateway's server-executed search tools,
`gateway.tools.parallelSearch()` or `gateway.tools.exaSearch()` from the
`ai` package, and shapes the results into typed suggestions that can be
saved as ideas. Two buttons on the plan page, one per provider.

Two modes: **Find places** returns savable place cards; **Deep dive**
(`deepDive` action) researches one thing — reviews, prices, deals — and
returns a Markdown briefing with inline source links, rendered with
react-markdown and savable into the ideas list as a note
(`saveDeepDiveNote`, category `other`).

The prompt folds in the trip's hotel (first `hotel` itinerary item) when
the "Measure distances from where we're staying" tickbox is on (default),
so "near our hotel" works and descriptions mention walking distances. Each
suggestion separates the venue's **own website** (`url`) from the
tourist-guide page it was found on (`listing_url`, shown muted as "found
via <site>"). A copy **icon beside the venue name** copies "name, address"
for pasting anywhere; cards and saved ideas carry **Google Maps**,
**Google** and **Tripadvisor** links built by the pure helpers in
`lib/plan.ts` — on a phone at the destination, Maps opens against the
user's live location.

Itinerary items with a `location` are geocoded on save (same
semantics as entries — see `itineraryCoords` in `plan-actions.ts`), and
the hotel's coordinates plus each idea's Tripadvisor coordinates produce
the "🚶 ≈ 700 m · 9 min walk from the hotel" label on idea cards
(`walkFromHotelLabel`, haversine at 80 m/min, tested). Long saved
descriptions (deep-dive reports, > 350 chars) collapse to a three-line
teaser with a "Read the full report" expander, rendered as Markdown via
`RichText`; everything is `break-words`ed so long URLs can't cause
horizontal scroll on phones.

- **Auth/config**: `AI_GATEWAY_API_KEY` in `frontend/.env.local` locally
  and in your host's environment in production. No separate Exa or
  Parallel keys are needed — the gateway bills centrally and spend shows
  in the Vercel dashboard under AI Gateway.
- **Cost** (ballpark, at the time of writing): Parallel $5 per 1,000
  searches, Exa $7 per 1,000 (up to 10 results each; extra results $1 per
  1,000) — though both search tools sat on a gateway **free tier**, so
  only model tokens were billed. A whole search shows as **one** gateway
  request, because the search runs inside the model call and never gets
  its own log row.
- **Timeout trap**: a search takes ~20 s (a deep dive 40 s+) and Vercel's
  default function limit is 15 s, so production searches die while local
  ones work. The plan page sets `export const maxDuration = 90`; keep one
  on any page whose server action calls the gateway.
- The model is asked for a bare JSON array; `plan-search.ts` clips to the
  outermost `[...]`, validates with zod (unknown categories degrade to
  `other`), and returns friendly errors, never raw ones.
- Docs: <https://vercel.com/docs/ai-gateway/models-and-providers/web-search>.

## Tripadvisor (Terra API)

**Optional.** Tripadvisor enrichment and the "Get rating" button appear
only when `TRIPADVISOR_API_KEY` is set (`tripadvisorEnabled()` in
`lib/features.ts`). Tripadvisor's old Content API was replaced by
**Terra** (docs: <https://docs.terra.tripadvisor.com/>); a key on the
entry-level Discover plan is enough. Set it in `frontend/.env.local` and
in your host's environment (Production and Preview if you use both).

- **Billing is per location returned, not per call** — the first 1,000
  entities are free for the account's lifetime, then about $0.015 each at
  the time of writing. So `lib/tripadvisor.ts` always requests `size=1`
  (one entity per lookup) and the result is **cached on the `trip_ideas`
  row for ever** (`ta_location_id`, `ta_rating`, `ta_review_count`,
  `ta_icon_url`, `ta_url`, `ta_latitude`/`ta_longitude`, `ta_checked_at`).
  Never re-look up a row whose `ta_checked_at` is set.
- Enrichment runs automatically when an idea is saved (search results and
  manual adds; deep-dive notes are skipped — their titles are questions,
  not venues). Older rows get a "Get rating" button
  (`fetchTripadvisorRating`).
- The idea card shows Tripadvisor's own rating-bubbles image
  (`ta_icon_url`) — that satisfies their attribution rules — and the
  Tripadvisor link goes straight to the venue's page (`ta_url`) instead of
  their search. Tripadvisor sometimes knows the venue's official website;
  it back-fills `url` when the idea had none.
- Caveat: the lookup trusts Terra's top match anchored to the trip's town.
  It can occasionally hit a duplicate or newer listing with a handful of
  reviews rather than the main one — the link still lands on a real page,
  and a wrong match can be refreshed later if it grates.

## Deliberately not done (yet)

Importing bookings from forwarded emails; turning itinerary items into
travel legs when a trip completes; a share-the-itinerary toggle; a
conversational planning assistant; recycle-bin listing for planning rows
(they soft-delete, but the bin page doesn't show them).
