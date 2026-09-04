import assert from "node:assert/strict";
import test from "node:test";
import {
  countdownLabel,
  documentSizeLabel,
  formatCost,
  formatItineraryDay,
  groupItineraryByDay,
  hostLabel,
  itineraryDayKey,
  itineraryTime,
  mapsSearchUrl,
  tripAdvisorSearchUrl,
  walkFromHotelLabel,
} from "./plan.ts";

test("itinerary times are wall-clock slices, never timezone-shifted", () => {
  assert.equal(itineraryDayKey("2030-05-03T09:15:00+00:00"), "2030-05-03");
  assert.equal(itineraryTime("2030-05-03T09:15:00+00:00"), "09:15");
  assert.equal(itineraryTime("2030-05-06T16:40:00+00:00"), "16:40");
});

test("day heading reads naturally", () => {
  assert.equal(formatItineraryDay("2030-05-03"), "Friday 3 May 2030");
});

test("items group by day in time order, undated last", () => {
  const trainOut = { id: "out", starts_at: "2030-05-03T09:15:00+00:00" };
  const hotel = { id: "hotel", starts_at: "2030-05-03T15:00:00+00:00" };
  const trainBack = { id: "back", starts_at: "2030-05-06T15:20:00+00:00" };
  const localTrain = { id: "local", starts_at: null };

  const groups = groupItineraryByDay([trainBack, hotel, localTrain, trainOut]);
  assert.deepEqual(
    groups.map((g) => ({ day: g.day, ids: g.items.map((i) => i.id) })),
    [
      { day: "2030-05-03", ids: ["out", "hotel"] },
      { day: "2030-05-06", ids: ["back"] },
      { day: null, ids: ["local"] },
    ],
  );
});

test("countdown label counts days, spots tomorrow and trips underway", () => {
  assert.equal(countdownLabel("2030-05-03", "2030-05-06", "2030-01-10"), "In 113 days");
  assert.equal(countdownLabel("2026-08-29", "2026-08-30", "2026-08-28"), "Starts tomorrow");
  assert.equal(countdownLabel("2026-08-27", "2026-08-30", "2026-08-28"), "Happening now");
  assert.equal(countdownLabel("2026-08-28", "2026-08-28", "2026-08-28"), "Happening now");
});

test("place links carry the address, or fall back to the trip's location", () => {
  assert.equal(
    mapsSearchUrl("The Elephant House", "21 George IV Bridge, Edinburgh", "Edinburgh, Scotland"),
    "https://www.google.com/maps/search/?api=1&query=The%20Elephant%20House%2C%2021%20George%20IV%20Bridge%2C%20Edinburgh",
  );
  assert.equal(
    mapsSearchUrl("Edinburgh Castle", null, "Edinburgh, Scotland"),
    "https://www.google.com/maps/search/?api=1&query=Edinburgh%20Castle%2C%20Edinburgh%2C%20Scotland",
  );
  assert.equal(
    tripAdvisorSearchUrl("The Elephant House", "Edinburgh, Scotland"),
    "https://www.tripadvisor.com/Search?q=The%20Elephant%20House%20Edinburgh%2C%20Scotland",
  );
});

test("walking distance reads naturally at every scale", () => {
  // Waverley station → the Castle, roughly: about 1.2 km
  const label = walkFromHotelLabel(55.952, -3.19, 55.962301, -3.187147);
  assert.match(label, /^≈ 1\.[12] km · 1[45] min walk$/);
  // A couple of streets over: metres, rounded to 50
  assert.match(
    walkFromHotelLabel(55.952, -3.19, 55.9538, -3.19),
    /^≈ \d{2,3} m · \d+ min walk$/,
  );
  // Far away: kilometres only, no silly walk time
  assert.equal(walkFromHotelLabel(51.2, 3.22, 51.2, 3.4), "≈ 13 km away");
});

test("host labels strip www and survive rubbish urls", () => {
  assert.equal(hostLabel("https://www.visitscotland.com/en/pubs"), "visitscotland.com");
  assert.equal(hostLabel("https://timeout.com/edinburgh"), "timeout.com");
  assert.equal(hostLabel("not a url"), "source");
});

test("costs get their currency symbol and lose pointless decimals", () => {
  assert.equal(formatCost(96, "GBP"), "£96");
  assert.equal(formatCost(285.5, "EUR"), "€285.50");
  assert.equal(formatCost(50, "CHF"), "50 CHF");
  assert.equal(formatCost(12.5, null), "12.50");
});

test("document sizes read naturally at every scale", () => {
  assert.equal(documentSizeLabel(800), "800 B");
  assert.equal(documentSizeLabel(394106), "385 kB");
  assert.equal(documentSizeLabel(3.4 * 1024 * 1024), "3.4 MB");
  assert.equal(documentSizeLabel(2 * 1024 * 1024), "2 MB");
  assert.equal(documentSizeLabel(15 * 1024 * 1024), "15 MB");
});
