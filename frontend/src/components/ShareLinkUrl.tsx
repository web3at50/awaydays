"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

// Whether the browser offers the system share sheet never changes during a
// visit, so the "store" is constant; the server snapshot is false, keeping
// the server render identical and the button appearing only after hydration
// on browsers that support it.
const noopSubscribe = () => () => {};
function useCanShare(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => "share" in navigator,
    () => false,
  );
}

// Shows a stored share URL with a copy button, so a link can be copied
// again any time after creation. On phones that support the system share
// sheet a Share button appears too, for sending straight into WhatsApp,
// Messages and the like.
export function ShareLinkUrl({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const canShare = useCanShare();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      <code className="min-w-0 flex-1 basis-48 break-all rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs">
        {url}
      </code>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(url);
            setCopied(true);
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => setCopied(false), 2000);
          }}
          className="rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
        {canShare && (
          <button
            type="button"
            onClick={() => {
              // The visitor cancelling the share sheet rejects; that's fine.
              navigator.share({ url }).catch(() => {});
            }}
            className="rounded-lg bg-amber-700 px-3 py-2 text-sm font-medium text-white hover:bg-amber-800"
          >
            Share
          </button>
        )}
      </div>
    </div>
  );
}
