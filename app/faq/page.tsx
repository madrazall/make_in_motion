import { POLICY_TEXT } from "@/lib/policy";
import {
  BUSINESS,
  AGE_RESTRICTION,
  PAYMENT_MODE,
  PAYMENT_HANDLES,
  instagramUrl,
} from "@/lib/config";

export const metadata = {
  title: "FAQ",
  description:
    "Refunds, transfers, what to wear, age limits, and everything else about Make In Motion art nights.",
};

/**
 * Doubles as the terms page. Stripe expects a visible refund policy, contact
 * details, and a description of what's being sold — all of which live here.
 */
export default function FaqPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <h1 className="font-display text-5xl uppercase">Questions</h1>

      <div className="mt-10 space-y-9">
        <Q q="What is a Make In Motion art night?">
          A pop-up art tutorial hosted at a brewery or eatery. We bring all the supplies
          and walk the room through a project together. You get a drink, make something,
          and leave with it. Usually about two hours.
        </Q>

        <Q q="Do I need any experience?">
          None at all. Most people who come have never painted since school. The whole
          format is built around not knowing what you're doing — that's the fun part.
        </Q>

        {PAYMENT_MODE === "manual" ? (
          <Q q="How do I sign up?">
            Two steps. Send payment by Venmo (
            <strong>@{PAYMENT_HANDLES.venmo}</strong>) or CashApp (
            <strong>${PAYMENT_HANDLES.cashapp}</strong>), and{" "}
            <strong>put your name and how many spots in the payment note</strong> —
            that&apos;s how we match the money to you. Then email{" "}
            <a
              href={`mailto:${BUSINESS.email}`}
              className="text-clay underline underline-offset-2"
            >
              {BUSINESS.email}
            </a>{" "}
            with the same details and your payment handle. We reply to confirm
            you&apos;re on the list, usually the same day. Your spot isn&apos;t held
            until you hear back from us, so grab a popular night early.
          </Q>
        ) : (
          <Q q="How do I sign up?">
            Pick your event, choose how many spots, and pay by card. Your confirmation
            email arrives immediately and that&apos;s your ticket.
          </Q>
        )}

        <Q q="What should I wear?">
          Something you don't mind getting paint on. We use washable acrylics and we
          bring aprons, but accidents are part of the deal.
        </Q>

        <Q q="Is there an age limit?">
          Yes — <strong>{AGE_RESTRICTION} only</strong>. Our events are hosted at
          breweries and eateries that require all guests to be 21 or older. Please bring
          valid ID. This applies to everyone in your party, so if you're buying spots for
          friends, let them know.
        </Q>

        <Q q="What's included in the ticket?">
          All art supplies, setup, and instruction. Food and drink are separate — order
          from the venue like any other night out.
        </Q>

        <Q q="Can I sit with my friends?">
          Yes. Buy your spots in one order and we'll seat you together. You can book up
          to 8 spots at a time.
        </Q>

        {/* ------------------------------------------------------- refunds */}
        <section id="refunds" className="scroll-mt-8">
          <h2 className="text-2xl font-bold">{POLICY_TEXT.headline}</h2>
          <p className="mt-1 text-xs text-ink/50">Version {POLICY_TEXT.version}</p>

          <div className="mt-5 space-y-6">
            {POLICY_TEXT.sections.map((section) => (
              <div key={section.heading}>
                <h3 className="font-bold">{section.heading}</h3>
                <div className="mt-1.5 space-y-2">
                  {section.body.map((line, i) => (
                    <p key={i} className="text-[15px] leading-relaxed text-ink/80">
                      {line}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <Q q="What if you cancel the event?">
          Our events run with a minimum headcount. If we don't reach it, we'll tell you
          at least 3 days ahead and refund you in full — or move you to a future session,
          whichever you prefer. Same if the instructor is sick or the venue falls through.
        </Q>

        <Q q="What if I'm running late?">
          We start on time so everyone finishes together. If you're more than 15 minutes
          late we may not be able to catch you up, and we can't offer a partial refund.
          Come a few minutes early if you can — it's more fun with a drink in hand before
          we start.
        </Q>

        <Q q="Do you photograph the events?">
          Sometimes, to share on social media and promote future nights. If you'd rather
          not appear in photos, just tell your host when you arrive. No explanation
          needed.
        </Q>

        <Q q="Do you do private events?">
          Yes — birthdays, team nights, bachelorette parties, that kind of thing.{" "}
          <a href="/private-events" className="text-clay underline underline-offset-2">
            Send us the details
          </a>{" "}
          and we'll put something together. Our public events stay public.
        </Q>

        <Q q="Are you looking for venues?">
          Always. We bring the supplies, the instruction, and the promo — all we need
          from a venue is tables, seating, and your normal service. Get in touch.
        </Q>

        <Q q="How do I reach you?">
          DM us on Instagram at{" "}
          <a
            href={instagramUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="text-clay underline underline-offset-2"
          >
            @{PAYMENT_HANDLES.instagram}
          </a>
          , email{" "}
          <a
            href={`mailto:${BUSINESS.email}`}
            className="text-clay underline underline-offset-2"
          >
            {BUSINESS.email}
          </a>
          , or call/text{" "}
          <a href={BUSINESS.phoneHref} className="text-clay underline underline-offset-2">
            {BUSINESS.phone}
          </a>
          . We're a small operation, so you'll be talking to a person. Instagram is
          usually fastest.
        </Q>
      </div>
    </div>
  );
}

function Q({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-bold">{q}</h2>
      <p className="mt-1.5 text-[15px] leading-relaxed text-ink/80">{children}</p>
    </section>
  );
}
