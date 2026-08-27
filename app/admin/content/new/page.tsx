import Link from "next/link";
import { db } from "@/lib/db";
import { isDemoMode } from "@/lib/demo";
import { CONTENT_PLATFORMS, CONTENT_STATUSES } from "@/lib/config";
import { createContentPost } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "New post", robots: { index: false } };

export default async function NewContentPostPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;

  const { data: events } = isDemoMode()
    ? { data: [] }
    : await db()
        .from("events")
        .select("id, title, starts_at")
        .order("starts_at", { ascending: false })
        .limit(50);

  return (
    <div className="mx-auto max-w-xl px-5 py-10">
      <Link href="/admin/content" className="text-sm text-clay hover:underline">
        ← Content calendar
      </Link>
      <h1 className="mt-3 text-2xl font-bold">New post</h1>

      <form action={createContentPost} className="mt-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Platform</span>
            <select name="platform" defaultValue="instagram" className="field">
              {CONTENT_PLATFORMS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Status</span>
            <select name="status" defaultValue="idea" className="field">
              {CONTENT_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">Date</span>
          <input
            type="date"
            name="scheduled_date"
            required
            defaultValue={date ?? new Date().toISOString().slice(0, 10)}
            className="field"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">
            About an event <span className="font-normal text-ink/50">(optional)</span>
          </span>
          <select name="event_id" defaultValue="" className="field">
            <option value="">None</option>
            {(events ?? []).map((e: { id: string; title: string; starts_at: string }) => (
              <option key={e.id} value={e.id}>
                {e.title} — {new Date(e.starts_at).toLocaleDateString()}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">Caption</span>
          <textarea name="caption" rows={5} className="field" placeholder="Draft the post text here…" />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">
            Image <span className="font-normal text-ink/50">(URL, optional)</span>
          </span>
          <input name="image_url" placeholder="/images/candle-making.jpg" className="field" />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">
            Notes <span className="font-normal text-ink/50">(hashtags, reminders, whatever)</span>
          </span>
          <textarea name="notes" rows={3} className="field" />
        </label>

        <button className="rounded-lg bg-sage px-6 py-3 font-bold uppercase tracking-wide text-paper shadow-neon-cyan hover:bg-sage/85 transition-all">
          Save
        </button>
      </form>
    </div>
  );
}
