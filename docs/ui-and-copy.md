# UI and copy conventions

Read this before writing any user-facing text or building any screen.

## Words

- **UK English throughout.**
- Warm and plain. Assume a capable teenager is reading as well as the
  adults: no baby talk, no jargon either.
- The app says **"trip"** to users. Internally the routes, types and database
  tables remain `adventures` — that split is deliberate and stays, because
  renaming the schema would risk live data for no user benefit.
- The wordmark in the header is **"Holidays"**. Awaydays is the project
  name, not a UI string.
- Sentence case for buttons and headings.

## Line breaks always survive

If somebody presses Enter in a text box, they see a line break where they put
it. No exceptions, and no asking your family to learn Markdown.

Two mechanisms, depending on the field:

- **Diary bodies and trip summaries** go through `RichText` (via `EntryBody`
  for diary text), which runs react-markdown with `remark-gfm` **and
  `remark-breaks`**. Markdown on its own joins consecutive lines into one
  paragraph; `remark-breaks` makes a single newline a `<br>`, and a blank
  line still starts a new paragraph.
- **Plain-text fields** — travel-leg notes, photo captions — render inside a
  `<p>` with **`whitespace-pre-line`**. HTML collapses raw newlines to spaces
  without it, which is exactly how a carefully paragraphed trip summary
  turns into one unbroken block.

Two deliberate exceptions:

- **Entry itinerary** keeps `whitespace-pre-wrap`, not `pre-line`, because a
  schedule is often typed with aligning spaces that should be preserved.
- **Clamped card teasers** (home page, shared index, the entry excerpt on a
  trip feed) stay flat. They are a taste of the text, not the text, and a
  blank line would eat one of the two or three lines on offer.

Adding a new place where a family's own words are displayed? Pick one of
the two mechanisms above.

## Linking one trip to another

Write the link in the trip **summary** as ordinary Markdown —
`[Lakeside Weekend](/adventures/lakeside-weekend)`. The summary sits at the
top of the trip page, which is where a reader looks for "this connects to
that trip"; a link buried in a diary entry is effectively invisible, because
the trip feed clamps entry bodies to a flat two-line teaser.

Two things happen automatically, and both matter:

- **Share visitors** browse under `/share/<token>`, so `RichText` rewrites
  the link through `sharedTripHref`. A whole-app share follows it inside its
  own token; a **single-trip share keeps the words and drops the link**,
  because that visitor has no access to the other trip and a bare
  `/adventures/...` would land a relative on the sign-in page.
- **Card teasers** run the summary through `teaserText`, which reduces link
  syntax to its text, so raw `[...](...)` can never show through the clamp.

Remember the split: summaries live in the database, so adding a link takes
effect on the live site immediately, while any rendering change needs a
deploy. Ship both together.

## Look

- **Amber and stone** Tailwind palette. Amber is the action colour (buttons,
  journey lines, travel cards); stone is structure (borders, title strips,
  page background).
- **Mobile first.** Every layout is designed for a phone held one-handed and
  then allowed to grow, never the reverse. Verify at phone width before
  calling anything done.
- Touch targets stay comfortable — action buttons are full-width or
  generously padded rather than small icons.

## Established patterns

Reuse these rather than inventing a variant.

**Diary event card** — a neutral stone title strip (date · location · author,
then the title) above the photo collage, a visible two-pixel outer border,
then journey banner, excerpt, photo count and a rounded amber "View entry"
action below.

**Trip card** (home page and shared index) — large cover image, type and
date range, title, summary, a small entry/photo count line, finishing with a
full-width amber "Open trip" action.

**Travel leg** — amber-tinted, lighter weight than an event card, because a
leg is connective tissue rather than a memory. One leg is a slim strip; a run
of them is a single chained card. See
[`maps-and-journeys.md`](maps-and-journeys.md).

**Photo viewer** — full-screen with the photo edge-to-edge on phones.
Controls never cover the picture on mobile: previous/next sit in a strip
below the photo beside the count, with caption and reactions above them;
desktop keeps floating side arrows in the empty space beside the image.
Photos support pinch, double-tap and drag-to-pan zoom (hand-rolled pointer
events in `Gallery.tsx`), swapping to the 2400px derivative once zoomed;
swipe steps between photos only when unzoomed. A one-line hint advertises
the gestures. The in-entry thumbnail grid deliberately stays a compact
3-across index — tapping through is the "see it properly" path.

**Header** — compact on mobile: text-only "Holidays" wordmark, then + Trip,
Map and Settings. Recycle bin and sign out live inside Settings rather than
cluttering the header.

## Failure messages

Say what happened and what to do, in the same warm register as the rest of
the app. The geocode notice is the model: "Saved — but that place couldn't be
found on the map, so this day isn't on the journey yet. Edit it and try a
fuller place name." Never surface a raw error string to users.
