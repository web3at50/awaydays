import assert from "node:assert/strict";
import test from "node:test";
import { teaserText } from "./teaser.ts";

test("card teasers show link text, never raw Markdown syntax", () => {
  assert.equal(
    teaserText("We did it again — [Whitby 2019](/adventures/whitby-2019)."),
    "We did it again — Whitby 2019.",
  );
});

test("teasers leave ordinary prose and punctuation alone", () => {
  const summary = "Two weeks all inclusive (swim-up suite) - sounds better than it was!";
  assert.equal(teaserText(summary), summary);
});

test("teasers drop heading markers and emphasis, keeping the words", () => {
  assert.equal(
    teaserText("## The launch from Waterhead\n\nGrey but dry. Lunch at the pier café — the *good* chips."),
    "The launch from Waterhead\n\nGrey but dry. Lunch at the pier café — the good chips.",
  );
  assert.equal(teaserText("**Best** day, _honestly_."), "Best day, honestly.");
  // Arithmetic and snake_case are not emphasis
  assert.equal(teaserText("2*3*4 and file_name_here"), "2*3*4 and file_name_here");
});
