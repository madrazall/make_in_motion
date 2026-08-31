import Link from "next/link";
import { InquiryForm } from "@/components/InquiryForm";
import { listWorkshops } from "@/lib/workshops";
import { BUSINESS } from "@/lib/config";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Private events",
  description:
    "Book a private Make In Motion art night for a birthday, team event, or celebration.",
};

export default async function PrivateEventsPage() {
  const workshops = await listWorkshops();

  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <h1 className="font-display text-5xl uppercase">Private events</h1>
      <p className="mt-4 text-lg leading-relaxed text-ink/75">
        Birthdays, team nights, bachelorette parties, family reunions. We'll bring the
        whole setup to your venue of choice — or help you pick one.
      </p>

      <div className="mt-8 grid gap-6 sm:grid-cols-3 rounded-2xl bg-surface/80 border border-white/10 p-6">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-sage/80">
            We bring
          </h2>
          <p className="mt-2 text-sm leading-relaxed">
            Art supplies &amp; setup. Instruction &amp; facilitation. Branding and promo
            assets.
          </p>
        </div>
        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-sage/80">
            Venue provides
          </h2>
          <p className="mt-2 text-sm leading-relaxed">
            Tables &amp; seating. Normal food and drink service.
          </p>
        </div>
        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-sage/80">
            You bring
          </h2>
          <p className="mt-2 text-sm leading-relaxed">Your people. That's it.</p>
        </div>
      </div>

      <div className="mt-10">
        <h2 className="text-xl font-bold">Tell us what you're thinking</h2>
        <p className="mt-1.5 text-ink/70">
          Rough details are fine — we'll follow up with options and pricing. No payment
          here.{" "}
          <Link href="/workshops" className="text-clay underline underline-offset-2">
            Browse the workshop menu
          </Link>{" "}
          if you're not sure what you want yet.
        </p>
        <div className="mt-6">
          <InquiryForm
            workshops={workshops.map((w) => ({ slug: w.slug, name: w.name }))}
          />
        </div>
      </div>

      <p className="mt-8 text-sm text-ink/60">
        Prefer to just talk?{" "}
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
