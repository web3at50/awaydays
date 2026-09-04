# Maps, journeys and travel legs

## Coordinates

Trips and entries both carry `latitude`/`longitude`, geocoded from their
`location` text through Nominatim on every save (`src/lib/geocode.ts`).

Geocoding is deliberately best-effort: a 4-second timeout, and a failure
writes nothing so existing coordinates survive. **It never blocks a save.**
When a location was given but could not be placed, the save redirects with
`?geocode=failed` and the page shows an amber notice — a stop silently
missing from the map is the single most confusing failure the app can
have, because the journey quietly draws a straight line past it.

`npm run geocode:backfill` fills in rows that have a location but no
coordinates.

> **Trap: ambiguous place names.** Every save re-geocodes the location
> text, and Nominatim returns its single best hit — which for an
> ambiguous name can be the wrong namesake. A bare village name can
> resolve to a hill, river or hamlet of the same name 150 km away, so one
> phone edit can silently move a pin and draw a phantom journey.
> Disambiguate location text on anything with a common or duplicated
> name ("Kendal, Cumbria" rather than "Kendal"), and if a pin looks right
> today, check the text would geocode back to the same place tomorrow.
> Made-up labels ("The cabin, Kendal") are safe: no hit means coordinates
> survive.

`/map` shows every entry pin across all trips; each trip page shows its
own mini-map, and entry pages draw the animated, pannable single-leg
journey map. The plan page's Ideas map also renders through `MapPanel`,
with `clickablePois` letting Google's own place icons open their info
cards — diary maps keep those off. See
[`future-trips.md`](future-trips.md).

## Map rendering: Google Maps, with Leaflet as the fallback

Maps render through the Google Maps JavaScript API via
`@vis.gl/react-google-maps` — the familiar Google look, smooth vector zoom
on phones, English labels (`language="en"`, `region="GB"`). The switch
lives in the thin wrappers `MapPanel.tsx` / `JourneyMapPanel.tsx`:
`GOOGLE_MAPS_ENABLED` in `src/lib/google-maps.ts` is true only when
**both** `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` and
`NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` are set, and then they render
`GoogleAdventureMap` / `GoogleJourneyMap`. Without them — or if the Maps
script fails to load (ad blockers, outages) — they fall back to the
Leaflet components (`AdventureMap` / `JourneyMap`) on the tiles described
below. **Rollback is deleting the env vars.** Pure geometry shared by both
renderers (pin spreading, arcs, distance resampling, bounds padding) lives
in `src/lib/map-geometry.ts` so the two cannot drift.

Google specifics (config in `src/lib/google-maps.ts`):

- **The key is public by design** — it ships in the client bundle — so its
  protections live in the Google Cloud console, not in the app. Lock it
  down before you deploy:
  - **Application restriction:** HTTP referrers, listing your own
    domain(s) and `localhost:3000` for development.
  - **API restriction:** the Maps JavaScript API only.
  - **Quota cap:** under the Maps JavaScript API's quotas, cap **Map loads
    per day** so the monthly free tier can never be exceeded. Worked
    example: 300 loads/day × 31 days ≈ 9,300, under the 10,000 free
    Dynamic Maps loads a month, so the bill is zero by arithmetic. A
    family diary uses a small fraction of that.

  One load is billed per `<Map>` mount; pages render one map each, so do
  not introduce per-card maps without remembering the cap. If Places or
  Routes features are added later, each is a separate SKU with its own
  free tier — cap its quota the same way.
- **The Map ID** is created in the Google Cloud console under Map
  management (JavaScript, vector) and goes in
  `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`. It is required for `AdvancedMarker`
  and selects the vector renderer. Map IDs are not secrets, but every
  installation needs its own.
- Geocoding and routing send `GEO_CONTACT_EMAIL` in their User-Agent (the
  Nominatim and OSRM usage policies require a contact). Without it both
  are **skipped entirely** with a one-off server warning — the app works,
  but entries get no coordinates, so no pins or journeys. Set it in
  `.env.local` and in your host's environment. See
  `src/lib/geo-contact.ts`; the scripts use `geoUserAgent()` from
  `scripts/lib.mjs` and refuse to run without it.
- The Maps API has no dashed-polyline option; dashed legs are a repeated
  short line-symbol in the polyline's `icons` with the base stroke
  transparent (`journeyLineOptions`).
- Nominatim geocoding and OSRM road routing are **deliberately kept** even
  when Google renders the map — Google's terms only allow caching their
  geocodes for 30 days and the app stores coordinates for ever. Do not
  switch geocoders.

## The fallback basemap: Esri tiles in English, or OpenStreetMap

The Leaflet fallback uses Esri's ArcGIS Static Basemap Tiles service
(`arcgis/streets` style with `language=en`) when `NEXT_PUBLIC_ARCGIS_API_KEY`
is set, because plain OpenStreetMap tiles label every place in its local
language. The shared config lives in `src/lib/map-tiles.ts`; both Leaflet
map components import it, and it **falls back to OpenStreetMap tiles when
the key is missing**, so maps never go blank.

The ArcGIS key is public by design — it appears in every tile URL — so its
protections live in your ArcGIS Location Platform account: scope the key
item to basemap tiles only, referrer-lock it to your own domain(s) and
`localhost:3000`, and leave pay-as-you-go disabled so overuse stops serving
rather than billing. The free tier is 2M tiles a month; a family's usage is
a few thousand.

> **Trap: ArcGIS keys expire** — they last at most a year. Set a reminder;
> when it falls due, generate a new key from the same key item in the
> ArcGIS portal and update the env var locally and in your host. It only
> bites when the Google path is off, but a fallback with foreign-language
> labels is not much of a fallback.

Esri's URL puts row before column (`{z}/{y}/{x}`) and serves 512px images
on the standard grid — Leaflet's default 256px boxes display them
retina-crisp.

## Journeys are derived, never stored

`src/lib/journeys.ts` is pure logic with no I/O. Sort a trip's located
entries chronologically; each consecutive pair **5 km or more** apart is a
leg. Anything closer is walking into town or geocoder jitter, not a journey.

```
journeyToEntry(entries, entryId, origin?) -> JourneyLeg | null
```

`origin` is the family home from `family_settings`
(`getHomeOrigin` in `src/lib/settings.ts`), which lets the **first** located
entry of a trip have a leg — drawn from home. When home is unset or
ungeocoded `getHomeOrigin` returns `null` and the first leg is simply
skipped. Home is admin-editable in Settings, and unlike an entry a geocode
failure there *does* block the save, because a home that is not on the map
would break every trip's first leg.

Because home is a setting, **no "setting off from home" filler entries are
needed**.

`travel_mode` decorates the leg that **arrives at** the entry carrying it,
and picks the emoji shown on the line.

## Road routes

Car and bus legs get real road geometry and road miles from OSRM
(`src/lib/route.ts`), cached on the arriving entry as
`route_geometry`/`route_km` and drawn as a solid line. Everything else —
train, plane, ferry, hovercraft, walk — keeps a dashed straight arc, because
there is no free rail or air routing service worth relying on.

Routing follows the same best-effort rules as geocoding: 5-second timeout,
failure keeps whatever was cached, geometry downsampled to 400 points.
`refreshAdventureRoutes` recomputes a whole trip whenever an entry is saved,
deleted or restored, since any change can rewire which entry follows which.
`npm run routes:backfill` does the same across every trip.

## Travel legs

A leg is a normal entry with `kind = 'travel'`. Everything — maps, journeys,
photo uploads, reactions — keeps working; only the feed rendering differs.

Record one with **+ Leg** on a trip page
(`/adventures/[slug]/entries/new-leg`, action `createTravelLeg`). It asks
three things — where you got to, how, and the date — plus optional notes,
and titles itself `From → To` using the previous located stop, or home when
it is the trip's first.

In the feed, `TravelLegCards` renders photo-less legs compactly:

- a single leg becomes a slim `JourneyBanner` strip;
- **consecutive** legs collapse into one chained "Travelling" card listing
  every stop with per-leg distances and a total;
- **adding photos promotes a leg back to a full event card**, so a journey
  worth remembering looks like any other diary event.

The same rendering is used on signed-in and shared pages.

## The entry-per-stop rule

This is the thing that most often makes a map wrong, and it matters
especially when reconstructing an old trip from photos.

**A leg is drawn between consecutive located entries, so an entry's
`location` must be where that leg arrives.** The title alone does nothing.
Titling an entry "Kendal to London" but setting its location to Kendal
silently collapses the London hop: the next leg is drawn from Kendal
straight to wherever the following entry is, say Paris, and London never
appears on the map.

Door to door means an entry per station and airport, on the way home as well
as out. The + Leg form enforces this by always asking for the destination.

Same-day ordering falls back to `created_at`, so several legs entered on one
date appear in the order they were typed. Enter them in travel order.
