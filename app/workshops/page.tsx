import Link from "next/link";
import { listWorkshops, collectOccasions } from "@/lib/workshops";
import { WorkshopMenu } from "@/components/WorkshopMenu";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Workshop menu",
  description:
    "Every workshop Make In Motion brings to breweries, eateries, and private events in Connecticut — painting, candles, tie dye, jewelry, and more.",
};

export default async function WorkshopsPage() {
  const workshops = await listWorkshops();
  const occasions = collectOccasions(workshops);

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <div className="max-w-2xl">
        <h1 className="font-display text-5xl uppercase leading-tight">What we bring</h1>
        <p className="mt-4 text-lg leading-relaxed text-ink/70">
          Every workshop below travels. We bring the supplies, the setup, and someone
          to run the room — you pick the one that fits the night.
        </p>
        <p className="mt-3 text-[15px] text-ink/60">
          Not everything is on the public calendar at once.{" "}
          <Link href="/private-events" className="text-clay underline underline-offset-2">
            Request any of them for a private group
          </Link>
          , or{" "}
          <Link href="/venues" className="text-clay underline underline-offset-2">
            host one at your venue
          </Link>
          .
        </p>
      </div>

      <div className="mt-9">
        <WorkshopMenu workshops={workshops} occasions={occasions} />
      </div>

      <section className="mt-16 rounded-2xl border border-white/10 bg-surface/80 p-7 sm:p-10">
        <h2 className="text-xl font-bold">Don't see it?</h2>
        <p className="mt-2 max-w-xl text-ink/70">
          This list grows constantly, and we build custom sessions around a theme when
          a group asks. If you have something in mind, describe it and we'll tell you
          honestly whether we can pull it off.
        </p>
        <Link
          href="/private-events"
          className="mt-5 inline-block rounded-lg bg-clay px-5 py-3 font-bold uppercase tracking-wide text-white shadow-neon-pink
                     hover:bg-clay/90 transition-colors"
        >
          Ask about a custom session
        </Link>
      </section>
    </div>
  );
}
