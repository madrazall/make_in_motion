import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { isDemoMode, DEMO_ORDER } from "@/lib/demo";
import { getEventById } from "@/lib/availability";
import { formatDate, formatTimeRange, formatMoney } from "@/lib/format";
import { BUSINESS } from "@/lib/config";
import { PurchaseEvent } from "@/components/PurchaseEvent";
import type { OrderRow, TicketRow } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your booking", robots: { index: false } };

export default async function BookedPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  const data = isDemoMode()
    ? { ...DEMO_ORDER, confirmation_code: code.toUpperCase() }
    : (
        await db()
          .from("orders")
          .select("*")
          .eq("confirmation_code", code.toUpperCase())
          .maybeSingle()
      ).data;

  if (!data) notFound();
  const order = data as OrderRow;

  const event = await getEventById(order.event_id);
  if (!event) notFound();

  const tickets = isDemoMode()
    ? []
    : ((await db()
        .from("tickets")
        .select("ticket_number, seat_number, code, checked_in_at")
        .eq("order_id", order.id)
        .order("seat_number")).data ?? []) as Pick<
          TicketRow,
          "ticket_number" | "seat_number" | "code" | "checked_in_at"
        >[];

  /**
   * The webhook may not have landed yet — Stripe usually fires within a second
   * or two, but the redirect can win the race. Show a friendly pending state
   * rather than implying the payment failed.
   */
  const pending = order.status === "pending";
  const address = `${event.venue.address}, ${event.venue.city}, ${event.venue.state} ${event.venue.zip}`;

  return (
    <div className="mx-auto max-w-xl px-5 py-14">
      {/* Only a settled order is a purchase — a pending one may still fail. */}
      {!pending && (
        <PurchaseEvent
          transactionId={order.confirmation_code}
          value={order.amount_cents / 100}
          itemId={event.id}
          itemName={event.title}
          quantity={order.seats}
        />
      )}

      {pending ? (
        <>
          <h1 className="text-3xl font-bold">Just a moment…</h1>
          <p className="mt-3 text-ink/70">
            We're confirming your payment. This usually takes a few seconds — refresh
            the page. Your confirmation email will arrive either way.
          </p>
        </>
      ) : (
        <>
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-sage">
            Confirmed
          </p>
          <h1 className="mt-2 font-display text-5xl uppercase">You're in.</h1>
          <p className="mt-3 text-lg text-ink/70">
            {order.seats} {order.seats === 1 ? "spot" : "spots"} reserved. We've emailed
            your confirmation to {order.email}.
          </p>
        </>
      )}

      {!pending && tickets.length > 0 && (
        <div className="mt-8 rounded-2xl border border-white/10 bg-surface/80 p-6">
          <h2 className="font-bold">Your tickets</h2>
          <p className="mt-1 text-sm text-ink/60">
            Each ticket has its own number and one-time check-in code.
          </p>
          <div className="mt-4 space-y-3">
            {tickets.map((ticket) => (
              <div key={ticket.ticket_number} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-ink/55">Ticket</span>
                  <span className="font-mono font-semibold">{ticket.ticket_number}</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-4">
                  <span className="text-sm text-ink/55">Seat</span>
                  <span className="font-semibold">{ticket.seat_number}</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-4">
                  <span className="text-sm text-ink/55">Check-in code</span>
                  <span className="font-mono font-semibold tracking-wide">{ticket.code}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 rounded-2xl border border-white/10 bg-surface/80 p-6">
        <dl className="space-y-3 text-[15px]">
          <Row label="Confirmation">
            <span className="font-mono text-base">{order.confirmation_code}</span>
          </Row>
          <Row label="What">{event.title}</Row>
          <Row label="When">
            {formatDate(event.starts_at)},{" "}
            {formatTimeRange(event.starts_at, event.ends_at)}
          </Row>
          <Row label="Where">
            {event.venue.name}
            <br />
            <span className="font-normal text-ink/70">{address}</span>
            {event.venue.map_url && (
              <>
                <br />
                <a
                  href={event.venue.map_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-clay underline underline-offset-2 font-normal"
                >
                  Get directions
                </a>
              </>
            )}
          </Row>
          <Row label="Spots">{String(order.seats)}</Row>
          <Row label="Paid">{formatMoney(order.amount_cents)}</Row>
        </dl>
      </div>

      <div className="mt-8">
        <h2 className="font-bold">Before you come</h2>
        <ul className="mt-2 space-y-1.5 text-[15px] leading-relaxed text-ink/80 list-disc pl-5">
          <li>
            <strong>21+ only</strong> — please bring valid ID.
          </li>
          <li>Wear something you don't mind getting messy — depending on the project that's paint, dye, ink, wax or soil.</li>
          <li>
            We start on time so everyone finishes together. More than 15 minutes late
            and we may not be able to catch you up.
          </li>
          <li>Just bring yourself — we handle the rest.</li>
        </ul>
      </div>

      <div className="mt-7 rounded-xl bg-white/[0.04] p-5 text-[15px] leading-relaxed">
        <p className="font-bold">Can't make it?</p>
        <p className="mt-1 text-ink/80">
          Transfer your ticket to a friend any time before the event starts — just send
          them the ticket. No fee, and nothing you need to tell us. See the{" "}
          <a href="/faq#refunds" className="text-clay underline underline-offset-2">
            full refund policy
          </a>
          .
        </p>
        <p className="mt-3 text-ink/80">
          <a href={`mailto:${BUSINESS.contactEmail}`} className="text-clay underline underline-offset-2">
            {BUSINESS.contactEmail}
          </a>{" "}
          ·{" "}
          <a href={BUSINESS.phoneHref} className="text-clay underline underline-offset-2">
            {BUSINESS.phone}
          </a>
        </p>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <dt className="w-28 shrink-0 text-ink/55">{label}</dt>
      <dd className="font-semibold">{children}</dd>
    </div>
  );
}
