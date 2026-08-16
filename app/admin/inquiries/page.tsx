import Link from "next/link";
import { db } from "@/lib/db";
import { isDemoMode, DEMO_INQUIRIES } from "@/lib/demo";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

interface Inquiry {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  preferred_date: string | null;
  headcount: number | null;
  message: string | null;
  handled: boolean;
  created_at: string;
  inquiry_type: "private" | "venue";
  venue_name: string | null;
  workshop_interest: string | null;
}

export default async function InquiriesPage() {
  const { data } = isDemoMode()
    ? { data: DEMO_INQUIRIES }
    : await db()
        .from("private_inquiries")
        .select("*")
        .order("created_at", { ascending: false });

  const inquiries = (data ?? []) as Inquiry[];

  async function markHandled(id: string) {
    "use server";
    await db().from("private_inquiries").update({ handled: true }).eq("id", id);
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <Link href="/admin" className="text-sm text-clay hover:underline">
        ← Dashboard
      </Link>
      <h1 className="mt-3 text-2xl font-bold">Private event inquiries</h1>

      {inquiries.length === 0 && (
        <p className="mt-6 text-ink/60">Nothing yet.</p>
      )}

      <div className="mt-6 space-y-4">
        {inquiries.map((i) => (
          <div
            key={i.id}
            className={`rounded-xl border p-5 ${
              i.handled ? "border-white/10 bg-white/[0.02] opacity-60" : "border-white/15 bg-surface"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-bold">
                  {i.inquiry_type === "venue" && i.venue_name
                    ? i.venue_name
                    : i.name}
                  <span
                    className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      i.inquiry_type === "venue"
                        ? "bg-clay/15 text-clay"
                        : "bg-sage/15 text-sage"
                    }`}
                  >
                    {i.inquiry_type === "venue" ? "VENUE" : "private"}
                  </span>
                </p>
                <p className="text-sm text-ink/70">
                  {i.inquiry_type === "venue" && i.venue_name && <>{i.name} · </>}
                  <a href={`mailto:${i.email}`} className="text-clay hover:underline">
                    {i.email}
                  </a>
                  {i.phone && ` · ${i.phone}`}
                </p>
              </div>
              <p className="text-xs text-ink/50">{formatDate(i.created_at)}</p>
            </div>

            <p className="mt-2 text-sm text-ink/70">
              {i.preferred_date && <>Date: {i.preferred_date} · </>}
              {i.headcount && <>~{i.headcount} people · </>}
              {i.workshop_interest && <>Interested in: {i.workshop_interest}</>}
            </p>

            {i.message && (
              <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed">
                {i.message}
              </p>
            )}

            {!i.handled && (
              <form action={markHandled.bind(null, i.id)} className="mt-4">
                <button className="rounded-lg border border-white/15 px-3 py-1.5 text-sm font-semibold">
                  Mark handled
                </button>
              </form>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
