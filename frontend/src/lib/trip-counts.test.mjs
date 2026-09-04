import assert from "node:assert/strict";
import test from "node:test";
import { tripCountLabel, tripCounts } from "./trip-counts.ts";

const entries = [
  { id: "e1", adventure_id: "porto", kind: "diary" },
  { id: "e2", adventure_id: "porto", kind: "diary" },
  { id: "e3", adventure_id: "porto", kind: "travel" },
  { id: "e4", adventure_id: "kendal", kind: "diary" },
];

const media = [
  { adventure_id: "porto", entry_id: "e1" },
  { adventure_id: "porto", entry_id: "e3" },
  { adventure_id: "porto", entry_id: "gone" },
  { adventure_id: "kendal", entry_id: null },
];

test("diary entries count, travel legs don't, but their photos do", () => {
  const counts = tripCounts(entries, media);
  assert.deepEqual(counts.get("porto"), { entries: 2, photos: 2 });
});

test("media without a surviving entry is not counted", () => {
  const counts = tripCounts(entries, media);
  assert.deepEqual(counts.get("kendal"), { entries: 1, photos: 0 });
});

test("labels read naturally and omit what's zero", () => {
  assert.equal(tripCountLabel({ entries: 2, photos: 62 }), "2 entries · 62 photos");
  assert.equal(tripCountLabel({ entries: 1, photos: 1 }), "1 entry · 1 photo");
  assert.equal(tripCountLabel({ entries: 3, photos: 0 }), "3 entries");
  assert.equal(tripCountLabel({ entries: 0, photos: 0 }), null);
  assert.equal(tripCountLabel(undefined), null);
});
