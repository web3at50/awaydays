"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/actions";
import { createTripIdea } from "@/lib/plan-actions";
import {
  IDEA_CATEGORIES,
  IDEA_CATEGORY_EMOJI,
  IDEA_CATEGORY_LABELS,
} from "@/lib/types";

const initialState: FormState = { error: null };

const inputClass =
  "w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-amber-600";

// Add a thing-to-do by hand — tucked inside a <details> so the ideas list
// stays tidy until somebody wants it.
export function IdeaForm({
  adventureId,
  adventureSlug,
}: {
  adventureId: string;
  adventureSlug: string;
}) {
  const [state, formAction, pending] = useActionState(createTripIdea, initialState);

  return (
    <details className="group rounded-2xl border border-stone-200 bg-white shadow-sm">
      <summary className="cursor-pointer list-none px-5 py-3.5 text-sm font-medium text-amber-800 hover:text-amber-900">
        <span className="group-open:hidden">+ Add your own idea</span>
        <span className="hidden group-open:inline">Add your own idea</span>
      </summary>
      <form action={formAction} className="space-y-4 px-5 pb-5">
        <input type="hidden" name="adventure_id" value={adventureId} />
        <input type="hidden" name="adventure_slug" value={adventureSlug} />

        <div>
          <label htmlFor="idea-title" className="block text-sm font-medium mb-1">
            What is it?
          </label>
          <input
            id="idea-title"
            name="title"
            type="text"
            required
            maxLength={200}
            placeholder="e.g. Camera Obscura"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="idea-category" className="block text-sm font-medium mb-1">
            Category
          </label>
          <select id="idea-category" name="category" className={inputClass}>
            {IDEA_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {IDEA_CATEGORY_EMOJI[category]} {IDEA_CATEGORY_LABELS[category]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="idea-description"
            className="block text-sm font-medium mb-1"
          >
            Notes <span className="text-stone-400">(optional)</span>
          </label>
          <textarea
            id="idea-description"
            name="description"
            rows={2}
            maxLength={2000}
            placeholder="Why it looks good, prices, opening times…"
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="idea-url" className="block text-sm font-medium mb-1">
              Web link <span className="text-stone-400">(optional)</span>
            </label>
            <input
              id="idea-url"
              name="url"
              type="url"
              maxLength={1000}
              placeholder="https://…"
              className={inputClass}
            />
          </div>
          <div>
            <label
              htmlFor="idea-address"
              className="block text-sm font-medium mb-1"
            >
              Address <span className="text-stone-400">(optional)</span>
            </label>
            <input
              id="idea-address"
              name="address"
              type="text"
              maxLength={300}
              placeholder="Street or area"
              className={inputClass}
            />
          </div>
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
          {pending ? "Saving…" : "Save idea"}
        </button>
      </form>
    </details>
  );
}
