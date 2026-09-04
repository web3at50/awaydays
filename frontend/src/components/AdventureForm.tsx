"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/actions";
import type { AdventureType } from "@/lib/types";

interface AdventureInitial {
  title: string;
  type: AdventureType;
  start_date: string;
  end_date: string;
  location: string | null;
  summary: string | null;
}

const initialState: FormState = { error: null };

export function AdventureForm({
  action,
  initial,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial?: AdventureInitial;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form
      action={formAction}
      className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-4"
    >
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
          placeholder="e.g. Cornwall summer holiday"
          className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-amber-600"
        />
      </div>

      <div>
        <label htmlFor="type" className="block text-sm font-medium mb-1">
          Type
        </label>
        <select
          id="type"
          name="type"
          required
          defaultValue={initial?.type ?? "day_trip"}
          className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base bg-white focus:outline-none focus:ring-2 focus:ring-amber-600"
        >
          <option value="day_trip">Day trip</option>
          <option value="holiday">Holiday</option>
          <option value="event">Event</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="start_date" className="block text-sm font-medium mb-1">
            Start date
          </label>
          <input
            id="start_date"
            name="start_date"
            type="date"
            required
            defaultValue={initial?.start_date ?? today}
            className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-amber-600"
          />
        </div>
        <div>
          <label htmlFor="end_date" className="block text-sm font-medium mb-1">
            End date
          </label>
          <input
            id="end_date"
            name="end_date"
            type="date"
            required
            defaultValue={initial?.end_date ?? today}
            className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-amber-600"
          />
        </div>
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
          placeholder="e.g. St Ives, Cornwall"
          className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-amber-600"
        />
      </div>

      <div>
        <label htmlFor="summary" className="block text-sm font-medium mb-1">
          Summary <span className="text-stone-400">(optional)</span>
        </label>
        <textarea
          id="summary"
          name="summary"
          rows={3}
          maxLength={2000}
          defaultValue={initial?.summary ?? ""}
          placeholder="A sentence or two about this trip"
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
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
