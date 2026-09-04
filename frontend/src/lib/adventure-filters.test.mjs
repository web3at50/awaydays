import assert from "node:assert/strict";
import test from "node:test";
import {
  adventureYears,
  filterAdventures,
  filterHref,
  parseAdventureFilter,
} from "./adventure-filters.ts";

const trips = [
  { title: "Lisbon", type: "holiday", start_date: "2018-04-02" },
  { title: "Porto", type: "holiday", start_date: "2021-10-21" },
  { title: "Aquarium", type: "day_trip", start_date: "2021-06-05" },
  { title: "Festival", type: "event", start_date: "2026-03-14" },
];

test("parse accepts known types and four-digit years", () => {
  assert.deepEqual(parseAdventureFilter({ type: "day_trip", year: "2021" }), {
    type: "day_trip",
    year: 2021,
  });
});

test("parse ignores unknown values and repeated params", () => {
  assert.deepEqual(parseAdventureFilter({ type: "picnic", year: "21" }), {
    type: null,
    year: null,
  });
  assert.deepEqual(parseAdventureFilter({ type: ["holiday", "event"] }), {
    type: "holiday",
    year: null,
  });
  assert.deepEqual(parseAdventureFilter({}), { type: null, year: null });
});

test("filtering combines type and year, and null means everything", () => {
  assert.deepEqual(
    filterAdventures(trips, { type: "holiday", year: null }).map((t) => t.title),
    ["Lisbon", "Porto"],
  );
  assert.deepEqual(
    filterAdventures(trips, { type: null, year: 2021 }).map((t) => t.title),
    ["Porto", "Aquarium"],
  );
  assert.deepEqual(
    filterAdventures(trips, { type: "holiday", year: 2021 }).map((t) => t.title),
    ["Porto"],
  );
  assert.equal(filterAdventures(trips, { type: null, year: null }).length, 4);
});

test("years are distinct and newest first", () => {
  assert.deepEqual(adventureYears(trips), [2026, 2021, 2018]);
});

test("filter hrefs carry only what's set", () => {
  assert.equal(filterHref({ type: null, year: null }), "/");
  assert.equal(filterHref({ type: "holiday", year: null }), "/?type=holiday");
  assert.equal(
    filterHref({ type: "day_trip", year: 2021 }),
    "/?type=day_trip&year=2021",
  );
});

test("shared-index filter hrefs stay inside the token route", () => {
  assert.equal(
    filterHref({ type: null, year: null }, "/share/abc123"),
    "/share/abc123",
  );
  assert.equal(
    filterHref({ type: "holiday", year: 2024 }, "/share/abc123"),
    "/share/abc123?type=holiday&year=2024",
  );
});
