import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { isDemoMode, DEMO_ORDERS, DEMO_WAITLIST } from "@/lib/demo";
import { getEventById } from "@/lib/availability";
import { getCheckInCountsByOrder } from "@/lib/tickets";
import {
  cloneEvent,
  setEventStatus,
  renameGuest,
  toggleCheckIn,
  createManualOrderAction,
  notifySubscribers,
  deleteEvent,
} from "../../actions";
import { formatDate, formatTimeRange, formatMoney, relativeDays } from "@/lib/format";
import { MAX_SEATS_PER_ORDER } from "@/lib/config";
import { DeleteEventButton } from "@/components/admin/DeleteEventButton";
import type { OrderRow } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

export default async function AdminEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notified?: string }>;
}) {
  const { id } = await params;
  const { notified } = await searchParams;
  const event = await getEventById(id);
  if (!event) notFound();

  const [{ data: orderData }, { data: waitlistData }, { count: subscriberCount }, { data: alreadyNotified }] =
    isDemoMode()
      ? [{ data: DEMO_ORDERS }, { data: DEMO_WAITLIST }, { count: 0 }, { data: [] }]
      : await Promise.all([
          db()
            .from("orders")
            .select("*")
            .eq("event_id", id)
            .in("status", ["paid", "partially_refunded"])
            .order("created_at", { ascending: true }),
          db().from("waitlist").select("*").eq("event_id", id).order("created_at"),
          db().from("subscribers").select("id", { count: "exact", head: true }),
          db().from("subscriber_notifications").select("subscriber_id").eq("event_id", id),
        ]);

  const notifiedCount = alreadyNotified?.length ?? 0;
  const notifiableCount = Math.max((subscriberCount ?? 0) - notifiedCount, 0);
  const orders = (orderData ?? []) as OrderRow[];
  const checkInCounts = isDemoMode()
    ? new Map<string, { total: number; checkedIn: number }>()
    : await getCheckInCountsByOrder(orders.map((o) => o.id));
  const headcount = orders.reduce((n, o) => n + o.seats, 0);
  const revenue = orders.reduce((n, o) => n + o.amount_cents - o.refund_cents, 0);
  const belowMinimum = headcount < event.min_to_run;

  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      <Link href="/admin" className="text-sm text-clay hover:underline">
        ← Dashboard
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{event.title}</h1>
          <p className="mt-1 text-ink/70">
            {formatDate(event.starts_at)} ·{" "}
            {formatTimeRange(event.starts_at, event.ends_at)} · {event.venue.name}
          </p>
          <p className="text-sm text-ink/50">
            {relativeDays(event.starts_at)} · status: {event.status}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/admin/roster/${event.id}`}
            className="rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold"
          >
            Download roster CSV
          </a>
          <Link
            href={`/admin/events/${event.id}/edit`}
            className="rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold"
          >
            Edit event
          </Link>
          <form action={cloneEvent.bind(null, event.id)}>
            <button className="rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold">
              Clone to next week
            </button>
          </form>
          {event.status === "draft" && (
            <form action={setEventStatus.bind(null, event.id, "published")}>
              <button className="rounded-lg bg-sage px-3 py-2 text-sm font-bold uppercase tracking-wide text-paper shadow-neon-cyan hover:bg-sage/85 transition-all">
                Publish
              </button>
            </form>
          )}
          {event.status === "published" && (
            <form action={setEventStatus.bind(null, event.id, "cancelled")}>
              <button className="rounded-lg border-2 border-clay px-3 py-2 text-sm font-semibold text-clay">
                Cancel event
              </button>
            </form>
          )}
          {event.status === "published" && notifiableCount > 0 && (
            <form action={notifySubscribers.bind(null, event.id)}>
              <button className="rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold">
                Notify {notifiableCount} subscriber{notifiableCount === 1 ? "" : "s"}
              </button>
            </form>
          )}
          <DeleteEventButton action={deleteEvent.bind(null, event.id)} headcount={headcount} />
        </div>
      </div>

      {notified !== undefined && (
        <div className="mt-4 rounded-xl border border-sage/30 bg-sage/10 p-3 text-sm text-sage">
          Emailed {notified} subscriber{notified === "1" ? "" : "s"} about this event.
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Headcount" value={`${headcount} / ${event.capacity}`} alert={belowMinimum} />
        <Stat label="Minimum to run" value={String(event.min_to_run)} />
        <Stat label="Spots left" value={String(event.spotsLeft)} />
        <Stat label="Revenue" value={formatMoney(revenue)} />
      </div>

      {belowMinimum && (
        <div className="mt-4 rounded-xl border-2 border-clay/30 bg-clay/5 p-4 text-sm">
          <strong className="text-clay">Below minimum.</strong> {headcount} of{" "}
          {event.min_to_run} needed. If you cancel, everyone gets a full refund —
          issue those from the Stripe dashboard.
        </div>
      )}

      {/* ------------------------------------------------------- manual sale */}
      <details className="mt-10 rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <summary className="cursor-pointer text-sm font-bold">
          Add a sale (door / cash / Venmo / Stripe down)
        </summary>
        <p className="mt-2 text-xs text-ink/55">
          For a payment that already happened — cash in hand, a Venmo you already saw
          land. Goes through the same seat lock as the website, so it can&apos;t oversell.
        </p>
        <form action={createManualOrderAction.bind(null, event.id)} className="mt-3 grid gap-3 sm:grid-cols-2">
          <input name="customer_name" required placeholder="Name" className="field" />
          <input name="email" type="email" placeholder="Email (optional)" className="field" />
          <input name="phone" placeholder="Phone (optional)" className="field" />
          <select name="seats" defaultValue="1" className="field">
            {Array.from({ length: Math.min(event.spotsLeft || 1, MAX_SEATS_PER_ORDER) }, (_, i) => i + 1).map(
              (n) => (
                <option key={n} value={n}>
                  {n} spot{n === 1 ? "" : "s"}
                </option>
              )
            )}
          </select>
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0"
            defaultValue={(event.price_cents / 100).toFixed(2)}
            placeholder="Amount collected ($)"
            className="field"
          />
          <select name="payment_method" defaultValue="cash" className="field">
            <option value="cash">Cash</option>
            <option value="venmo">Venmo</option>
            <option value="cashapp">CashApp</option>
            <option value="comp">Comp (free)</option>
            <option value="stripe">Stripe (was down, took it another way)</option>
            <option value="other">Other</option>
          </select>
          <input name="notes" placeholder="Notes (optional)" className="field" />
          <label className="flex items-center gap-2 text-sm text-ink/70 sm:col-span-2">
            <input type="checkbox" name="check_in_now" defaultChecked className="h-4 w-4" />
            They&apos;re here right now — mark checked in immediately
          </label>
          <button className="rounded-lg bg-sage px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-paper shadow-neon-cyan hover:bg-sage/85 transition-all sm:col-span-2">
            Add &amp; mark paid
          </button>
        </form>
      </details>

      {/* ------------------------------------------------------------ roster */}
      <h2 className="mt-10 text-lg font-bold">
        Guest list{" "}
        <span className="font-normal text-ink/50">
          ({orders.length} order{orders.length === 1 ? "" : "s"})
        </span>
      </h2>
      <p className="mt-1 text-sm text-ink/60">
        Print this before you leave — brewery wifi is not to be trusted. Transfers
        arrive by text; edit the name here.
      </p>

      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-ink/55">
            <th className="pb-2 font-semibold">Name</th>
            <th className="pb-2 font-semibold">Contact</th>
            <th className="pb-2 font-semibold">Spots</th>
            <th className="pb-2 font-semibold">Code</th>
            <th className="pb-2 font-semibold">In</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="border-b border-white/5 align-top">
              <td className="py-2.5">
                <form action={async (fd: FormData) => {
                  "use server";
                  await renameGuest(o.id, String(fd.get("name") ?? ""));
                }}>
                  <input
                    name="name"
                    defaultValue={o.customer_name}
                    className="w-full rounded border border-transparent px-1.5 py-1
                               hover:border-white/15 focus:border-clay focus:outline-none"
                  />
                </form>
              </td>
              <td className="py-2.5 text-ink/70">
                <div>{o.email}</div>
                {o.phone && <div className="text-xs">{o.phone}</div>}
                {o.payment_method !== "stripe" && (
                  <span className="mt-1 inline-block rounded-full bg-clay/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-clay">
                    {o.payment_method}
                  </span>
                )}
              </td>
              <td className="py-2.5 font-semibold">{o.seats}</td>
              <td className="py-2.5 font-mono text-xs">{o.confirmation_code}</td>
              <td className="py-2.5">
                <div className="flex items-center gap-2">
                  <form action={toggleCheckIn.bind(null, o.id, !o.checked_in_at)}>
                    <button
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        o.checked_in_at
                          ? "bg-sage/20 text-sage"
                          : "bg-white/5 text-ink/50"
                      }`}
                    >
                      {o.checked_in_at ? "Here" : "Mark in"}
                    </button>
                  </form>
                  {checkInCounts.get(o.id)?.total ? (
                    <span className="text-xs text-ink/45">
                      {checkInCounts.get(o.id)?.checkedIn}/{checkInCounts.get(o.id)?.total} scanned
                    </span>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {orders.length === 0 && (
        <p className="mt-4 text-sm text-ink/55">No bookings yet.</p>
      )}

      {/* ---------------------------------------------------------- waitlist */}
      {waitlistData && waitlistData.length > 0 && (
        <>
          <h2 className="mt-10 text-lg font-bold">
            Waitlist{" "}
            <span className="font-normal text-ink/50">({waitlistData.length})</span>
          </h2>
          <ul className="mt-3 space-y-1.5 text-sm">
            {waitlistData.map((w: { id: string; name: string; email: string; seats_wanted: number }) => (
              <li key={w.id} className="flex gap-3">
                <span className="font-semibold">{w.name}</span>
                <span className="text-ink/60">{w.email}</span>
                <span className="text-ink/50">wants {w.seats_wanted}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {event.venue_payout_note && (
        <div className="mt-10 rounded-xl bg-white/[0.04] p-4 text-sm">
          <p className="font-semibold">Venue arrangement</p>
          <p className="mt-1 text-ink/75">{event.venue_payout_note}</p>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  alert,
}: {
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 ${alert ? "border-clay/40 bg-clay/5" : "border-white/10 bg-surface"}`}>
      <div className="text-xs uppercase tracking-wider text-ink/50">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${alert ? "text-clay" : ""}`}>{value}</div>
    </div>
  );
}
