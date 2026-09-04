"use client";

import { useActionState, useRef, useState } from "react";
import type { FormState } from "@/lib/actions";
import {
  TRAVEL_MODES,
  TRAVEL_MODE_EMOJI,
  TRAVEL_MODE_LABELS,
  type TravelMode,
} from "@/lib/types";

const LINK_TEMPLATE = "[place name](https://example.com)";

interface EntryInitial {
  entry_date: string;
  title: string;
  body: string;
  itinerary: string | null;
  location: string | null;
  travel_mode: TravelMode | null;
}

const initialState: FormState = { error: null };

export function EntryForm({
  action,
  adventureId,
  adventureSlug,
  defaultDate,
  initial,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  adventureId: string;
  adventureSlug: string;
  defaultDate: string;
  initial?: EntryInitial;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [travelMode, setTravelMode] = useState<TravelMode | "">(
    initial?.travel_mode ?? "",
  );

  function insertLinkTemplate() {
    const textarea = bodyRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? start;
    textarea.setRangeText(LINK_TEMPLATE, start, end, "end");
    // Select "place name" so typing replaces it straight away
    textarea.setSelectionRange(start + 1, start + 11);
    textarea.focus();
  }

  return (
    <form
      action={formAction}
      className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-4"
    >
      <input type="hidden" name="adventure_id" value={adventureId} />
      <input type="hidden" name="adventure_slug" value={adventureSlug} />

      <div>
        <label htmlFor="entry_date" className="block text-sm font-medium mb-1">
          Date
        </label>
        <input
          id="entry_date"
          name="entry_date"
          type="date"
          required
          defaultValue={initial?.entry_date ?? defaultDate}
          className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-amber-600"
        />
      </div>

      <div>
        <label htmlFor="title" className="block text-sm font-medium mb-1">
          Title
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          maxLength={200}
          defaultValue={initial?.title}
          placeholder="e.g. Beach day and the coastal path"
          className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-amber-600"
        />
      </div>

      <div>
        <label htmlFor="body" className="block text-sm font-medium mb-1">
          Diary <span className="text-stone-400">(optional)</span>
        </label>
        <textarea
          id="body"
          name="body"
          ref={bodyRef}
          rows={6}
          maxLength={20000}
          defaultValue={initial?.body ?? ""}
          placeholder="What did we do today?"
          className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-amber-600"
        />
        <div className="flex items-center justify-between gap-2 mt-1">
          <p className="text-xs text-stone-400">
            Links work: <code>[place name](https://example.com)</code>
          </p>
          <button
            type="button"
            onClick={insertLinkTemplate}
            className="shrink-0 text-xs font-medium text-amber-800 hover:text-amber-900 rounded border border-stone-300 px-2 py-1 hover:border-amber-600"
          >
            Add link
          </button>
        </div>
      </div>

      <div>
        <label htmlFor="itinerary" className="block text-sm font-medium mb-1">
          Itinerary notes <span className="text-stone-400">(optional)</span>
        </label>
        <textarea
          id="itinerary"
          name="itinerary"
          rows={3}
          maxLength={10000}
          defaultValue={initial?.itinerary ?? ""}
          placeholder="Times, bookings, places to remember"
          className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-amber-600"
        />
      </div>

      <div>
        <label htmlFor="location" className="block text-sm font-medium mb-1">
          Location <span className="text-stone-400">(optional)</span>
        </label>
        <input
          id="location"
          name="location"
          type="text"
          maxLength={200}
          defaultValue={initial?.location ?? ""}
          className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-amber-600"
        />
        <p className="text-xs text-stone-400 mt-1">
          A place name here puts this day on the map.
        </p>
      </div>

      <fieldset>
        <legend className="block text-sm font-medium mb-1">
          How did we get here?{" "}
          <span className="text-stone-400 font-normal">
            (optional — for travel days)
          </span>
        </legend>
        <input type="hidden" name="travel_mode" value={travelMode} />
        <div className="flex flex-wrap gap-1.5">
          {TRAVEL_MODES.map((mode) => {
            const selected = travelMode === mode;
            return (
              <button
                key={mode}
                type="button"
                aria-pressed={selected}
                onClick={() => setTravelMode(selected ? "" : mode)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  selected
                    ? "border-amber-600 bg-amber-100 text-amber-950"
                    : "border-stone-300 bg-white text-stone-700 hover:border-amber-600"
                }`}
              >
                <span aria-hidden>{TRAVEL_MODE_EMOJI[mode]}</span>
                {TRAVEL_MODE_LABELS[mode]}
              </button>
            );
          })}
        </div>
      </fieldset>

      {state.error && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 rounded-lg p-3">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-amber-700 text-white font-medium py-3 hover:bg-amber-800 disabled:opacity-50"
      >
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
