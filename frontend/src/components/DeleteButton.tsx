"use client";

// Soft-delete with a plain-language confirmation. Nothing is destroyed:
// deleted items keep their photos and can be restored from the recycle bin.
export function DeleteButton({
  action,
  label,
  confirmText,
}: {
  action: () => Promise<void>;
  label: string;
  confirmText: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(confirmText)) event.preventDefault();
      }}
    >
      <button
        type="submit"
        className="w-full rounded-lg border border-red-200 bg-red-50 text-red-700 font-medium py-3 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-400"
      >
        {label}
      </button>
    </form>
  );
}
