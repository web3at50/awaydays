import Link from "next/link";
import { formatDateRange } from "@/lib/dates";
import { formatDistance, type JourneyLeg } from "@/lib/journeys";
import { TRAVEL_MODE_EMOJI, TRAVEL_MODE_LABELS, type TravelMode } from "@/lib/types";
import { JourneyBanner } from "@/components/JourneyBanner";

// Compact rendering for travel-leg entries in a diary feed: a single leg
// becomes a slim strip, a run of consecutive legs becomes one chain card
// (Home → King's Cross → Edinburgh → Inverness). Items arrive in
// chronological order. Pure markup — safe on signed-in and shared pages.

export interface TravelLegItem {
  id: string;
  title: string;
  entry_date: string;
  mode: TravelMode | null;
  leg: JourneyLeg | null;
  notes: string | null;
  /** Entry page link (signed-in); null on shared pages */
  href: string | null;
}

function legMiles(leg: JourneyLeg): number {
  return (leg.roadKm ?? leg.distanceKm) * 0.621371;
}

function chainSummary(items: TravelLegItem[]): string {
  const located = items.filter((item) => item.leg !== null);
  const totalMiles = located.reduce((sum, item) => sum + legMiles(item.leg!), 0);
  const legsLabel = `${items.length} ${items.length === 1 ? "leg" : "legs"}`;
  if (totalMiles === 0) return legsLabel;

  const miles = `${Math.round(totalMiles)} miles`;
  const modes = new Set(items.map((item) => item.mode).filter(Boolean));
  if (modes.size === 1) {
    const mode = [...modes][0] as TravelMode;
    const how =
      mode === "walk" ? "on foot" : `by ${TRAVEL_MODE_LABELS[mode].toLowerCase()}`;
    return `${legsLabel} · ${miles} ${how}`;
  }
  return `${legsLabel} · ${miles}`;
}

function MaybeLink({
  id,
  href,
  className,
  children,
}: {
  id?: string;
  href: string | null;
  className: string;
  children: React.ReactNode;
}) {
  if (!href) {
    return (
      <div id={id} className={`${className} scroll-mt-4`}>
        {children}
      </div>
    );
  }
  return (
    <Link id={id} href={href} className={`${className} scroll-mt-4 group/leg`}>
      {children}
    </Link>
  );
}

function StopRow({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden
        className="h-2.5 w-2.5 shrink-0 rounded-full border-2 border-amber-700 bg-amber-50"
      />
      <span className="text-sm font-semibold text-amber-950">{name}</span>
    </div>
  );
}

function Connector({ item }: { item: TravelLegItem }) {
  const emoji = item.mode ? TRAVEL_MODE_EMOJI[item.mode] : "📍";
  const detail = item.leg
    ? item.leg.roadKm !== null
      ? `${formatDistance(item.leg.roadKm)} by road`
      : formatDistance(item.leg.distanceKm)
    : null;
  return (
    <div className="flex items-center gap-2.5 py-0.5">
      <span aria-hidden className="flex w-2.5 shrink-0 justify-center">
        <span className="h-7 border-l-2 border-dashed border-amber-400" />
      </span>
      <span aria-hidden className="text-base leading-none">
        {emoji}
      </span>
      {detail && <span className="text-xs text-amber-800/80">{detail}</span>}
    </div>
  );
}

function ChainCard({ items }: { items: TravelLegItem[] }) {
  const firstLeg = items.find((item) => item.leg !== null)?.leg ?? null;
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-800">
        Travelling ·{" "}
        {formatDateRange(items[0].entry_date, items[items.length - 1].entry_date)}
      </p>

      {firstLeg && <StopRow name={firstLeg.from.name} />}

      {items.map((item) => (
        <MaybeLink
          key={item.id}
          id={`entry-${item.id}`}
          href={item.href}
          className="block rounded-lg -mx-1.5 px-1.5 hover:bg-amber-100/70"
        >
          <Connector item={item} />
          <StopRow name={item.leg ? item.leg.to.name : item.title} />
          {item.notes && (
            <p className="ml-5 mt-0.5 text-xs text-amber-900/80 whitespace-pre-line">
              {item.notes}
            </p>
          )}
        </MaybeLink>
      ))}

      <p className="mt-2.5 border-t border-amber-200 pt-2 text-xs text-amber-800/80">
        {chainSummary(items)}
      </p>
    </div>
  );
}

function SingleLegStrip({ item }: { item: TravelLegItem }) {
  const emoji = item.mode ? TRAVEL_MODE_EMOJI[item.mode] : "📍";
  return (
    <MaybeLink id={`entry-${item.id}`} href={item.href} className="block">
      {item.leg ? (
        <JourneyBanner leg={item.leg} />
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-950">
            <span aria-hidden>{emoji} </span>
            {item.title}
          </p>
        </div>
      )}
      {item.notes && (
        <p className="mt-1 px-1 text-xs text-stone-500 whitespace-pre-line">{item.notes}</p>
      )}
    </MaybeLink>
  );
}

export function TravelLegCards({ items }: { items: TravelLegItem[] }) {
  if (items.length === 0) return null;
  if (items.length === 1) return <SingleLegStrip item={items[0]} />;
  return <ChainCard items={items} />;
}
