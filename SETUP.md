# Setting up Awaydays

A runbook. Work through it top to bottom; each stage ends with a check.
It is written so a coding agent can execute it, with two kinds of step:

- **🧑 Human** — creating accounts, generating keys, pasting secrets.
  An agent must stop and ask you to do these. Keys go into
  `frontend/.env.local` (and later your host's environment settings) and
  nowhere else — never into chat, never into any committed file.
- **🤖 Agent** — everything else.

Commands are shown for a POSIX shell (bash, zsh, Git Bash). On Windows
PowerShell the only difference is `Copy-Item` instead of `cp`; everything
else is identical. `frontend/.env.local` must live in `frontend/` — the
maintenance scripts read it from there, whatever directory you run them
from.

Total time on a quiet afternoon: about an hour, most of it in dashboards.

---

## 0. Prerequisites

- Node.js 22 or newer, and npm. (`package.json` declares this; the
  maintenance scripts use `process.loadEnvFile`, so on an older Node they
  fail at step 3 with `loadEnvFile is not a function` — upgrade Node.)
- A GitHub account (to clone; and Vercel deploys from a Git repo).
- A [Supabase](https://supabase.com) account. Free tier is fine.
- A [Vercel](https://vercel.com) account if you'll host there. Hobby tier
  is fine for personal, non-commercial use.
- Optional: `ffmpeg` on the machine that will process videos.

🤖 Clone and install:

```bash
git clone https://github.com/web3at50/awaydays
cd awaydays/frontend
npm ci                            # several minutes; audit/fund notices are normal
cp .env.example .env.local        # PowerShell: Copy-Item .env.example .env.local
```

✅ Check: `npm run test` passes (it needs no services).

---

## 1. Create the Supabase project

🧑 In the Supabase dashboard, **New project**. Pick a name, a strong
database password (you won't need it day to day) and the region closest
to your family. Wait for it to provision.

🧑 Then put four values into `frontend/.env.local`:

- **Project Settings → API → Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **Project Settings → API Keys** → the **publishable** key
  (`sb_publishable_…`) → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- Same page → the **secret** key (`sb_secret_…`) → `SUPABASE_SECRET_KEY`
- `GEO_CONTACT_EMAIL` → any email address you actually read. The
  geocoder (Nominatim) and road router (OSRM) are free community services
  whose usage policies require a real contact in each request. Without it
  the app runs but nothing gets a map pin, and the maintenance scripts
  refuse to run.

Use the newer key format shown above, not the legacy `anon` /
`service_role` JWTs.

🧑 **Glance at the JWT signing key.** Project Settings → **JWT Keys**
should show an ECC (P-256) key — a brand-new project does by default, so
this is a look, not a task. With an asymmetric key the app verifies
sessions locally with no Auth round trip; an older project still on a
legacy shared secret (HS256) still works, but pays an Auth call on every
page view and image until the key is migrated there.

✅ Check: the four values are in `.env.local`, and the key prefixes are
`sb_publishable_` and `sb_secret_`. (Step 2's check script confirms all
of this too.)

---

## 2. Apply the database schema

The whole schema — the eleven tables, row-level security, helper
functions, the two private storage buckets and their policies — is one
file: `supabase/migrations/20260903120000_initial_schema.sql`.

Apply it by whichever route suits you:

- 🧑 **SQL editor** (simplest): paste the file's contents into **SQL
  Editor** in the dashboard and run it.
- 🤖 **Supabase CLI**: from the repo root — `supabase login`, then
  `supabase init` (once; the repo ships no `config.toml`, accept the
  defaults), then `supabase link --project-ref <ref>` (the ref is in
  Project Settings → General), then `supabase db push`.
- 🤖 **Supabase MCP** (if your agent has it connected): `apply_migration`
  named `initial_schema` with that file's contents. **First confirm which
  project the MCP is pointed at** (`get_project` / `list_projects`) — an
  agent with an MCP connected to some *other* project you already use will
  happily apply the schema there instead.

✅ Check, 🤖 from `frontend/`:

```bash
node scripts/check-setup.mjs
```

It reads only, and reports on the env file, each of the eleven tables
(`profiles`, `adventures`, `entries`, `media`, `upload_sessions`,
`share_links`, `reactions`, `family_settings`, `itinerary_items`,
`trip_ideas`, `itinerary_documents`), the two private buckets
(`family-originals`, `family-derived`) and — after step 3 — the first
admin. Right now it should pass everything except "no profiles yet".

---

## 3. Create the first admin

There is deliberately no public sign-up. An admin creates every account,
and the very first admin is created with a script that uses the secret key
from step 1.

🤖 From `frontend/`:

```bash
node scripts/create-user.mjs --email you@example.com --name "Your name" --role admin
```

It reads `frontend/.env.local` (so it targets whatever project that
points at), creates the auth user already confirmed — no email is sent —
plus the matching profile row, and prints a generated password once (add
`--password` to choose your own). Change it in Settings after the first
sign-in. Re-running it for the same email exits 1 with "already exists" —
not a failure. Lost the password? Same script, `--reset-password`:

```bash
node scripts/create-user.mjs --email you@example.com --reset-password
```

Further family members are created the same way; leave off `--role` for
an editor. Editors can write everything; admins additionally manage share
links, the recycle bin's permanent delete, and the home location.

🧑 Prefer the dashboard? **Authentication → Users → Add user → Create new
user** (tick **Auto confirm user**), copy the new user's UID, then in
**SQL Editor**:

```sql
insert into public.profiles (id, email, display_name, role)
values ('<the UID you copied>', 'you@example.com', 'Your name', 'admin');
```

✅ Check: `node scripts/check-setup.mjs` now ends with "All good", listing
your admin.

---

## 4. Run it locally

🤖 From `frontend/`:

```bash
npm run dev
```

🧑 or 🤖 Open <http://localhost:3000> (add `-- -p 3001` to the command if
3000 is taken), sign in with the email and password from step 3, and run
through the checks below. Don't be thrown by the branding: the app calls
itself **Holidays** in its own header and title — Awaydays is the name of
the project, Holidays is what your family sees.

1. **Settings** → set your home location (a town name; add the county or
   country if it's a common name). Journeys start from here.
2. **+ Trip** → create a trip with a location and dates.
3. Open it → **+ Add entry** → give it a place name. Save. The entry
   should show a map pin; if instead it says it couldn't find that place
   on the map, try a fuller name, like a town and county.
4. On the entry → upload a photo from the gallery. It should appear after
   a moment.
5. **Map** in the header → your pin, and a journey line from home.

✅ Check: all five work. If sign-in loops back to the form, revisit the
JWT signing key in step 1. If uploads fail, check the storage buckets
exist (step 2) and the secret key is correct. If nothing gets a map pin,
`GEO_CONTACT_EMAIL` is missing.

---

## 5. Demo data (optional)

For something to look at before your first real trip, seed a fictional
weekend in the Lake District (invented people, real places, no photos).

⚠️ It writes rows and overwrites the home location. Only run it against
a fresh project. It is safe to re-run: if the demo trip already exists it
does nothing. The trip is dated last month so it lands in the diary rather
than under Plans.

🤖 From `frontend/`:

```bash
node scripts/seed-demo.mjs --user you@example.com
npm run routes:backfill      # draws the car legs along real roads (needs GEO_CONTACT_EMAIL)
```

Delete it later from the trip's edit page; the recycle bin's permanent
delete removes it completely.

---

## 6. Deploy

### Vercel (the documented path)

🧑 Push the repo to your own GitHub (a fork or a copy — your choice).
In Vercel, **Add New → Project**, import it, and set:

- **Root Directory**: `frontend`
- **Node.js Version** (Settings → General): 22.x.
- **Environment Variables**: every non-blank line from your `.env.local`
  — at minimum the three Supabase values and `GEO_CONTACT_EMAIL`. Apply
  them to Production and Preview. `SUPABASE_SECRET_KEY` has no
  `NEXT_PUBLIC_` prefix, so Next.js keeps it server-side; marking it
  Sensitive in Vercel is a good habit too.

Deploy. Then sign in on the deployed URL and repeat the step-4 checks.

Notes:

- If you later enable the AI research search, the plan page's server
  actions can take 20–40 seconds; the code already sets
  `maxDuration = 90` on that page, which Vercel honours. Keep that export
  on any page whose actions call the gateway.
- `NEXT_PUBLIC_*` variables are baked in at build time. After adding or
  changing one, redeploy.

### Anywhere else

The frontend is ordinary Next.js:

```bash
cd frontend
npm ci
npm run build
npm run start   # port 3000
```

Put it behind your reverse proxy, or wrap those lines in a container, and
supply the same environment variables. Other hosts ignore `maxDuration`;
set their function timeout to at least 60 seconds if you use the AI
search.

✅ Check: sign in on the deployed URL, create an entry, upload a photo.

---

## 7. Optional extras

Each is independent. Each feature simply doesn't appear without its key.

### Google Maps (nicer maps; Leaflet otherwise)

🧑 In [Google Cloud](https://console.cloud.google.com): create a project,
enable **Maps JavaScript API**, create an **API key**, and **lock it
down** —

- Application restriction: **HTTP referrers**, with your deployed
  domain(s) and `localhost:3000`.
- API restriction: **Maps JavaScript API** only.
- **Quotas → Maps JavaScript API → Map loads per day**: cap it so the
  monthly free allowance can never be exceeded (for example 300 a day:
  300 × 31 ≈ 9,300, under the 10,000 free Dynamic Maps loads a month).
  With the cap, your bill is zero by arithmetic.

Google Maps needs a billing account on the project even at £0; that's how
Google works. The cap is what makes it safe.

🧑 Then **Map management → Create map ID**. It must be a **JavaScript,
vector** map — the app's advanced markers need the vector renderer. Put
both into `.env.local` and your host:

```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=
```

✅ Check: the Map page renders in Google's style with red pins. Remove
either variable to fall back to Leaflet.

### English-labelled Leaflet tiles (ArcGIS)

Without Google Maps, Leaflet uses OpenStreetMap tiles, which label places
in each local language. For English labels, 🧑 create a free
[ArcGIS Location Platform](https://location.arcgis.com) API key
restricted to basemap tiles and your referrers, and set
`NEXT_PUBLIC_ARCGIS_API_KEY`. These keys expire yearly — set a reminder.

### AI research search on the plan page (Vercel AI Gateway)

🧑 In Vercel, **AI Gateway → API keys**, create a key. Set
`AI_GATEWAY_API_KEY`. The search runs a model with the gateway's Parallel
or Exa web-search tool. The default model is named in `.env.example` and
lives in `src/lib/plan-search.ts`; set `PLAN_SEARCH_MODEL` to use a
different one. Costs are pennies at family scale and show in the Vercel
dashboard.

✅ Check: a future trip's plan page shows the "Find places" / "Deep dive"
search box.

### Tripadvisor ratings on saved ideas

🧑 Create a key on Tripadvisor's [Terra API](https://docs.terra.tripadvisor.com/).
Set `TRIPADVISOR_API_KEY`. Billing is per venue looked up (a free
allowance first); the app looks each idea up once and caches the result
on the idea for ever.

✅ Check: saving an idea shows Tripadvisor's rating bubbles on its card.

### Video

Video uploads work without anything extra, but the web-sized copy and
poster frame that make them play nicely are produced by a script that
needs `ffmpeg` on the machine running it:

```bash
npm run videos:process -- --all
```

Photos get their derivatives the same way (`npm run photos:process -- --all`,
no ffmpeg needed). Run these after a trip, or whenever uploads look
unprocessed. See `docs/photos-and-video.md`.

---

## 8. Things worth knowing about free tiers

- **Supabase pauses free projects after a week without activity.** The
  dashboard un-pauses it in a click, and a family checking the app
  occasionally keeps it awake. Consider the cheapest paid tier if you want
  it always-on.
- **Storage counts against the Supabase quota.** Originals are kept
  untouched (that's a feature), so a photo-heavy family will reach the
  free limit eventually. Keep your own master archive elsewhere regardless
  — see `docs/backup-and-restore.md` for the backup script.
- **Vercel Hobby is for personal, non-commercial use.** Fine for a family.
- **Nothing here phones home** to the project's authors. Your data is in
  your Supabase project and nowhere else.

---

## Done

Read [`AGENTS.md`](AGENTS.md) before changing anything, and enjoy the
trips.
