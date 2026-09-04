"use client";

import { useActionState, useState } from "react";
import type { FormState } from "@/lib/actions";
import { createItineraryItem, updateItineraryItem } from "@/lib/plan-actions";
import {
  ITINERARY_KINDS,
  ITINERARY_KIND_EMOJI,
  ITINERARY_KIND_LABELS,
  type ItineraryItem,
  type ItineraryKind,
} from "@/lib/types";

const initialState: FormState = { error: null };

const TRANSPORT_KINDS: ItineraryKind[] = ["train", "flight", "ferry"];

// "2030-05-03T09:15:00+00:00" → "2030-05-03T09:15" for datetime-local
function toLocalInput(iso: string | null): string {
  return iso ? iso.slice(0, 16) : "";
}

const inputClass =
  "w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-amber-600";

export function ItineraryItemForm({
  adventureId,
  adventureSlug,
  item,
}: {
  adventureId: string;
  adventureSlug: string;
  item?: ItineraryItem;
}) {
  const action = item
    ? updateItineraryItem.bind(null, item.id)
    : createItineraryItem;
  const [state, formAction, pending] = useActionState(action, initialState);
  const [kind, setKind] = useState<ItineraryKind | "">(item?.kind ?? "");

  const isTransport = kind !== "" && TRANSPORT_KINDS.includes(kind);
  const isStay = kind === "hotel";
  const startLabel = isStay ? "Check-in" : isTransport ? "Departs" : "Starts";
  const endLabel = isStay ? "Check-out" : isTransport ? "Arrives" : "Ends";

  return (
    <form
      action={formAction}
      className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-4"
    >
      <input type="hidden" name="adventure_id" value={adventureId} />
      <input type="hidden" name="adventure_slug" value={adventureSlug} />

      <fieldset>
        <legend className="block text-sm font-medium mb-1">
          What kind of booking?
        </legend>
        <input type="hidden" name="kind" value={kind} />
        <div className="flex flex-wrap gap-1.5">
          {ITINERARY_KINDS.map((k) => {
            const selected = kind === k;
            return (
              <button
                key={k}
                type="button"
                aria-pressed={selected}
                onClick={() => setKind(k)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  selected
                    ? "border-amber-600 bg-amber-100 text-amber-950"
                    : "border-stone-300 bg-white text-stone-700 hover:border-amber-600"
                }`}
              >
                <span aria-hidden>{ITINERARY_KIND_EMOJI[k]}</span>
                {ITINERARY_KIND_LABELS[k]}
              </button>
            );
          })}
        </div>
      </fieldset>

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
          defaultValue={item?.title ?? ""}
          placeholder="e.g. Train to Edinburgh"
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="provider" className="block text-sm font-medium mb-1">
            Company <span className="text-stone-400">(optional)</span>
          </label>
          <input
            id="provider"
            name="provider"
            type="text"
            maxLength={200}
            defaultValue={item?.provider ?? ""}
            placeholder="e.g. LNER"
            className={inputClass}
          />
        </div>
        <div>
          <label
            htmlFor="booking_reference"
            className="block text-sm font-medium mb-1"
          >
            Booking reference <span className="text-stone-400">(optional)</span>
          </label>
          <input
            id="booking_reference"
            name="booking_reference"
            type="text"
            maxLength={100}
            defaultValue={item?.booking_reference ?? ""}
            placeholder="e.g. ABC123"
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="starts_at" className="block text-sm font-medium mb-1">
            {startLabel} <span className="text-stone-400">(optional)</span>
          </label>
          <input
            id="starts_at"
            name="starts_at"
            type="datetime-local"
            defaultValue={toLocalInput(item?.starts_at ?? null)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="ends_at" className="block text-sm font-medium mb-1">
            {endLabel} <span className="text-stone-400">(optional)</span>
          </label>
          <input
            id="ends_at"
            name="ends_at"
            type="datetime-local"
            defaultValue={toLocalInput(item?.ends_at ?? null)}
            className={inputClass}
          />
        </div>
      </div>
      <p className="text-xs text-stone-400 -mt-2">
        Times are local to the place — type them exactly as the ticket shows.
      </p>

      {isTransport ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="from_location"
              className="block text-sm font-medium mb-1"
            >
              From <span className="text-stone-400">(optional)</span>
            </label>
            <input
              id="from_location"
              name="from_location"
              type="text"
              maxLength={200}
              defaultValue={item?.from_location ?? ""}
              placeholder="e.g. London King's Cross"
              className={inputClass}
            />
          </div>
          <div>
            <label
              htmlFor="to_location"
              className="block text-sm font-medium mb-1"
            >
              To <span className="text-stone-400">(optional)</span>
            </label>
            <input
              id="to_location"
              name="to_location"
              type="text"
              maxLength={200}
              defaultValue={item?.to_location ?? ""}
              placeholder="e.g. Edinburgh Waverley"
              className={inputClass}
            />
          </div>
        </div>
      ) : (
        <div>
          <label htmlFor="location" className="block text-sm font-medium mb-1">
            Where <span className="text-stone-400">(optional)</span>
          </label>
          <input
            id="location"
            name="location"
            type="text"
            maxLength={300}
            defaultValue={item?.location ?? ""}
            placeholder="e.g. 12 Harbour Street, Whitby"
            className={inputClass}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="cost_amount" className="block text-sm font-medium mb-1">
            Cost <span className="text-stone-400">(optional)</span>
          </label>
          <input
            id="cost_amount"
            name="cost_amount"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            defaultValue={item?.cost_amount ?? ""}
            placeholder="e.g. 420"
            className={inputClass}
          />
        </div>
        <div>
          <label
            htmlFor="cost_currency"
            className="block text-sm font-medium mb-1"
          >
            Currency
          </label>
          <select
            id="cost_currency"
            name="cost_currency"
            defaultValue={item?.cost_currency ?? "GBP"}
            className={inputClass}
          >
            <option value="GBP">£ GBP</option>
            <option value="EUR">€ EUR</option>
            <option value="USD">$ USD</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="url" className="block text-sm font-medium mb-1">
          Web link <span className="text-stone-400">(optional)</span>
        </label>
        <input
          id="url"
          name="url"
          type="url"
          maxLength={1000}
          defaultValue={item?.url ?? ""}
          placeholder="e.g. https://www.lner.co.uk"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium mb-1">
          Notes <span className="text-stone-400">(optional)</span>
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          maxLength={10000}
          defaultValue={item?.notes ?? ""}
          placeholder="e.g. Coach B, seats 12 and 13 · booked under Alex Fairweather"
          className={inputClass}
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
        {pending ? "Saving…" : item ? "Save changes" : "Add to itinerary"}
      </button>
    </form>
  );
}
