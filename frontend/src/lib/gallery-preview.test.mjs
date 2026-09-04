import assert from "node:assert/strict";
import test from "node:test";
import { galleryPreview } from "./gallery-preview.ts";

test("gallery preview returns only the requested photos and the hidden count", () => {
  const photos = ["one", "two", "three", "four", "five"];

  assert.deepEqual(galleryPreview(photos, 3), {
    visiblePhotos: ["one", "two", "three"],
    hiddenCount: 2,
  });
  assert.deepEqual(photos, ["one", "two", "three", "four", "five"]);
});

test("gallery preview keeps the complete gallery when no limit is supplied", () => {
  assert.deepEqual(galleryPreview(["one", "two", "three"]), {
    visiblePhotos: ["one", "two", "three"],
    hiddenCount: 0,
  });
});
