import { formatDistance, type JourneyLeg } from "@/lib/journeys";
import { TRAVEL_MODE_EMOJI } from "@/lib/types";

// The Facebook-flight-style strip: "Kendal ··🚗··→ Keswick · 30 miles".
// Pure markup — renders instantly in the feed with no map tiles.
export function JourneyBanner({ leg }: { leg: JourneyLeg }) {
  const emoji = leg.mode ? TRAVEL_MODE_EMOJI[leg.mode] : "📍";

  return (
    <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-amber-950 whitespace-nowrap max-w-[38%] truncate">
          {leg.from.name}
        </span>
        <span className="relative flex-1 flex items-center min-w-8" aria-hidden>
          <span className="w-full border-t-2 border-dashed border-amber-400" />
          <span className="absolute right-0 -mr-0.5 text-amber-400 text-xs leading-none">
            ▶
          </span>
          <span className="absolute left-1/2 -translate-x-1/2 bg-amber-50 px-1.5 text-lg">
            {emoji}
          </span>
        </span>
        <span className="text-sm font-semibold text-amber-950 whitespace-nowrap max-w-[38%] truncate">
          {leg.to.name}
        </span>
      </div>
      <p className="text-center text-xs text-amber-800/80 mt-1">
        {leg.roadKm !== null
          ? `${formatDistance(leg.roadKm)} by road`
          : formatDistance(leg.distanceKm)}
      </p>
    </div>
  );
}
