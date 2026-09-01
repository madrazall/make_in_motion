import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getWorkshopBySlug, formatDuration } from "@/lib/workshops";
import { listUpcomingEvents } from "@/lib/availability";
import { EventImage } from "@/components/EventImage";
import { EventCard } from "@/components/EventCard";
import { formatMoney } from "@/lib/format";
import { AGE_RESTRICTION } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const w = await getWorkshopBySlug(slug);
  if (!w) return { title: "Workshop not found" };
  return { title: w.name, description: w.tagline };
}

export default async function WorkshopPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const workshop = await getWorkshopBySlug(slug);
  if (!workshop) notFound();

  // Any scheduled instances of this workshop currently on sale.
  const allEvents = await listUpcomingEvents();
  const upcoming = allEvents.filter(
    (e) => e.title === workshop.name || e.slug.startsWith(workshop.slug)
  );

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <Link href="/workshops" className="text-sm text-clay hover:underline">
        ← All workshops
      </Link>

      <div className="mt-4 grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-14">
        <div>
          <div className="aspect-[3/2] overflow-hidden rounded-2xl">
            <EventImage src={workshop.image_url} title={workshop.name} priority />
          </div>

          <h1 className="mt-6 font-display text-4xl sm:text-5xl uppercase">
            {workshop.name}
          </h1>
          <p className="mt-2 text-lg text-ink/70">{workshop.tagline}</p>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {workshop.good_for.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-white/[0.05] px-2.5 py-1 text-xs font-medium text-ink/65"
              >
                {tag}
              </span>
            ))}
          </div>

          <div className="mt-7 space-y-4 text-[17px] leading-relaxed text-ink/85">
            {workshop.description.split("\n").filter(Boolean).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>

          <div className="mt-8 rounded-xl bg-surface/80 border border-white/10 p-5">
            <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-sage/80">
              You leave with
            </h2>
            <p className="mt-1.5 text-[15px]">{workshop.what_you_make}</p>
          </div>
        </div>

        <div className="lg:sticky lg:top-8 lg:self-start space-y-4">
          <div className="rounded-2xl border border-white/10 bg-surface/80 p-6">
            <dl className="space-y-3 text-sm">
              <Spec label="Typically">
                from {formatMoney(workshop.base_price_cents)} per person
              </Spec>
              <Spec label="Runs">{formatDuration(workshop.duration_minutes)}</Spec>
              <Spec label="Group size">
                {workshop.min_group}–{workshop.max_group} people
              </Spec>
              <Spec label="Mess level">
                {workshop.bar_friendly ? "Low — bar friendly" : "Higher — needs a space that can take it"}
              </Spec>
              <Spec label="Age">{AGE_RESTRICTION}</Spec>
            </dl>

            <p className="mt-4 text-xs leading-relaxed text-ink/50">
              Final pricing depends on the venue and group size. Public events are
              priced on their own page.
            </p>
          </div>

          <Link
            href="/private-events"
            className="block rounded-lg bg-clay px-5 py-3.5 text-center font-bold uppercase tracking-wide
                       text-white shadow-neon-pink hover:bg-clay/90 transition-colors"
          >
            Request this for a group
          </Link>
          <Link
            href="/venues"
            className="block rounded-lg border-2 border-white/15 px-5 py-3 text-center
                       font-semibold hover:border-clay hover:text-clay transition-colors"
          >
            Host this at your venue
          </Link>
        </div>
      </div>

      {upcoming.length > 0 && (
        <section className="mt-16">
          <h2 className="text-xs font-bold uppercase tracking-[0.22em] text-sage mb-5">
            Coming up
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Spec({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <dt className="w-24 shrink-0 text-ink/50">{label}</dt>
      <dd className="font-semibold">{children}</dd>
    </div>
  );
}
