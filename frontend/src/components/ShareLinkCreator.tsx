"use client";

import { useActionState } from "react";
import type { ShareCreateState } from "@/lib/share-actions";
import { ShareLinkUrl } from "@/components/ShareLinkUrl";

const initialState: ShareCreateState = { url: null, error: null };

export function ShareLinkCreator({
  action,
  subject = "this trip",
}: {
  action: (
    prev: ShareCreateState,
    formData: FormData,
  ) => Promise<ShareCreateState>;
  subject?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
      <h2 className="font-semibold mb-1">Create a sharing link</h2>
      <p className="text-sm text-stone-500 mb-4">
        Anyone with the link can view {subject}. No account is needed. Name
        the link after whoever you&apos;re sending it to, so you can see later
        who has which link.
      </p>

      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 basis-48">
          <label htmlFor="label" className="block text-sm font-medium mb-1">
            Shared with
          </label>
          <input
            id="label"
            name="label"
            type="text"
            maxLength={80}
            placeholder="e.g. Grandparents, the cousins"
            className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base bg-white focus:outline-none focus:ring-2 focus:ring-amber-600"
          />
        </div>
        <div>
          <label htmlFor="expires" className="block text-sm font-medium mb-1">
            Expires
          </label>
          <select
            id="expires"
            name="expires"
            defaultValue="0"
            className="rounded-lg border border-stone-300 px-3 py-2.5 text-base bg-white focus:outline-none focus:ring-2 focus:ring-amber-600"
          >
            <option value="0">Never</option>
            <option value="7">After 7 days</option>
            <option value="30">After 30 days</option>
            <option value="90">After 90 days</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-amber-700 text-white font-medium px-4 py-2.5 hover:bg-amber-800 disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create link"}
        </button>
      </form>

      {state.error && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 rounded-lg p-3 mt-3">
          {state.error}
        </p>
      )}

      {state.url && (
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-medium text-amber-900 mb-2">
            Your link is ready — it also stays available in the list below:
          </p>
          <ShareLinkUrl url={state.url} />
        </div>
      )}
    </div>
  );
}
