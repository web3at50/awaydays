"use client";

import { useOptimistic, useTransition } from "react";
import { toggleReaction } from "@/lib/reaction-actions";
import { REACTION_EMOJI, type ReactionRow } from "@/lib/types";

export function ReactionBar({
  reactions,
  myProfileId,
  myName,
  entryId,
  mediaId,
  slug,
  pageEntryId,
  variant = "light",
  readOnly = false,
}: {
  reactions: ReactionRow[];
  myProfileId?: string;
  myName?: string;
  entryId?: string;
  mediaId?: string;
  slug?: string;
  pageEntryId?: string;
  variant?: "light" | "dark";
  readOnly?: boolean;
}) {
  const [, startTransition] = useTransition();
  const [shown, toggleShown] = useOptimistic(
    reactions,
    (current, emoji: string) => {
      const mine = current.find(
        (r) => r.profile_id === myProfileId && r.emoji === emoji,
      );
      if (mine) {
        return current.filter((r) => r !== mine);
      }
      return [
        ...current,
        { emoji, profile_id: myProfileId ?? "", display_name: myName ?? "Me" },
      ];
    },
  );

  const interactive = !readOnly && myProfileId && slug && pageEntryId;
  const dark = variant === "dark";

  function names(emoji: string): string {
    return shown
      .filter((r) => r.emoji === emoji)
      .map((r) => r.display_name)
      .join(", ");
  }

  function react(emoji: string) {
    if (!interactive) return;
    startTransition(async () => {
      toggleShown(emoji);
      await toggleReaction({ emoji, entryId, mediaId, slug, pageEntryId });
    });
  }

  if (readOnly && shown.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {REACTION_EMOJI.map((emoji) => {
        const who = names(emoji);
        if (!interactive && !who) return null;
        const mine = shown.some(
          (r) => r.profile_id === myProfileId && r.emoji === emoji,
        );
        const label = who
          ? `${emoji} reactions from ${who}`
          : `React with ${emoji}`;
        const className = [
          "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm transition-colors",
          dark
            ? mine
              ? "border-amber-400 bg-amber-400/20 text-white"
              : "border-white/20 bg-white/10 text-white/90 hover:bg-white/20"
            : mine
              ? "border-amber-600 bg-amber-100 text-amber-950"
              : "border-stone-200 bg-white text-stone-700 hover:border-amber-600",
        ].join(" ");

        if (!interactive) {
          return (
            <span key={emoji} className={className}>
              <span aria-hidden>{emoji}</span>
              <span className={`text-xs ${dark ? "text-white/80" : "text-stone-500"}`}>
                {who}
              </span>
            </span>
          );
        }
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => react(emoji)}
            aria-label={label}
            aria-pressed={mine}
            className={className}
          >
            <span aria-hidden>{emoji}</span>
            {who && (
              <span className={`text-xs ${dark ? "text-white/80" : "text-stone-500"}`}>
                {who}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
