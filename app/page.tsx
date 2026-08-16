import Link from "next/link";
import { listUpcomingEvents } from "@/lib/availability";
import { EventCard } from "@/components/EventCard";
import { SubscribeForm } from "@/components/SubscribeForm";
import { ABOUT_TEXT } from "@/lib/config";

// Availability changes constantly — never serve a cached seat count.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const events = await listUpcomingEvents();

  return (
    <div className="mx-auto max-w-5xl px-5">
      {/* ------------------------------------------------------------ hero */}
      <section className="relative py-16 sm:py-24">
        {/*
          The photo sits behind the headline, bled to the screen edges and
          pushed well back. Two scrims do the work: a vertical fade so the
          type always has something dark under it, and a warm pink/cyan wash
          so the photo belongs to the same palette as everything else.
        */}
        <div
          className="pointer-events-none absolute inset-y-0 left-1/2 -z-10 w-screen -translate-x-1/2 overflow-hidden"
          aria-hidden
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/paint-and-sip.jpg"
            alt=""
            className="h-full w-full object-cover object-center opacity-[0.38]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-paper via-paper/80 to-paper/30" />
          <div className="absolute inset-0 bg-gradient-to-t from-paper via-transparent to-paper/70" />
          <div className="absolute inset-0 mix-blend-color bg-gradient-to-br from-sage/25 via-transparent to-clay/30" />
        </div>

        <div className="flex gap-6">
          <span className="tube shrink-0 self-stretch text-sage" aria-hidden />

          <div className="max-w-2xl">
            <h1 className="font-display text-6xl uppercase leading-[0.92] sm:text-8xl">
              <span className="neon-white">Create</span>{" "}
              <span className="font-script text-4xl normal-case text-clay sm:text-5xl">
                with
              </span>
              <br />
              <span className="neon-pink">Make in Motion</span>
            </h1>

            <p className="mt-7 text-lg leading-relaxed text-ink/80 sm:text-xl">
              A pop-up creative experience that turns your space into an interactive
              art night.
            </p>

            <ul className="mt-6 space-y-1.5 text-[15px] uppercase tracking-[0.12em] text-ink/60">
              <li>Guided &amp; freestyle art sessions</li>
              <li>2–3 hour event</li>
              <li>Social, high energy, sharable</li>
            </ul>

            <p className="mt-7 font-script text-3xl text-sage sm:text-4xl">
              15+ activities to choose from
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/workshops"
                className="rounded-lg bg-clay px-6 py-3.5 font-bold uppercase tracking-wide
                           text-white shadow-neon-pink transition-all hover:bg-clay/90"
              >
                See the menu
              </Link>
              <Link
                href="/venues"
                className="rounded-lg border-2 border-sage/60 px-6 py-3 font-bold uppercase
                           tracking-wide text-sage transition-all hover:bg-sage
                           hover:text-paper hover:shadow-neon-cyan"
              >
                Host a night
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- events */}
      <section>
        <h2 className="eyebrow mb-5">Upcoming events</h2>

        {events.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center">
            <p className="font-display text-2xl uppercase">
              Nothing on the calendar right now
            </p>
            <p className="mx-auto mt-3 max-w-md text-ink/65">
              We&apos;re lining up the next round of venues. Leave your email and
              you&apos;ll be first to know — these tend to sell out.
            </p>
            <div className="mx-auto mt-5 max-w-sm">
              <SubscribeForm source="homepage-empty" />
            </div>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </section>

      {/* ----------------------------------------------------------- email */}
      {events.length > 0 && (
        <section className="card mt-16 p-7 sm:p-10">
          <h2 className="font-display text-2xl uppercase sm:text-3xl">
            Can&apos;t make these dates?
          </h2>
          <p className="mt-2 max-w-lg text-ink/70">
            We add new events every few weeks. Leave your email and we&apos;ll tell you
            when the next one goes up.
          </p>
          <div className="mt-5 max-w-md">
            <SubscribeForm />
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------ about */}
      <section className="mt-16 border-t border-white/10 pt-10">
        <h2 className="eyebrow mb-4">About</h2>
        <div className="max-w-2xl space-y-4 text-[15px] leading-relaxed text-ink/75">
          {ABOUT_TEXT.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </section>

      {/* --------------------------------------------------------- the deal */}
      <section className="mt-16 grid gap-8 border-t border-white/10 pt-10 sm:grid-cols-3">
        <div>
          <h3 className="font-display text-xl uppercase text-clay">We bring</h3>
          <p className="mt-2 text-sm leading-relaxed text-ink/70">
            Art supplies &amp; set up. Instruction &amp; facilitation. Branding and
            promo assets.
          </p>
        </div>
        <div>
          <h3 className="font-display text-xl uppercase text-sage">The venue brings</h3>
          <p className="mt-2 text-sm leading-relaxed text-ink/70">
            Tables &amp; seating. Normal service — food and drinks.
          </p>
        </div>
        <div>
          <h3 className="font-display text-xl uppercase text-ink/80">You bring</h3>
          <p className="mt-2 text-sm leading-relaxed text-ink/70">
            Just yourself.{" "}
            <Link href="/private-events" className="text-clay underline underline-offset-2">
              Booking a private group?
            </Link>
          </p>
        </div>
      </section>

      {/* --------------------------------------------------------- venue CTA */}
      <section className="card mt-10 overflow-hidden p-7 sm:p-10">
        <p className="eyebrow">For breweries, bars &amp; event spaces</p>
        <h2 className="mt-3 font-display text-3xl uppercase leading-tight sm:text-4xl">
          Increase sales on <span className="neon-cyan">slower nights</span>
        </h2>
        <p className="mt-3 max-w-xl text-ink/70">
          A new crowd without changing your brand, and built-in social media exposure.
          We bring everything. You keep the bar.
        </p>
        <Link
          href="/venues"
          className="mt-6 inline-block font-script text-3xl text-clay transition-colors hover:text-sage"
        >
          Let&apos;s make it a date
        </Link>
      </section>
    </div>
  );
}
