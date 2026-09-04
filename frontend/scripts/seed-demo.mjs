// Demo data for a fresh installation: one fictional weekend in the Lake
// District with a couple of diary entries and the travel legs that get
// there, so a new install has something to look at before its first real
// trip. No photos. Everyone named here is invented.
//
// !!! Never run this against a database you care about. It inserts rows
// !!! and overwrites the family home location in Settings.
//
// Usage (from frontend/, with .env.local pointing at the target project):
//   node scripts/seed-demo.mjs --user you@example.com
//
// --user is the email of an existing profile (the first admin you created
// while following SETUP.md); every row is attributed to them.
import { adminClient, loadEnv } from "./lib.mjs";

loadEnv();
const supabase = adminClient();

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : fallback;
}
const email = arg("user");
if (!email) {
  console.log("Usage: node scripts/seed-demo.mjs --user <email of an existing profile>");
  process.exit(1);
}

const { data: profile, error: profileError } = await supabase
  .from("profiles")
  .select("id, display_name")
  .eq("email", email)
  .single();
if (profileError || !profile) {
  console.error(`No profile with email ${email}: ${profileError?.message ?? "no match"}`);
  console.error("Create the first admin (see SETUP.md) before seeding.");
  process.exit(1);
}

const SLUG = "lakeside-weekend-demo";
const { data: existing } = await supabase
  .from("adventures")
  .select("id")
  .eq("slug", SLUG)
  .maybeSingle();
if (existing) {
  console.log(`Demo trip already exists (slug ${SLUG}) — nothing to do.`);
  process.exit(0);
}

// Home: Kendal, the gateway to the Lakes. Journeys start from here.
const { error: settingsError } = await supabase
  .from("family_settings")
  .update({
    home_location: "Kendal, Cumbria",
    home_latitude: 54.3281,
    home_longitude: -2.7463,
    updated_by: profile.id,
  })
  .eq("id", true);
if (settingsError) {
  console.error(`Could not set the home location: ${settingsError.message}`);
  process.exit(1);
}

// A weekend last month, so it lands in the diary rather than in Plans.
const start = new Date();
start.setMonth(start.getMonth() - 1);
start.setDate(start.getDate() - ((start.getDay() + 2) % 7)); // a Friday
const day = (offset) => {
  const d = new Date(start);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

const { data: adventure, error: adventureError } = await supabase
  .from("adventures")
  .insert({
    title: "Lakeside Weekend",
    slug: SLUG,
    type: "holiday",
    summary:
      "Two nights in Ambleside with the Fairweathers: a boat on Windermere, a very wet walk to Stock Ghyll Force, and more scones than strictly necessary.",
    start_date: day(0),
    end_date: day(2),
    location: "Ambleside, Cumbria",
    latitude: 54.4287,
    longitude: -2.9613,
    created_by: profile.id,
  })
  .select("id")
  .single();
if (adventureError || !adventure) {
  console.error(`Could not create the demo trip: ${adventureError?.message}`);
  process.exit(1);
}

const who = { created_by: profile.id, updated_by: profile.id };
const entries = [
  {
    kind: "travel",
    travel_mode: "car",
    entry_date: day(0),
    title: "Up the A591 to Ambleside",
    body: "Left after school. Sam navigated, which is why we saw Bowness twice.",
    location: "Ambleside, Cumbria",
    latitude: 54.4287,
    longitude: -2.9613,
  },
  {
    kind: "diary",
    entry_date: day(1),
    title: "Windermere by boat",
    body:
      "## The launch from Waterhead\n\nGrey but dry. Priya spotted a heron before anyone else and has not let it go. Lunch at the pier café — the *good* chips.\n\nAfternoon: Stock Ghyll Force in proper Lake District rain. Everyone soaked, everyone delighted.",
    location: "Waterhead, Ambleside",
    latitude: 54.4218,
    longitude: -2.9636,
  },
  {
    kind: "diary",
    entry_date: day(2),
    title: "Grasmere and gingerbread",
    body:
      "A gentle morning: the church, the gingerbread shop (queue, worth it), and a loop of the lake. Sam declared it the best trip ever, which he also said about the service station.",
    location: "Grasmere, Cumbria",
    latitude: 54.4594,
    longitude: -3.0245,
  },
  {
    kind: "travel",
    travel_mode: "car",
    entry_date: day(2),
    title: "Home via Kendal",
    body: "Asleep in the back before Windermere.",
    location: "Kendal, Cumbria",
    latitude: 54.3281,
    longitude: -2.7463,
  },
];

const { error: entriesError } = await supabase.from("entries").insert(
  entries.map((entry) => ({ ...entry, adventure_id: adventure.id, ...who })),
);
if (entriesError) {
  console.error(`Could not create the demo entries: ${entriesError.message}`);
  process.exit(1);
}

console.log(
  `Seeded "Lakeside Weekend" (${entries.length} entries) for ${profile.display_name}, home set to Kendal.`,
);
console.log(
  "Road routes for the car legs draw as straight lines until you run: npm run routes:backfill",
);
