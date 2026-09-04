"use server";

import { gateway, generateText, stepCountIs } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { IDEA_CATEGORIES, type IdeaCategory } from "@/lib/types";

// Research search for the planning page: a family member types "christmas
// markets" or "best chips in Lisbon", picks Parallel or Exa, and a cheap
// model runs one web search through the Vercel AI Gateway and shapes the
// results into suggestions they can save as trip ideas.
//
// Costs (Aug 2026): Parallel $5 / 1,000 searches, Exa $7 / 1,000 — pennies
// at family scale. Spend is visible in the Vercel dashboard under
// AI Gateway. Requires AI_GATEWAY_API_KEY (env, never committed).

export type SearchProvider = "exa" | "parallel";

export interface PlaceSuggestion {
  title: string;
  category: IdeaCategory;
  description: string | null;
  /** The venue's own website, when one was found — never an aggregator */
  url: string | null;
  /** The tourist-guide or listicle page the find came from, labelled as such */
  listing_url: string | null;
  address: string | null;
}

export type PlaceSearchResult =
  | { ok: true; suggestions: PlaceSuggestion[] }
  | { ok: false; error: string };

const suggestionSchema = z.object({
  title: z.string().trim().min(1).max(200),
  category: z.enum(IDEA_CATEGORIES).catch("other"),
  description: z.string().trim().max(2000).nullable().catch(null),
  url: z.url().max(1000).nullable().catch(null),
  listing_url: z.url().max(1000).nullable().catch(null),
  address: z.string().trim().max(300).nullable().catch(null),
});

// The gateway model, overridable per installation without a code change.
const MODEL =
  process.env.PLAN_SEARCH_MODEL?.trim() || "openai/gpt-5.6-luna";

// The itinerary usually knows where the family is staying — fold it in so
// "walking distance" means walking distance from the actual hotel without
// anyone having to type the address into every search.
async function hotelContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  adventureId: string,
): Promise<string> {
  const { data: stay } = await supabase
    .from("itinerary_items")
    .select("title, location")
    .eq("adventure_id", adventureId)
    .eq("kind", "hotel")
    .is("deleted_at", null)
    .order("starts_at", { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  return stay
    ? `They are staying at ${stay.title}${stay.location ? `, ${stay.location}` : ""} — when distance matters, judge it from there and mention roughly how far or how many minutes' walk each place is.`
    : "";
}

export async function searchPlaces(input: {
  adventureId: string;
  provider: SearchProvider;
  query: string;
  /** Fold the itinerary's hotel into the search (default true) */
  useHotel?: boolean;
}): Promise<PlaceSearchResult> {
  const query = input.query.trim().slice(0, 300);
  if (!query) return { ok: false, error: "Type what you'd like to look for first" };
  if (input.provider !== "exa" && input.provider !== "parallel") {
    return { ok: false, error: "Please pick a search provider" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session has expired — please sign in again" };

  // RLS confirms this is a family member looking at a real trip, and the
  // trip's location and dates give the search its sense of place.
  const { data: adventure } = await supabase
    .from("adventures")
    .select("title, location, start_date, end_date")
    .eq("id", input.adventureId)
    .is("deleted_at", null)
    .single();
  if (!adventure) return { ok: false, error: "That trip couldn't be found" };

  const place = adventure.location ?? adventure.title;

  const stayLine =
    input.useHotel === false ? "" : await hotelContext(supabase, input.adventureId);

  const searchTool =
    input.provider === "exa"
      ? gateway.tools.exaSearch({ numResults: 8, contents: { highlights: true } })
      : gateway.tools.parallelSearch({ mode: "one-shot", maxResults: 8 });

  try {
    const { text } = await generateText({
      model: MODEL,
      tools: { web_search: searchTool },
      stopWhen: stepCountIs(4),
      prompt: [
        `You are helping a UK family plan a holiday. They are visiting ${place}`,
        `from ${adventure.start_date} to ${adventure.end_date}.`,
        stayLine,
        `Use the web_search tool once to research: "${query}" (in or near ${place}).`,
        `Then reply with ONLY a JSON array — no markdown fences, no commentary —`,
        `of up to 8 real, specific places or activities drawn from the search`,
        `results. Each element must be an object with exactly these keys:`,
        `"title" (the place's name), "category" (one of ${IDEA_CATEGORIES.map((c) => `"${c}"`).join(", ")}),`,
        `"description" (one or two friendly sentences, UK English),`,
        `"url" (the venue's OWN website only — never a tourist guide, listicle,`,
        `review site or aggregator; null if the search didn't surface it),`,
        `"listing_url" (the tourist-guide or article page this find came from,`,
        `or null) and "address" (street or area if known, or null). Only`,
        `include places that genuinely match the request; fewer good`,
        `suggestions beat padding.`,
      ]
        .filter(Boolean)
        .join(" "),
    });

    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const start = cleaned.indexOf("[");
    const end = cleaned.lastIndexOf("]");
    if (start === -1 || end === -1) {
      return { ok: false, error: "The search came back empty — try wording it differently" };
    }
    const parsed = z
      .array(suggestionSchema)
      .safeParse(JSON.parse(cleaned.slice(start, end + 1)));
    if (!parsed.success || parsed.data.length === 0) {
      return { ok: false, error: "The search came back empty — try wording it differently" };
    }
    return { ok: true, suggestions: parsed.data.slice(0, 8) };
  } catch (error) {
    // The family sees the friendly line; the real cause goes to the
    // function logs (vercel logs) where it can actually be debugged.
    console.error("plan-search failed", {
      provider: input.provider,
      model: MODEL,
      hasGatewayKey: Boolean(process.env.AI_GATEWAY_API_KEY),
      error,
    });
    return {
      ok: false,
      error: "The search didn't come back — give it another go in a moment",
    };
  }
}

export type DeepDiveResult =
  | { ok: true; answer: string }
  | { ok: false; error: string };

/**
 * Deep dive: research one thing — an attraction's reviews, a pub's
 * reputation, ticket deals — and come back with a readable briefing
 * (Markdown with source links) rather than a list of place cards.
 */
export async function deepDive(input: {
  adventureId: string;
  provider: SearchProvider;
  query: string;
  useHotel?: boolean;
}): Promise<DeepDiveResult> {
  const query = input.query.trim().slice(0, 300);
  if (!query) return { ok: false, error: "Type what you'd like to look into first" };
  if (input.provider !== "exa" && input.provider !== "parallel") {
    return { ok: false, error: "Please pick a search provider" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session has expired — please sign in again" };

  const { data: adventure } = await supabase
    .from("adventures")
    .select("title, location, start_date, end_date")
    .eq("id", input.adventureId)
    .is("deleted_at", null)
    .single();
  if (!adventure) return { ok: false, error: "That trip couldn't be found" };

  const place = adventure.location ?? adventure.title;
  const stayLine =
    input.useHotel === false ? "" : await hotelContext(supabase, input.adventureId);
  const searchTool =
    input.provider === "exa"
      ? gateway.tools.exaSearch({ numResults: 8, contents: { highlights: true } })
      : gateway.tools.parallelSearch({ mode: "one-shot", maxResults: 8 });

  try {
    const { text } = await generateText({
      model: MODEL,
      tools: { web_search: searchTool },
      stopWhen: stepCountIs(6),
      prompt: [
        `You are helping a UK family plan a holiday. They are visiting ${place}`,
        `from ${adventure.start_date} to ${adventure.end_date}.`,
        stayLine,
        `Use the web_search tool (at most twice) to research: "${query}".`,
        `Then write a concise briefing in UK English, as Markdown. Cover what`,
        `it is, what visitors and reviewers actually say (the good and the`,
        `bad), typical prices and any deals or booking tips you found, and`,
        `practical notes — opening times, how long to allow, and distance`,
        `from where they're staying when that's relevant to the question.`,
        `Short paragraphs and bullet points; link your sources inline as`,
        `Markdown links on the words they support. No preamble, no heading`,
        `repeating the question — start straight in.`,
      ]
        .filter(Boolean)
        .join(" "),
    });

    const answer = text.trim();
    if (!answer) {
      return { ok: false, error: "The search came back empty — try wording it differently" };
    }
    return { ok: true, answer };
  } catch (error) {
    console.error("deep-dive failed", {
      provider: input.provider,
      model: MODEL,
      hasGatewayKey: Boolean(process.env.AI_GATEWAY_API_KEY),
      error,
    });
    return {
      ok: false,
      error: "The search didn't come back — give it another go in a moment",
    };
  }
}
