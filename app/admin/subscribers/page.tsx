import Link from "next/link";
import { db } from "@/lib/db";
import { isDemoMode } from "@/lib/demo";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

interface SubscriberRow {
  email: string;
  source: string | null;
  created_at: string;
}

export default async function SubscribersAdminPage() {
  const { data } = isDemoMode()
    ? { data: [] as SubscriberRow[] }
    : await db()
        .from("subscribers")
        .select("email, source, created_at")
        .order("created_at", { ascending: false });

  const subscribers = (data ?? []) as SubscriberRow[];

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <Link href="/admin" className="text-sm text-clay hover:underline">
        ← Dashboard
      </Link>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">
          Subscribers{" "}
          <span className="font-normal text-ink/50">({subscribers.length})</span>
        </h1>
        <a
          href="/api/admin/subscribers"
          className="rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold"
        >
          Download CSV
        </a>
      </div>
      <p className="mt-1.5 text-sm text-ink/60">
        Everyone who left an email on the homepage or an event page asking to hear
        about new dates. Nothing gets sent to them automatically — use the
        &quot;Notify subscribers&quot; button on a published event to reach this list.
      </p>

      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-ink/55">
            <th className="pb-2 font-semibold">Email</th>
            <th className="pb-2 font-semibold">Source</th>
            <th className="pb-2 font-semibold">Signed up</th>
          </tr>
        </thead>
        <tbody>
          {subscribers.map((s) => (
            <tr key={s.email} className="border-b border-white/5">
              <td className="py-2.5">{s.email}</td>
              <td className="py-2.5 text-ink/60">{s.source ?? "—"}</td>
              <td className="py-2.5 text-ink/60">{formatDate(s.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {subscribers.length === 0 && (
        <p className="mt-4 text-sm text-ink/55">No subscribers yet.</p>
      )}
    </div>
  );
}
