import Link from "next/link";
import { InquiryForm } from "@/components/InquiryForm";
import { listWorkshops } from "@/lib/workshops";
import { BUSINESS, instagramUrl, PAYMENT_HANDLES } from "@/lib/config";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Host a night",
  description:
    "Fill a slow weeknight. Make In Motion brings art workshops to Connecticut breweries and eateries — we bring everything, you keep the bar.",
};

/**
 * Written for one reader: a bar manager deciding whether this is worth the
 * hassle. Their only real questions are what it costs them, what they have to
 * do, and whether it fills the room. Answer those three first.
 */
export default async function VenuesPage() {
  const workshops = await listWorkshops();

  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      <div className="max-w-2xl">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-clay">
          For venues
        </p>
        <h1 className="mt-2 font-display text-5xl uppercase leading-tight">
          Fill a slow Tuesday.
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-ink/75">
          We run art workshops at breweries and eateries around Connecticut. We bring
          the supplies, the setup, the instruction, and the people. You keep your bar
          and kitchen sales.
        </p>
      </div>

      <div className="mt-9 grid gap-5 sm:grid-cols-3">
        <Point n="1" title="Costs you nothing">
          No room fee, no minimum, no upfront anything. Guests pay us for the workshop.
          Everything they eat and drink is yours.
        </Point>
        <Point n="2" title="We do the work">
          Supplies, setup, teardown, instruction, and cleanup. We protect your surfaces
          and leave the room the way we found it.
        </Point>
        <Point n="3" title="We bring the room">
          We promote every event to our own list and socials, and we build the graphics.
          Most guests are new to the venue.
        </Point>
      </div>

      <section className="mt-14">
        <h2 className="text-2xl font-bold">How it actually works</h2>
        <div className="mt-5 space-y-4 text-[17px] leading-relaxed text-ink/85">
          <p>
            You tell us a night that's slow. We pick a workshop that suits your room and
            put it on our calendar with a headcount cap that matches your seating.
          </p>
          <p>
            Guests book and pay us directly, so you&apos;re never handling tickets or
            refunds. The night before, we send you a confirmed headcount so your
            kitchen and bar can staff accordingly.
          </p>
          <p>
            We show up early, set up, run about two hours, and clean up. Your staff does
            what they'd normally do — serve a room that's fuller than it would have been.
          </p>
        </div>
      </section>

      <section className="mt-12 rounded-2xl border border-white/10 bg-surface/80 p-7">
        <h2 className="text-xl font-bold">The whole arrangement</h2>
        <div className="mt-5 grid gap-6 sm:grid-cols-3">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-sage/80">
              We bring
            </h3>
            <ul className="mt-2 space-y-1 text-[15px]">
              <li>Art supplies &amp; setup</li>
              <li>Instruction &amp; facilitation</li>
              <li>Branding &amp; promo assets</li>
              <li>Ticketing and refunds</li>
              <li>Cleanup</li>
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-sage/80">
              You provide
            </h3>
            <ul className="mt-2 space-y-1 text-[15px]">
              <li>Tables &amp; seating</li>
              <li>Normal food and drink service</li>
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-sage/80">
              Guests bring
            </h3>
            <ul className="mt-2 space-y-1 text-[15px]">
              <li>Themselves</li>
              <li>An appetite</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-bold">What we can run</h2>
        <p className="mt-2 text-ink/70">
          {workshops.length} workshops, and we'll tell you honestly which ones suit your
          space. Some are low-mess and work anywhere; a few need a room that can take a
          drop cloth.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {workshops.map((w) => (
            <Link
              key={w.slug}
              href={`/workshops/${w.slug}`}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                w.bar_friendly
                  ? "bg-sage/12 text-sage hover:bg-sage/20"
                  : "bg-white/[0.05] text-ink/60 hover:bg-white/10"
              }`}
            >
              {w.name}
            </Link>
          ))}
        </div>
        <p className="mt-3 text-xs text-ink/50">
          <span className="inline-block h-2 w-2 rounded-full bg-sage/60 align-middle" />{" "}
          Low mess — fine in almost any room.{" "}
          <span className="inline-block h-2 w-2 rounded-full bg-white/20 align-middle ml-2" />{" "}
          Needs a space that can handle some cleanup.
        </p>
      </section>

      <section className="mt-14">
        <h2 className="text-2xl font-bold">Let's try one</h2>
        <p className="mt-2 max-w-xl text-ink/70">
          Tell us about your space and which nights are slow. No commitment — most
          venues start with a single date to see how it goes.
        </p>
        <div className="mt-6">
          <InquiryForm
            variant="venue"
            workshops={workshops.map((w) => ({ slug: w.slug, name: w.name }))}
          />
        </div>
      </section>

      <p className="mt-8 text-sm text-ink/60">
        Or reach out directly — DM{" "}
        <a
          href={instagramUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="text-clay underline underline-offset-2"
        >
          @{PAYMENT_HANDLES.instagram}
        </a>{" "}
        ·{" "}
        <a
          href={`mailto:${BUSINESS.contactEmail}`}
          className="text-clay underline underline-offset-2"
        >
          {BUSINESS.contactEmail}
        </a>{" "}
        ·{" "}
        <a href={BUSINESS.phoneHref} className="text-clay underline underline-offset-2">
          {BUSINESS.phone}
        </a>
      </p>
    </div>
  );
}

function Point({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-surface/80 p-5">
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-clay text-sm font-bold text-white">
        {n}
      </div>
      <h3 className="mt-3 font-bold">{title}</h3>
      <p className="mt-1.5 text-[15px] leading-relaxed text-ink/70">{children}</p>
    </div>
  );
}
