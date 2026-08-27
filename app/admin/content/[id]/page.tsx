import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { CONTENT_PLATFORMS, CONTENT_STATUSES } from "@/lib/config";
import { updateContentPost, deleteContentPost } from "../actions";
import { DeleteContentPostButton } from "@/components/admin/DeleteContentPostButton";
import type { ContentPost } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit post", robots: { index: false } };

export default async function EditContentPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [{ data: post }, { data: events }] = await Promise.all([
    db().from("content_posts").select("*").eq("id", id).maybeSingle(),
    db().from("events").select("id, title, starts_at").order("starts_at", { ascending: false }).limit(50),
  ]);

  if (!post) notFound();
  const p = post as ContentPost;

  return (
    <div className="mx-auto max-w-xl px-5 py-10">
      <Link href="/admin/content" className="text-sm text-clay hover:underline">
        ← Content calendar
      </Link>
      <h1 className="mt-3 text-2xl font-bold">Edit post</h1>

      <form action={updateContentPost.bind(null, p.id)} className="mt-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Platform</span>
            <select name="platform" defaultValue={p.platform} className="field">
              {CONTENT_PLATFORMS.map((pl) => (
                <option key={pl.value} value={pl.value}>
                  {pl.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Status</span>
            <select name="status" defaultValue={p.status} className="field">
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
          <input type="date" name="scheduled_date" required defaultValue={p.scheduled_date} className="field" />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">
            About an event <span className="font-normal text-ink/50">(optional)</span>
          </span>
          <select name="event_id" defaultValue={p.event_id ?? ""} className="field">
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
          <textarea name="caption" rows={5} defaultValue={p.caption} className="field" />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">
            Image <span className="font-normal text-ink/50">(URL, optional)</span>
          </span>
          <input name="image_url" defaultValue={p.image_url ?? ""} className="field" />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">
            Notes <span className="font-normal text-ink/50">(hashtags, reminders, whatever)</span>
          </span>
          <textarea name="notes" rows={3} defaultValue={p.notes ?? ""} className="field" />
        </label>

        <div className="flex gap-3">
          <button className="rounded-lg bg-sage px-6 py-3 font-bold uppercase tracking-wide text-paper shadow-neon-cyan hover:bg-sage/85 transition-all">
            Save
          </button>
        </div>
      </form>

      <div className="mt-8 border-t border-white/10 pt-6">
        <DeleteContentPostButton
          action={deleteContentPost.bind(null, p.id, p.scheduled_date.slice(0, 7))}
        />
      </div>
    </div>
  );
}
