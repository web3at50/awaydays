import assert from "node:assert/strict";
import test from "node:test";
import { legMidpoint } from "./journeys.ts";

test("a straight two-point leg puts the emoji in the middle, not on the destination", () => {
  // The regression: plane, train, ferry and walk legs are only ever two
  // points, so indexing points[length / 2] landed on the arrival pin and the
  // emoji disappeared underneath it. Cars survived only because road
  // geometry has hundreds of points.
  const mid = legMidpoint([
    [50, 0],
    [52, 0],
  ]);

  assert.ok(mid);
  assert.ok(Math.abs(mid[0] - 51) < 0.001, `expected latitude 51, got ${mid[0]}`);
  assert.equal(mid[1], 0);
});

test("road geometry is halved by distance, not by index", () => {
  // Dense points in town, one long sparse hop out of it: the middle index is
  // still next to the start, but the middle of the drive is far away.
  const mid = legMidpoint([
    [0, 0],
    [0, 0.1],
    [0, 10],
  ]);

  assert.ok(mid);
  assert.ok(mid[1] > 4.5 && mid[1] < 5.5, `expected longitude near 5, got ${mid[1]}`);
});

test("degenerate legs do not blow up", () => {
  assert.equal(legMidpoint([]), null);
  assert.deepEqual(legMidpoint([[1, 2]]), [1, 2]);
  assert.deepEqual(
    legMidpoint([
      [1, 2],
      [1, 2],
    ]),
    [1, 2],
  );
});
