"use client";

export function BinItemActions({
  restore,
  destroy,
  confirmText,
}: {
  restore: () => Promise<void>;
  destroy: () => Promise<void>;
  confirmText: string;
}) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <form action={restore}>
        <button
          type="submit"
          className="rounded-lg border border-stone-300 text-sm font-medium px-3 py-1.5 text-stone-700 hover:border-amber-600 hover:text-amber-800"
        >
          Restore
        </button>
      </form>
      <form
        action={destroy}
        onSubmit={(event) => {
          if (!window.confirm(confirmText)) event.preventDefault();
        }}
      >
        <button
          type="submit"
          className="rounded-lg border border-red-200 bg-red-50 text-sm font-medium px-3 py-1.5 text-red-700 hover:bg-red-100"
        >
          Delete forever
        </button>
      </form>
    </div>
  );
}
