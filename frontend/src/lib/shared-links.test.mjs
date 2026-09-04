import assert from "node:assert/strict";
import test from "node:test";
import {
  sharedEntryHref,
  sharedMapHref,
  sharedPhotoHref,
  sharedTripHref,
} from "./shared-links.ts";
import { newestEntriesFirst } from "./shared-entry-order.ts";

test("single-trip entry links stay inside the shared token route", () => {
  assert.equal(sharedEntryHref("token123", null, "entry-1"), "/share/token123/entries/entry-1");
});

test("whole-app entry links stay inside the shared trip route", () => {
  assert.equal(
    sharedEntryHref("token123", "lake-district", "entry-1"),
    "/share/token123/adventures/lake-district/entries/entry-1",
  );
});

test("shared map and photo links stay under the shared token", () => {
  assert.equal(sharedMapHref("token123"), "/share/token123/map");
  assert.equal(
    sharedPhotoHref("token123", "photo-1", "thumb"),
    "/share/token123/photo/photo-1?size=thumb",
  );
});

test("a whole-app share follows a trip link through its own token", () => {
  assert.equal(
    sharedTripHref("token123", "/adventures/lakeside-weekend", true),
    "/share/token123/adventures/lakeside-weekend",
  );
  assert.equal(
    sharedTripHref("token123", "/adventures/lakeside-weekend#entry-9", true),
    "/share/token123/adventures/lakeside-weekend#entry-9",
  );
});

test("a single-trip share drops trip links rather than offering a dead end", () => {
  assert.equal(sharedTripHref("token123", "/adventures/lakeside-weekend", false), null);
});

test("links a share visitor cannot use are dropped, external ones are left alone", () => {
  // No shared equivalent exists for these routes, on either scope.
  assert.equal(sharedTripHref("token123", "/map", true), null);
  assert.equal(sharedTripHref("token123", "/adventures/lakeside-weekend/edit", true), null);
  assert.equal(sharedTripHref("token123", "//evil.example.com", true), null);
  assert.equal(
    sharedTripHref("token123", "https://example.com/x", true),
    "https://example.com/x",
  );
});

test("shared diary entries display newest first with creation time as the tie-breaker", () => {
  const entries = [
    { id: "old", entry_date: "2026-08-10", created_at: "2026-08-10T09:00:00Z" },
    { id: "newer-a", entry_date: "2026-08-12", created_at: "2026-08-12T09:00:00Z" },
    { id: "newer-b", entry_date: "2026-08-12", created_at: "2026-08-12T12:00:00Z" },
  ];

  assert.deepEqual(
    newestEntriesFirst(entries).map((entry) => entry.id),
    ["newer-b", "newer-a", "old"],
  );
  assert.deepEqual(entries.map((entry) => entry.id), ["old", "newer-a", "newer-b"]);
});
