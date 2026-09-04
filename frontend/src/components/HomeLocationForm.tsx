"use client";

import { useActionState } from "react";
import { updateHomeLocation, type FormState } from "@/lib/actions";

const initialState: FormState = { error: null };

export function HomeLocationForm({ current }: { current: string | null }) {
  const [state, formAction, pending] = useActionState(
    updateHomeLocation,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label htmlFor="home_location" className="block text-sm font-medium mb-1">
          Home location
        </label>
        <input
          id="home_location"
          name="home_location"
          type="text"
          required
          maxLength={200}
          defaultValue={current ?? ""}
          placeholder="e.g. Kendal, Cumbria"
          className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-amber-600"
        />
        <p className="text-xs text-stone-400 mt-1">
          Every trip&apos;s journey starts here — no need for a &quot;setting
          off&quot; entry.
        </p>
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 rounded-lg p-3">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save home"}
      </button>
    </form>
  );
}
