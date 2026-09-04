"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { CopyButton } from "@/components/CopyButton";
import {
  googleSearchUrl,
  hostLabel,
  mapsSearchUrl,
  tripAdvisorSearchUrl,
} from "@/lib/plan";
import { saveDeepDiveNote, saveSearchIdea } from "@/lib/plan-actions";
import {
  deepDive,
  searchPlaces,
  type PlaceSuggestion,
  type SearchProvider,
} from "@/lib/plan-search";
import { IDEA_CATEGORY_EMOJI, IDEA_CATEGORY_LABELS } from "@/lib/types";

type SearchMode = "places" | "deepdive";

// Research box on the planning page. Two modes: "Find places" returns
// savable place cards; "Deep dive" researches one thing (reviews, deals,
// practicalities) and writes a briefing instead.
export function PlanSearch({
  adventureId,
  adventureSlug,
  placeName,
}: {
  adventureId: string;
  adventureSlug: string;
  placeName: string;
}) {
  const [mode, setMode] = useState<SearchMode>("places");
  const [query, setQuery] = useState("");
  const [useHotel, setUseHotel] = useState(true);
  const [searching, setSearching] = useState<SearchProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<{
    provider: SearchProvider;
    suggestions: PlaceSuggestion[];
  } | null>(null);
  const [briefing, setBriefing] = useState<{
    provider: SearchProvider;
    query: string;
    answer: string;
    saved: boolean;
  } | null>(null);
  const [savedTitles, setSavedTitles] = useState<Set<string>>(new Set());
  const [savingTitle, setSavingTitle] = useState<string | null>(null);

  async function runSearch(provider: SearchProvider) {
    if (searching || !query.trim()) return;
    setSearching(provider);
    setError(null);
    try {
      if (mode === "places") {
        const outcome = await searchPlaces({ adventureId, provider, query, useHotel });
        if (outcome.ok) {
          setResults({ provider, suggestions: outcome.suggestions });
          setBriefing(null);
          setSavedTitles(new Set());
        } else {
          setError(outcome.error);
        }
      } else {
        const outcome = await deepDive({ adventureId, provider, query, useHotel });
        if (outcome.ok) {
          setBriefing({ provider, query, answer: outcome.answer, saved: false });
          setResults(null);
        } else {
          setError(outcome.error);
        }
      }
    } catch {
      setError("The search didn't come back — give it another go in a moment");
    } finally {
      setSearching(null);
    }
  }

  async function save(suggestion: PlaceSuggestion) {
    if (!results || savingTitle) return;
    setSavingTitle(suggestion.title);
    try {
      const outcome = await saveSearchIdea({
        adventureId,
        adventureSlug,
        provider: results.provider,
        title: suggestion.title,
        category: suggestion.category,
        description: suggestion.description,
        // Prefer the venue's own site; a guide page beats no link at all
        url: suggestion.url ?? suggestion.listing_url,
        address: suggestion.address,
      });
      if (outcome.ok) {
        setSavedTitles((previous) => new Set(previous).add(suggestion.title));
      } else {
        setError(outcome.error ?? "Could not save — please retry");
      }
    } finally {
      setSavingTitle(null);
    }
  }

  async function saveBriefing() {
    if (!briefing || briefing.saved || savingTitle) return;
    setSavingTitle("__briefing__");
    try {
      const outcome = await saveDeepDiveNote({
        adventureId,
        adventureSlug,
        provider: briefing.provider,
        title: briefing.query,
        answer: briefing.answer,
      });
      if (outcome.ok) {
        setBriefing({ ...briefing, saved: true });
      } else {
        setError(outcome.error ?? "Could not save — please retry");
      }
    } finally {
      setSavingTitle(null);
    }
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <h3 className="font-semibold">Research</h3>

      <div className="mt-2 flex gap-1.5" role="group" aria-label="What kind of search">
        <button
          type="button"
          aria-pressed={mode === "places"}
          onClick={() => setMode("places")}
          className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
            mode === "places"
              ? "border-amber-600 bg-amber-100 text-amber-950"
              : "border-stone-300 bg-white text-stone-700 hover:border-amber-600"
          }`}
        >
          Find places
        </button>
        <button
          type="button"
          aria-pressed={mode === "deepdive"}
          onClick={() => setMode("deepdive")}
          className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
            mode === "deepdive"
              ? "border-amber-600 bg-amber-100 text-amber-950"
              : "border-stone-300 bg-white text-stone-700 hover:border-amber-600"
          }`}
        >
          Deep dive
        </button>
      </div>

      <p className="mt-2 text-sm text-stone-500">
        {mode === "places"
          ? `Search the web for ideas around ${placeName}, then save the ones worth keeping.`
          : `Ask about one thing — reviews, prices, deals, is-it-worth-it — and get a written briefing.`}
      </p>

      <input
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            runSearch("parallel");
          }
        }}
        maxLength={300}
        placeholder={
          mode === "places"
            ? "e.g. christmas markets, chocolate shops, family restaurants"
            : "e.g. is the castle worth the ticket price? any deals?"
        }
        className="mt-3 w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-amber-600"
      />

      <label className="mt-2.5 flex items-center gap-2 text-sm text-stone-600">
        <input
          type="checkbox"
          checked={useHotel}
          onChange={(event) => setUseHotel(event.target.checked)}
          className="h-4 w-4 accent-amber-700"
        />
        Measure distances from where we&apos;re staying
      </label>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => runSearch("parallel")}
          disabled={searching !== null || !query.trim()}
          className="rounded-lg bg-amber-700 px-3 py-2.5 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-50"
        >
          {searching === "parallel" ? "Searching…" : "Search with Parallel"}
        </button>
        <button
          type="button"
          onClick={() => runSearch("exa")}
          disabled={searching !== null || !query.trim()}
          className="rounded-lg border border-amber-600 px-3 py-2.5 text-sm font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-50"
        >
          {searching === "exa" ? "Searching…" : "Search with Exa"}
        </button>
      </div>

      {searching && (
        <p className="mt-3 text-sm text-stone-500">
          {mode === "places"
            ? `Looking around ${placeName} — this takes a few seconds.`
            : "Reading around the subject — deep dives take a little longer."}
        </p>
      )}

      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {briefing && (
        <div className="mt-4 rounded-xl border border-stone-200 p-4">
          <p className="text-xs font-medium text-amber-800">
            Deep dive · via {briefing.provider === "exa" ? "Exa" : "Parallel"}
          </p>
          <div className="prose prose-stone prose-sm mt-2 max-w-none break-words [overflow-wrap:anywhere] prose-a:text-amber-800">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkBreaks]}
              components={{
                a: (props) => (
                  <a {...props} target="_blank" rel="noreferrer" />
                ),
              }}
            >
              {briefing.answer}
            </ReactMarkdown>
          </div>
          <div className="mt-3 flex items-center gap-4 border-t border-stone-100 pt-3">
            <button
              type="button"
              onClick={saveBriefing}
              disabled={briefing.saved || savingTitle !== null}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                briefing.saved
                  ? "bg-stone-100 text-stone-500"
                  : "border border-amber-600 text-amber-800 hover:bg-amber-50"
              } disabled:opacity-70`}
            >
              {briefing.saved
                ? "Saved to ideas ✓"
                : savingTitle === "__briefing__"
                  ? "Saving…"
                  : "Save to ideas"}
            </button>
            <CopyButton text={briefing.answer} />
          </div>
        </div>
      )}

      {results && results.suggestions.length > 0 && (
        <ul className="mt-4 space-y-3">
          {results.suggestions.map((suggestion) => {
            const saved = savedTitles.has(suggestion.title);
            return (
              <li
                key={suggestion.title}
                className="rounded-xl border border-stone-200 p-3.5"
              >
                <p className="text-xs font-medium text-amber-800">
                  <span aria-hidden>
                    {IDEA_CATEGORY_EMOJI[suggestion.category]}
                  </span>{" "}
                  {IDEA_CATEGORY_LABELS[suggestion.category]}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 font-semibold text-stone-900">
                  {suggestion.url ? (
                    <a
                      href={suggestion.url}
                      target="_blank"
                      rel="noreferrer"
                      className="min-w-0 break-words hover:text-amber-800 underline decoration-stone-300 underline-offset-2"
                    >
                      {suggestion.title}
                    </a>
                  ) : (
                    <span className="min-w-0 break-words">{suggestion.title}</span>
                  )}
                  <CopyButton
                    text={`${suggestion.title}, ${suggestion.address ?? placeName}`}
                  />
                </p>
                {suggestion.description && (
                  <p className="mt-1 break-words text-sm text-stone-600">
                    {suggestion.description}
                  </p>
                )}
                {suggestion.address && (
                  <p className="mt-1 break-words text-xs text-stone-400">
                    {suggestion.address}
                  </p>
                )}
                <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <a
                    href={mapsSearchUrl(suggestion.title, suggestion.address, placeName)}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-amber-800 hover:underline"
                  >
                    📍 Maps
                  </a>
                  <a
                    href={googleSearchUrl(suggestion.title, placeName)}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-amber-800 hover:underline"
                  >
                    Google
                  </a>
                  <a
                    href={tripAdvisorSearchUrl(suggestion.title, placeName)}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-amber-800 hover:underline"
                  >
                    Tripadvisor
                  </a>
                  {suggestion.url && (
                    <a
                      href={suggestion.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-amber-800 hover:underline"
                    >
                      Website ↗
                    </a>
                  )}
                  {suggestion.listing_url && (
                    <a
                      href={suggestion.listing_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-stone-400 hover:text-stone-600 hover:underline"
                    >
                      found via {hostLabel(suggestion.listing_url)} ↗
                    </a>
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => save(suggestion)}
                  disabled={saved || savingTitle !== null}
                  className={`mt-2.5 w-full rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    saved
                      ? "bg-stone-100 text-stone-500"
                      : "border border-amber-600 text-amber-800 hover:bg-amber-50"
                  } disabled:opacity-70`}
                >
                  {saved
                    ? "Saved to ideas ✓"
                    : savingTitle === suggestion.title
                      ? "Saving…"
                      : "Save to ideas"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
