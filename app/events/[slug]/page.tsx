import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getEventBySlug, maxPurchasable } from "@/lib/availability";
import { EventImage } from "@/components/EventImage";
import { AvailabilityBadge } from "@/components/SoldOutBadge";
import { SeatPicker } from "@/components/SeatPicker";
import { ManualBooking } from "@/components/ManualBooking";
import { WaitlistForm } from "@/components/WaitlistForm";
import { formatDate, formatTimeRange, formatMoney } from "@/lib/format";
import { AGE_RESTRICTION, PAYMENT_MODE } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) return { title: "Event not found" };

  return {
    title: event.title,
    description: event.description.slice(0, 155),
    openGraph: {
      title: event.title,
      description: event.description.slice(0, 155),
      images: event.image_url ? [event.image_url] : undefined,
    },
  };
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);

  if (!event || event.status !== "published") notFound();

  const maxSeats = maxPurchasable(event.spotsLeft);
  const isPast = new Date(event.starts_at) <= new Date();
  const address = `${event.venue.address}, ${event.venue.city}, ${event.venue.state} ${event.venue.zip}`;

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-14">
        {/* ---------------------------------------------------------- left */}
        <div>
          <div className="aspect-[3/2] overflow-hidden rounded-2xl">
            <EventImage src={event.image_url} title={event.title} priority />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <AvailabilityBadge spotsLeft={event.spotsLeft} capacity={event.capacity} />
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-ink/70">
              {AGE_RESTRICTION}
            </span>
          </div>

          <h1 className="mt-4 font-display text-4xl sm:text-5xl uppercase">
            {event.title}
          </h1>

          <p className="mt-3 text-lg text-ink/75">
            {formatDate(event.starts_at)} ·{" "}
            {formatTimeRange(event.starts_at, event.ends_at)}
          </p>

          <p className="text-ink/75">
            {event.venue.name} — {address}{" "}
            {event.venue.map_url && (
              <a
                href={event.venue.map_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-clay underline underline-offset-2"
              >
                Directions
              </a>
            )}
          </p>

          <div className="mt-7 space-y-4 text-[17px] leading-relaxed text-ink/85">
            {event.description.split("\n").filter(Boolean).map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>

          <div className="mt-9 grid gap-6 sm:grid-cols-3 border-t border-white/10 pt-7">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-sage/80">
                We bring
              </h2>
              <p className="mt-2 text-sm leading-relaxed">
                {event.whats_included ||
                  "Art supplies & setup. Instruction & facilitation."}
              </p>
            </div>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-sage/80">
                Venue provides
              </h2>
              <p className="mt-2 text-sm leading-relaxed">
                Tables & seating. Normal food and drink service.
              </p>
            </div>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-sage/80">
                You bring
              </h2>
              <p className="mt-2 text-sm leading-relaxed">
                {event.what_to_bring || "Just yourself."}
              </p>
            </div>
          </div>

          <p className="mt-7 text-sm text-ink/60">
            Questions about refunds, transfers, or what to wear? See the{" "}
            <a href="/faq" className="text-clay underline underline-offset-2">
              FAQ
            </a>
            .
          </p>
        </div>

        {/* --------------------------------------------------------- right */}
        <div className="lg:sticky lg:top-8 lg:self-start">
          <div className="rounded-2xl border border-white/10 bg-surface/80 p-6">
            <div className="flex items-baseline justify-between mb-5">
              <span className="text-2xl font-bold">
                {formatMoney(event.price_cents)}
              </span>
              <span className="text-sm text-ink/60">per person</span>
            </div>

            {isPast ? (
              <p className="text-sm text-ink/60">This event has already happened.</p>
            ) : maxSeats === 0 ? (
              <WaitlistForm eventId={event.id} />
            ) : PAYMENT_MODE === "manual" ? (
              <ManualBooking
                eventTitle={event.title}
                eventWhen={formatDate(event.starts_at)}
                priceCents={event.price_cents}
                maxSeats={maxSeats}
              />
            ) : (
              <SeatPicker
                eventId={event.id}
                priceCents={event.price_cents}
                maxSeats={maxSeats}
              />
            )}
          </div>

          <p className="mt-4 px-1 text-xs leading-relaxed text-ink/55">
            These events run with a minimum of {event.min_to_run} people. If we don't
            reach it, we'll let you know 3 days ahead and refund you in full.
          </p>
        </div>
      </div>
    </div>
  );
}
