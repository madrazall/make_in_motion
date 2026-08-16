"use client";

import { useState } from "react";
import Link from "next/link";
import { EventImage } from "./EventImage";
import { formatMoney } from "@/lib/format";
import { formatDuration, type Workshop } from "@/lib/workshops";

/**
 * The menu, with occasion filtering.
 *
 * Two audiences read this page: guests deciding what sounds fun, and venue
 * managers deciding what they'd let happen in their room. The filter serves
 * the first; the duration, group size, and mess level serve the second.
 */
export function WorkshopMenu({
  workshops,
  occasions,
}: {
  workshops: Workshop[];
  occasions: string[];
}) {
  const [filter, setFilter] = useState<string | null>(null);

  const shown = filter
    ? workshops.filter((w) => w.good_for.includes(filter))
    : workshops;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <FilterChip active={!filter} onClick={() => setFilter(null)}>
          Everything
        </FilterChip>
        {occasions.map((o) => (
          <FilterChip key={o} active={filter === o} onClick={() => setFilter(o)}>
            {o}
          </FilterChip>
        ))}
      </div>

      <p className="mt-4 text-sm text-ink/55">
        {shown.length} {shown.length === 1 ? "workshop" : "workshops"}
        {filter && ` for ${filter.toLowerCase()}`}
      </p>

      <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((w) => (
          <Link
            key={w.id}
            href={`/workshops/${w.slug}`}
            className="group flex flex-col overflow-hidden rounded-2xl border border-white/10
                       bg-surface transition-shadow hover:shadow-lg
                       focus:outline-none focus:ring-2 focus:ring-clay/40"
          >
            <div className="aspect-[16/10] overflow-hidden">
              <EventImage src={w.image_url} title={w.name} />
            </div>

            <div className="flex flex-1 flex-col p-5">
              <h3 className="font-bold leading-tight group-hover:text-clay transition-colors">
                {w.name}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink/70">{w.tagline}</p>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {w.good_for.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[11px] font-medium text-ink/60"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <div className="mt-auto pt-4 flex items-baseline justify-between text-sm">
                <span className="font-semibold">
                  from {formatMoney(w.base_price_cents)}
                </span>
                <span className="text-ink/50">{formatDuration(w.duration_minutes)}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-sage text-paper shadow-neon-cyan"
          : "bg-surface border border-white/12 text-ink/70 hover:border-clay hover:text-clay"
      }`}
    >
      {children}
    </button>
  );
}
