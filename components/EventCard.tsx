import Link from "next/link";
import { EventImage } from "./EventImage";
import { AvailabilityBadge } from "./SoldOutBadge";
import { formatDateShort, formatTime, formatMoney } from "@/lib/format";
import type { EventWithAvailability } from "@/lib/types";

export function EventCard({ event }: { event: EventWithAvailability }) {
  return (
    <Link
      href={`/events/${event.slug}`}
      className="group block overflow-hidden rounded-2xl border border-white/10 bg-surface/80
                 transition-shadow hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-clay/40"
    >
      <div className="aspect-[3/2] overflow-hidden">
        <EventImage src={event.image_url} title={event.title} />
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-bold text-lg leading-tight group-hover:text-clay transition-colors">
            {event.title}
          </h3>
          <span className="shrink-0 font-semibold">{formatMoney(event.price_cents)}</span>
        </div>

        <p className="mt-2 text-sm text-ink/70">
          {formatDateShort(event.starts_at)} · {formatTime(event.starts_at)}
        </p>
        <p className="text-sm text-ink/70">
          {event.venue.name}, {event.venue.city}
        </p>

        <div className="mt-3">
          <AvailabilityBadge spotsLeft={event.spotsLeft} capacity={event.capacity} />
        </div>
      </div>
    </Link>
  );
}
