# Awaydays

A private, mobile-first diary of your family's holidays, day trips and
days out. Everyone adds entries and photos from their phones while you're
away; the app draws the journey on a map and you can share a read-only
copy with the grandparents through a link you can revoke any time.

It started as one family's app and still is. It's just open now, so
yours can have one too.

<p align="center">
  <img src="docs/screenshots/holiday.webp" width="195" alt="A trip page on a phone: cover photo, dates, summary and the journey from home drawn on Google Maps with train legs" />
  <img src="docs/screenshots/trip.webp" width="195" alt="Another trip page: cover photo, dates and the whole journey drawn on Google Maps" />
  <img src="docs/screenshots/entry.webp" width="195" alt="A diary entry: the travel leg from the last stop with its road route on Google Maps, the day's text and the photo gallery" />
</p>

<p align="center">
  <img src="docs/screenshots/plan-itinerary.webp" width="195" alt="The plan page: a Eurostar booking and a hotel booking with its PDF confirmation attached" />
  <img src="docs/screenshots/plan-ideas.webp" width="195" alt="Saved ideas with Tripadvisor rating bubbles, walking distance from the hotel plus Maps, Google and Tripadvisor links" />
  <img src="docs/screenshots/plan-research.webp" width="195" alt="The research search: results for christmas markets and chocolate shops, each with a Save to ideas button" />
  <img src="docs/screenshots/plan-ideas-map.webp" width="195" alt="The Ideas map on Google Maps: the hotel and every saved idea pinned around Bruges" />
</p>

<p align="center">
  <img src="docs/screenshots/everywhere.webp" width="600" alt="The map of everywhere the family has been: one pin per diary entry across Europe on Google Maps" />
</p>

<p align="center"><sub>Top row: two trip pages and one entry, as the family sees them signed in. Middle row: planning a Christmas trip to Bruges; the bookings, hotel and PDF are invented. Bottom: the map of everywhere, one pin per entry. Google Maps, the ratings and the research search need the optional keys. Without them the maps fall back to Leaflet and the research box and ratings simply don't appear.</sub></p>

## What it does

- **Diary**: trips containing dated entries, with Markdown, soft delete and
  an admin recycle bin that restores or permanently deletes.
- **Photos and video**: resumable uploads straight from a phone, galleries
  with a full-screen pinch-to-zoom viewer, captions, reordering, cover
  photos. Video with poster frames and web-sized copies.
- **Maps and journeys**: every entry with a place gets a pin; consecutive
  stops become journey legs decorated by how you travelled, with car and
  bus legs following real roads. Journeys start from home.
- **Sharing**: revocable, optionally expiring links for one trip or the
  whole diary, each named after whoever holds it so you can see who's been
  looking. Visitors only ever see web-sized photos.
- **Planning**: future trips carry an itinerary (bookings, times, costs,
  PDF confirmations) and a list of ideas. Optionally, an AI research search
  that finds places near your hotel, plus Tripadvisor ratings on the things
  you save.
- **The small things**: emoji reactions, trip type and year filters,
  installs to a phone home screen as a PWA, UK English throughout.

## The stack and what's optional

This is an opinionated app. It does one thing well on one stack and it
doesn't try to be configurable beyond that.

| | |
|---|---|
| **Required** | [Supabase](https://supabase.com): auth, Postgres with row-level security, private storage. The free tier is plenty for a family. Supabase is open source, so you can self-host it instead if you prefer. |
| **Hosting** | Anywhere Next.js runs. [Vercel](https://vercel.com) is the documented path (Hobby tier, for personal use). |
| **Maps** | Google Maps if you give it a key, otherwise Leaflet. Works either way. |
| **Optional extras** | A [Vercel AI Gateway](https://vercel.com/ai-gateway) key for the research search; a [Tripadvisor](https://docs.terra.tripadvisor.com/) key for ratings; an ArcGIS key for English-labelled fallback tiles. Each feature simply doesn't appear without its key. |

Running cost for a typical family on free tiers: nothing. The setup guide
names the caveats (free Supabase projects pause when idle; storage quotas;
Google's free map loads and how to cap them so you can never be billed).

## Install with your coding agent

The whole thing is documented for agents. Clone it, open it in Claude
Code, Codex, Cursor or whatever you use and say:

> Follow SETUP.md and get this running for me.

The agent does the mechanical parts. You do the parts only a human should:
create the Supabase and Vercel accounts, generate the keys and paste them
into `frontend/.env.local` yourself. `SETUP.md` marks those steps clearly.

Prefer to drive? The same file is a perfectly good manual guide.

## Want a different stack? Fork it

Supabase is load-bearing; hosting is not. If you want Cloudflare, Firebase,
plain Postgres or anything else, the honest route is a fork.
[`docs/porting.md`](docs/porting.md) maps exactly what touches what so your
agent can do the port with its eyes open. The main repo stays single-stack
on purpose.

## Changing it

[`AGENTS.md`](AGENTS.md) is the entry point for working on the code and
the `docs/` folder is organised by subsystem. The check suite, from
`frontend/`:

```bash
npx tsc --noEmit && npm run lint && npm run test && npm run build
```

## Maintenance, honestly

This is a family app first. Improvements land in the family's private copy
and are synced here periodically. Issues are welcome, bug reports
especially. Feature ideas too. Pull requests are reviewed when they
arrive; see [`CONTRIBUTING.md`](CONTRIBUTING.md) for what to expect.

## Licence and security

MIT; see [`LICENSE`](LICENSE). To report a security problem privately,
see [`SECURITY.md`](SECURITY.md).
