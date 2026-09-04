"use client";

import { useActionState, useState } from "react";
import { createTravelLeg, type FormState } from "@/lib/actions";
import {
  TRAVEL_MODES,
  TRAVEL_MODE_EMOJI,
  TRAVEL_MODE_LABELS,
  type TravelMode,
} from "@/lib/types";

const initialState: FormState = { error: null };

// The three-question leg form: where did you get to, how, and when.
// The leg names itself ("Kendal → Edinburgh Waverley") on save.
export function TravelLegForm({
  adventureId,
  adventureSlug,
  defaultDate,
  fromName,
}: {
  adventureId: string;
  adventureSlug: string;
  defaultDate: string;
  fromName: string | null;
}) {
  const [state, formAction, pending] = useActionState(createTravelLeg, initialState);
  const [travelMode, setTravelMode] = useState<TravelMode | "">("");

  return (
    <form
      action={formAction}
      className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-4"
    >
      <input type="hidden" name="adventure_id" value={adventureId} />
      <input type="hidden" name="adventure_slug" value={adventureSlug} />

      <div>
        <label htmlFor="destination" className="block text-sm font-medium mb-1">
          Where did you get to?
        </label>
        <input
          id="destination"
          name="destination"
          type="text"
          required
          maxLength={200}
          placeholder="e.g. Edinburgh Waverley"
          className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-amber-600"
        />
        {fromName && (
          <p className="text-xs text-stone-400 mt-1">
            Setting off from {fromName} — the leg is named for you.
          </p>
        )}
      </div>

      <fieldset>
        <legend className="block text-sm font-medium mb-1">How?</legend>
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

      <div>
        <label htmlFor="entry_date" className="block text-sm font-medium mb-1">
          Date
        </label>
        <input
          id="entry_date"
          name="entry_date"
          type="date"
          required
          defaultValue={defaultDate}
          className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-amber-600"
        />
      </div>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium mb-1">
          Notes <span className="text-stone-400">(optional)</span>
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          maxLength={20000}
          placeholder="e.g. Table seats, lunch on board"
          className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-amber-600"
        />
      </div>

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
        {pending ? "Saving…" : "Save travel leg"}
      </button>
    </form>
  );
}
