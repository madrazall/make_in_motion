import Link from "next/link";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { isDemoMode } from "@/lib/demo";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { CONTENT_PLATFORMS, CONTENT_STATUSES } from "@/lib/config";
import type { ContentPost } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Content calendar", robots: { index: false } };

const STATUS_STYLE: Record<string, string> = {
  idea: "bg-white/10 text-ink/60",
  drafted: "bg-sage/15 text-sage",
  scheduled: "bg-clay/15 text-clay",
  posted: "bg-sage text-paper",
};

const PLATFORM_LABEL = Object.fromEntries(CONTENT_PLATFORMS.map((p) => [p.value, p.label]));

function parseMonth(month: string | undefined): { year: number; month: number } {
  const now = new Date();
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number);
    return { year: y, month: m };
  }
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function monthParam(year: number, month: number): string {
  return `${year}-${pad(month)}`;
}

export default async function ContentCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthQuery } = await searchParams;
  const { year, month } = parseMonth(monthQuery);

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const monthStart = `${year}-${pad(month)}-01`;
  const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  const prevMonth = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const monthEndExclusive = `${nextMonth.year}-${pad(nextMonth.month)}-01`;

  const [role, { data }] = await Promise.all([
    verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value),
    isDemoMode()
      ? Promise.resolve({ data: [] as ContentPost[] })
      : db()
          .from("content_posts")
          .select("*")
          .gte("scheduled_date", monthStart)
          .lt("scheduled_date", monthEndExclusive)
          .order("scheduled_date"),
  ]);

  const posts = (data ?? []) as ContentPost[];
  const postsByDate = new Map<string, ContentPost[]>();
  for (const p of posts) {
    const list = postsByDate.get(p.scheduled_date) ?? [];
    list.push(p);
    postsByDate.set(p.scheduled_date, list);
  }

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      {role === "admin" ? (
        <Link href="/admin" className="text-sm text-clay hover:underline">
          ← Dashboard
        </Link>
      ) : (
        <span className="text-sm text-ink/50">Content calendar</span>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{monthLabel}</h1>
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/content?month=${monthParam(prevMonth.year, prevMonth.month)}`}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-sm font-semibold"
          >
            ← Prev
          </Link>
          <Link
            href={`/admin/content?month=${monthParam(nextMonth.year, nextMonth.month)}`}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-sm font-semibold"
          >
            Next →
          </Link>
          <Link
            href={`/admin/content/new?date=${new Date().toISOString().slice(0, 10)}`}
            className="rounded-lg bg-sage px-3 py-1.5 text-sm font-bold uppercase tracking-wide text-paper shadow-neon-cyan hover:bg-sage/85 transition-all"
          >
            + New post
          </Link>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-white/10 bg-white/5 text-xs">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="bg-surface p-2 text-center font-semibold text-ink/55">
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={i} className="min-h-[90px] bg-black/10" />;
          const dateStr = `${year}-${pad(month)}-${pad(day)}`;
          const dayPosts = postsByDate.get(dateStr) ?? [];
          return (
            <div key={i} className="min-h-[90px] bg-surface p-1.5">
              <div className="flex items-center justify-between">
                <span className="text-ink/60">{day}</span>
                <Link
                  href={`/admin/content/new?date=${dateStr}`}
                  className="text-ink/30 hover:text-sage"
                  title="Add a post"
                >
                  +
                </Link>
              </div>
              <div className="mt-1 space-y-1">
                {dayPosts.map((p) => (
                  <Link
                    key={p.id}
                    href={`/admin/content/${p.id}`}
                    className={`block truncate rounded px-1.5 py-0.5 ${STATUS_STYLE[p.status]}`}
                    title={p.caption}
                  >
                    {PLATFORM_LABEL[p.platform] ?? p.platform}
                    {p.caption ? ` · ${p.caption}` : ""}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-xs text-ink/55">
        {CONTENT_STATUSES.map((s) => (
          <span key={s.value} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${STATUS_STYLE[s.value]}`} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
