import Link from "next/link";
import { db } from "@/lib/db";
import { isDemoMode, DEMO_EVENTS, DEMO_INQUIRIES } from "@/lib/demo";
import { formatDateShort, formatTime, formatMoney, relativeDays } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard", robots: { index: false } };

interface AdminEventRow {
  id: string;
  slug: string;
  title: string;
  starts_at: string;
  capacity: number;
  min_to_run: number;
  price_cents: number;
  status: string;
  venue: { name: string; city: string } | null;
}

export default async function AdminDashboard() {
  const demo = isDemoMode();

  const [{ data: events }, { data: needsDecision }, { data: inquiries }] = demo
    ? [
        { data: DEMO_EVENTS.map((e) => ({ ...e, venue: { name: e.venue.name, city: e.venue.city } })) },
        {
          data: DEMO_EVENTS.filter(
            (e) =>
              e.seatsTaken < e.min_to_run &&
              +new Date(e.starts_at) < Date.now() + 3 * 864e5
          ).map((e) => ({
            id: e.id,
            title: e.title,
            starts_at: e.starts_at,
            paid_seats: e.seatsTaken,
            min_to_run: e.min_to_run,
          })),
        },
        { data: DEMO_INQUIRIES.filter((i) => !i.handled) },
      ]
    : await Promise.all([
        db()
          .from("events")
          .select("id, slug, title, starts_at, capacity, min_to_run, price_cents, status, venue:venues(name, city)")
          .gte("starts_at", new Date(Date.now() - 7 * 864e5).toISOString())
          .order("starts_at", { ascending: true }),
        db().from("events_needing_decision").select("*"),
        db().from("private_inquiries").select("id").eq("handled", false),
      ]);

  const rows = (events ?? []) as unknown as AdminEventRow[];

  // One availability query per event is fine at this scale (a handful of
  // published events at a time) and keeps all counting in the database.
  const availability = demo
    ? DEMO_EVENTS.map((e) => ({
        id: e.id,
        seats_taken: e.seatsTaken,
        spots_left: e.spotsLeft,
      }))
    : await Promise.all(
        rows.map(async (e) => {
          const { data } = await db()
            .from("event_availability")
            .select("seats_taken, spots_left")
            .eq("event_id", e.id)
            .single();
          return { id: e.id, ...(data ?? { seats_taken: 0, spots_left: e.capacity }) };
        })
      );
  const seatsFor = (id: string) => availability.find((a) => a.id === id);

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex gap-3 text-sm">
          <Link href="/admin/checkin" className="text-clay hover:underline">
            Check in
          </Link>
          <Link href="/admin/venues" className="text-clay hover:underline">
            Venues
          </Link>
          <Link href="/admin/inquiries" className="text-clay hover:underline">
            Inquiries{inquiries?.length ? ` (${inquiries.length})` : ""}
          </Link>
          <Link
            href="/admin/events/new"
            className="rounded-lg bg-sage px-4 py-2 font-bold uppercase tracking-wide text-paper shadow-neon-cyan hover:bg-sage/85 transition-all"
          >
            New event
          </Link>
        </div>
      </div>

      {/* T-3 day go/no-go. Flags only — never auto-cancels. */}
      {needsDecision && needsDecision.length > 0 && (
        <div className="mt-6 rounded-xl border-2 border-clay/30 bg-clay/5 p-5">
          <h2 className="font-bold text-clay">Underbooked — decide now</h2>
          <p className="mt-1 text-sm text-ink/70">
            These start within 3 days and are below their minimum. Cancelling now means
            a full refund for everyone; after this point attendees are non-refundable.
          </p>
          <ul className="mt-3 space-y-1.5">
            {needsDecision.map((e: { id: string; title: string; starts_at: string; paid_seats: number; min_to_run: number }) => (
              <li key={e.id} className="text-sm">
                <Link href={`/admin/events/${e.id}`} className="font-semibold text-clay hover:underline">
                  {e.title}
                </Link>{" "}
                — {e.paid_seats} of {e.min_to_run} needed, {relativeDays(e.starts_at)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <table className="mt-8 w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-ink/55">
            <th className="pb-2 font-semibold">Event</th>
            <th className="pb-2 font-semibold">When</th>
            <th className="pb-2 font-semibold">Sold</th>
            <th className="pb-2 font-semibold">Revenue</th>
            <th className="pb-2 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => {
            const a = seatsFor(e.id);
            const sold = a?.seats_taken ?? 0;
            return (
              <tr key={e.id} className="border-b border-white/5">
                <td className="py-3">
                  <Link href={`/admin/events/${e.id}`} className="font-semibold hover:text-clay">
                    {e.title}
                  </Link>
                  <div className="text-xs text-ink/55">
                    {e.venue?.name}, {e.venue?.city}
                  </div>
                </td>
                <td className="py-3 text-ink/75">
                  {formatDateShort(e.starts_at)} {formatTime(e.starts_at)}
                  <div className="text-xs text-ink/50">{relativeDays(e.starts_at)}</div>
                </td>
                <td className="py-3">
                  <span className={sold < e.min_to_run ? "text-clay font-semibold" : ""}>
                    {sold} / {e.capacity}
                  </span>
                  <div className="text-xs text-ink/50">min {e.min_to_run}</div>
                </td>
                <td className="py-3">{formatMoney(sold * e.price_cents)}</td>
                <td className="py-3">
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs">
                    {e.status}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {rows.length === 0 && (
        <p className="mt-8 text-ink/60">
          No events yet.{" "}
          <Link href="/admin/events/new" className="text-clay underline">
            Create the first one
          </Link>
          .
        </p>
      )}
    </div>
  );
}
