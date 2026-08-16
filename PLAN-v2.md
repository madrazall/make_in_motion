# Make in Motion — Event Booking System (v2)

**Business:** pop-up art tutorials hosted at eateries and breweries.
**Core job:** customer picks an event → picks number of spots → pays → gets a confirmation. Selling stops automatically at capacity.

**Status:** plan only. Nothing built.

> **Editing note:** OpenOffice rewrote the last version in its own binary format while keeping the `.md` name. Your notes survived, but to mark this one up, open it in **Notepad** or **VS Code** — or in OpenOffice use **File → Save As → Text (.txt)** under a new name. Or just type your notes to me in chat, which is easiest.

---

## 0. Settled decisions

| Decision | Answer |
|---|---|
| Build vs. buy | **Custom build** — see §8, revised with your numbers |
| Stack | Next.js + Supabase (Postgres) + Stripe + Resend |
| Hosting | **Cloudflare Workers** — yes, and it's the better call here. See §14. |
| Domain | Buying today. Consider Cloudflare Registrar — §14. |
| Payments | Stripe Checkout (hosted). Full payment, no deposits. |
| Policy visibility | **FAQ page** + **required checkbox at checkout** + full text in the confirmation email — §17 |
| Stripe account | Already live and active |
| Max seats per order | 8 |
| Minimum to run | **6.** Under 6 at T-3 days → cancel and refund in full — §18 |
| Age policy | **Blanket 21+**, every event |
| Photo consent | Yes — one line in the confirmation email |
| Timezone | **US Eastern** (`America/New_York`) |
| Event images | Placeholders for now, real photos swapped in later — §15 |
| Price & capacity | **Set per event** — varies by activity and venue |
| Admin logins | One. You. Venues get an emailed headcount, no login. |
| Extra checkout fields | None. Name, email, phone, quantity. |
| Private / group bookings | **Inquiry form only** — not a checkout flow |
| Waitlist | In v1 |
| Refunds | Manual from Stripe, following the policy in §11 |
| Per-seat attendee names | Not in v1 |

Two things you bounced back to me — **§11 (no-shows)** and **§12 (lead time)**. Those are recommendations, not decisions. Overrule freely.

---

## 1. What the customer sees

```
Home  →  Event page  →  Stripe Checkout  →  Confirmation page
                                          ↘  Confirmation email + calendar invite
```

**Home / `/`**
Grid of upcoming events. Each card: image, title, venue, date/time, price, and a live badge — `12 spots left` / `Only 3 left` / `Sold out`.

**Event page / `/events/[slug]`**
Image, description, what's included (canvas, paint, aprons?), venue name + map link, date/time, price per person, what to bring, cancellation policy.
Then the picker:

- Quantity selector, capped at `min(spots remaining, 8)`
- Running total updates live
- Name, email, phone
- **Required checkbox:** "I understand the refund and cancellation policy" with a link to the FAQ. Button stays disabled until it's ticked.
- Button: **Reserve & Pay — $XX**
- If sold out: replaced by **Join the waitlist**

**FAQ / `/faq`** — refunds and cancellations, what's included, what to bring, age policy, what if I'm late, can I transfer my spot, private events. Doubles as your terms page for Stripe's purposes.

**Stripe Checkout** — Stripe's hosted page. Card, Apple Pay, Google Pay, Link.

**Confirmation / `/booked/[code]`** — order code, event details, venue address, add-to-calendar button. Same info in the email.

**Private events / `/private-events`**
Short inquiry form: name, email, date, headcount, what they want. Emails you. No payment, no calendar. Public events stay public.

---

## 2. What you see (admin)

Password-protected at `/admin`. One login.

- **Events list** — every event with `sold / capacity`, revenue, status
- **New event form** — title, description, image, venue, date, start/end, **capacity**, **price**, publish toggle
- **Clone event** — duplicate a past event with a new date. You'll run the same tutorial at different venues; this replaces a recurring-events engine for a fraction of the work. (See §12.)
- **Event detail** — roster (name, email, phone, seats, paid date, order code), waitlist, revenue
- **Venue payout note** — optional field per event for what you owe the venue or what they comp you, so you can see real margin per night
- **Export CSV** — roster, for the venue headcount
- **Check-in** — tap a name to mark arrived, on your phone, day-of
- **Cancel event** — hides it publicly, gives you a one-click refund list
- **Private inquiries** — inbox of form submissions

---

## 3. The part that actually matters: never oversell

Two people can hit "buy the last 2 spots" in the same second. Naive systems sell 4.

### The rule
A seat is unavailable if it's **paid for** OR **currently held** by someone mid-checkout.

```
spots_taken = paid_seats + held_seats (holds that haven't expired)
spots_left  = capacity - spots_taken
```

### The flow

1. Customer clicks **Reserve & Pay**.
2. Server opens a database transaction and **locks that event's row**.
3. Re-counts `spots_left` inside the lock. Doesn't fit → reject: "Only 2 spots left — someone just grabbed them."
4. Fits → write an order row, `status = 'pending'`, `hold_expires_at = now + 30 minutes`.
5. Commit, release the lock.
6. Create a Stripe Checkout session with a matching 30-minute expiry, redirect.
7. **Stripe's webhook — not the browser redirect — is the source of truth.**
   - `checkout.session.completed` → `paid`, confirmation email fires
   - `checkout.session.expired` → `expired`, seats free up instantly
8. Cron every 5 minutes sweeps stale pending orders, in case a webhook never arrived.

Because the count happens *inside a row lock*, simultaneous requests take turns. The second one sees the first one's hold. That's the whole trick.

### Belt and suspenders
A database trigger that raises an error if paid + held seats would ever exceed capacity. It should never fire. If it does, the transaction rolls back — the customer sees an error instead of you calling a brewery to explain.

### Prove it before launch
A test that fires 20 simultaneous checkout requests at a 10-seat event and asserts **exactly 10** succeed. Non-negotiable.

### Why 30 minutes
Stripe Checkout's minimum session expiry is 30 minutes. Matching it means the two systems never disagree about whether a seat is still being bought.

---

## 4. Data model

**venues** — `id, name, address, city, state, zip, map_url, contact_name, contact_phone, notes`

**events** — `id, slug, title, description, image_url, venue_id, starts_at, ends_at, capacity, min_to_run, price_cents, venue_payout_note, status, whats_included, what_to_bring, created_at`
`status`: `draft` → `published` → `completed` / `cancelled`
`min_to_run` defaults to 6, editable per event. No `min_age` field — 21+ is blanket, handled in copy.
All times stored UTC, displayed `America/New_York`.
Capacity and price live here, per event — that's how "varies by activity and venue" gets handled.
Sold-out is *calculated*, never stored. A stored flag drifts and lies to you.

**orders** — `id, confirmation_code, event_id, customer_name, email, phone, seats, amount_cents, status, stripe_session_id (unique), stripe_payment_intent_id, hold_expires_at, paid_at, policy_accepted_at, policy_version, created_at`
`status`: `pending` → `paid` → `refunded` / `expired` / `cancelled`
`policy_accepted_at` + `policy_version` are what make the checkout checkbox worth anything — see §17.

**waitlist** — `id, event_id, name, email, seats_wanted, created_at, notified_at`

**check_ins** — `id, order_id, checked_in_at`

**private_inquiries** — `id, name, email, phone, preferred_date, headcount, message, created_at, handled`

Indexes on `orders(event_id, status)` and `events(starts_at) where status='published'`.

---

## 5. File / folder organization

```
make_in_motion/
├── app/
│   ├── page.tsx                      # upcoming events
│   ├── events/[slug]/page.tsx        # event detail + booking form
│   ├── booked/[code]/page.tsx        # confirmation
│   ├── private-events/page.tsx       # inquiry form
│   ├── admin/
│   │   ├── page.tsx                  # dashboard
│   │   ├── events/page.tsx           # list
│   │   ├── events/new/page.tsx       # create
│   │   ├── events/[id]/page.tsx      # edit + roster + check-in
│   │   └── inquiries/page.tsx        # private event requests
│   └── api/
│       ├── checkout/route.ts         # hold seats, create Stripe session
│       ├── webhooks/stripe/route.ts  # the source of truth
│       ├── waitlist/route.ts
│       ├── inquiry/route.ts
│       └── cron/expire-holds/route.ts
├── lib/
│   ├── db.ts                         # Supabase client
│   ├── availability.ts               # ALL capacity logic lives here
│   ├── stripe.ts
│   ├── email.ts                      # Resend
│   └── ics.ts                        # calendar invite generator
├── emails/
│   ├── confirmation.tsx
│   ├── reminder.tsx                  # T-3 days
│   ├── waitlist-open.tsx
│   └── venue-headcount.tsx           # T-1 day, to the venue
├── components/
│   ├── EventCard.tsx
│   ├── SeatPicker.tsx
│   └── SoldOutBadge.tsx
└── supabase/migrations/              # schema + reserve_seats fn + trigger
```

**One rule:** every capacity question goes through `lib/availability.ts`. Never count seats inline in a page. The moment that logic exists in two places, they disagree and you oversell.

---

## 6. Build order

| Phase | What gets built | Effort |
|---|---|---|
| **0** | Accounts: Stripe, Supabase, Resend, Cloudflare + domain. Next.js scaffold with the OpenNext adapter, deployed empty. | half day |
| **1** | Schema + admin login + create/edit/clone events. Seed two fake events. | 1 day |
| **2** | Public event list + event detail page. No buying yet. | 1 day |
| **3** | **Checkout: holds, Stripe session, webhook, capacity lock** + the 20-request test. | 1–2 days |
| **4** | Confirmation email, calendar invite, confirmation page. | half day |
| **5** | Waitlist, roster CSV, check-in, private inquiry form, venue headcount email. | 1–1.5 days |
| **6** | Launch: live keys, real webhook endpoint, one real $1 purchase, one real refund, timezone check. | half day |

Phase 3 takes longer than you expect. Everything else is ordinary.

---

## 7. Running cost

| Thing | Cost |
|---|---|
| Cloudflare Workers hosting | $0 (free tier), $5/mo if you outgrow it |
| Cloudflare R2 (images) | $0 up to 10GB, no egress fees |
| Supabase database | $0 up to 500MB, $25/mo after |
| Resend email | $0 up to 3,000/mo |
| Domain (.com at Cloudflare Registrar) | ~$9.77/year, renews at the same price |
| **Stripe** | **2.9% + $0.30 per transaction** |

**Realistically ~$10/year plus Stripe fees** until you're doing real volume. Two friends booking together on one order = one $0.30 fee, not two.

---

## 8. Build vs. buy — revised

Since price and capacity vary per event, here's the fee math instead of one example.

**Per-ticket cost to you:**

| | Custom build | Ticket Tailor | Eventbrite |
|---|---|---|---|
| Platform fee | none | $0.65 flat | 3.7% + $1.79 |
| Payment processing | 2.9% + $0.30 | 2.9% + $0.30 (your Stripe) | 2.9% |
| **On a $35 ticket** | **$1.32** | **$1.97** | **$4.10** |
| **On a $45 ticket** | **$1.61** | **$2.26** | **$4.76** |
| **On a $65 ticket** | **$2.19** | **$2.84** | **$6.08** |

**Per year**, at 4 events a month averaging 18 seats (864 tickets/yr, $45 average):

- Custom build: **~$1,391** in Stripe fees
- Ticket Tailor: **~$1,953** — $562/yr more than building
- Eventbrite: **~$4,113** — $2,722/yr more than building

**Where I land:** Eventbrite is expensive enough to justify building — the build pays for itself in a few months. But **Ticket Tailor only costs ~$560/year more**, and it already has capacity cutoffs, waitlists, and refunds working today.

So the honest read: **you're not building this to save money on Ticket Tailor. You're building it to own your customer list, control the look, and have event pages on your own domain.** Those are good reasons. Just be clear that's the trade — ~$560/yr and a week of work, in exchange for control.

**Lowest-risk path:** run your next 2–3 events on Ticket Tailor while this gets built. You learn what you actually need from real customers, and you're never blocked on software to sell a ticket. Your Stripe account and email list come with you either way.

---

## 9. Things that will bite you

- **Timezones.** Store UTC, display venue-local. 7pm to you and 4pm to a customer is a ruined night.
- **Never trust the price from the browser.** Recompute server-side from the event record.
- **Verify the Stripe webhook signature** against the raw request body.
- **Webhooks arrive twice.** Make the handler idempotent — key off `stripe_session_id`.
- **Don't confirm on the redirect.** Someone who closes the tab after paying still gets their email.
- **A refunded seat goes back on sale** — and should ping the waitlist.
- **Venue cancels on you.** Bulk refund + apology email needs to be a button, not a scramble.
- **Mobile first.** People buy these on a phone, at a bar, half a drink in.
- **Sales tax on tickets/classes** varies by state and by whether materials are included. Ask an accountant before your first event. I'm not one.
- **Publish the cancellation policy** on the event page, the checkout page, and the email.

---

## 10. Your answers, folded in

| Question | Your answer | What changed |
|---|---|---|
| Ticket price & capacity | Varies, set at event creation | Already per-event in §4. No change. |
| Extra checkout fields | No | Checkout stays 4 fields |
| Venue logins | No — you host, they provide space | Added automated headcount email to the venue at T-1 day instead |
| Deposits | Full payment | Single charge, no second flow |
| Private/group | Contact for private, keep public public | Added `/private-events` inquiry form, §1 and §5 |
| Lead time | *asked me* | §12 |
| No-shows | *asked me* | §11 |

---

## 11. Refund & cancellation policy — YOURS, v1.0

This is your text, verbatim. It supersedes my earlier draft. Stored as `policy_version = "1.0"`.

### Standard cancellations

| When | Refund |
|---|---|
| 7+ days before | Full refund to original payment method, no questions asked |
| 3–6 days before | 50% refund — materials already ordered and prepped |
| Less than 72 hours | No refund — spot and supplies committed, can't fill the seat |

**Transfers** — transferable to a friend any time before the event starts. Email or text the new name, no fee.

**No-shows** — forfeited. No refund, no credit.

**Our cancellations** (low enrollment, instructor illness, venue issues) — full refund *or* free transfer to a future session, customer's choice.

**Venue cancels** (weather, emergency) — notified ASAP, full refund or reschedule credit.

**Late arrivals** — we start on time so everyone finishes together. More than 15 minutes late and we may not be able to catch you up. No partial refund.

**Damaged or unsatisfactory projects** — art is handmade and imperfect by nature. No refunds for projects you don't love, but we'll help you fix or adjust anything during the session.

**Questions** — makeinmotionct@gmail.com or 860-348-7466.

### Implementation notes

**Compute the tier in hours, not days.** `≥168h` full, `72–168h` 50%, `<72h` none. Days introduce off-by-one bugs around midnight and daylight saving; hours don't. Your written boundaries already line up cleanly this way — 72 hours exactly falls in the 50% bucket.

**Your T-3 day go/no-go is the same moment customers lose refund rights.** That's a good property, not a coincidence worth breaking: you decide whether the event runs *right as* attendees become non-refundable. Keep those two numbers locked together if you ever change either one.

**Transfers need one admin feature:** an editable name on the roster row. You'll get these by text and update them by hand — no self-serve transfer flow needed in v1.

**Credits only exist for cancellations you cause.** So there's no wallet to build. When you cancel, you issue a Stripe promotion code by hand worth what they paid, single-use, 6-month expiry. Stripe Checkout already has a promo code field. Zero code.

**Stripe keeps its fee on refunds, including partial ones.** A 50% refund on a $45 ticket returns $22.50 to them and costs you the original $1.61 in fees. Not a reason to change the policy — just know it so the numbers don't surprise you.

**A no-show seat stays counted as sold.** It was paid for. Don't release it back to inventory.

---

## 12. How far ahead to list events — my recommendation

**Publish 4–6 weeks out. Don't go past 8.**

**Why 4–6 weeks:**

- Venues book their own calendars 4–8 weeks ahead, so you'll know the date by then anyway
- Long enough for word of mouth and a social cycle to work
- Short enough that the page doesn't look abandoned

**Why not further:** a half-empty event three months out reads as *nobody's going to this.* Scarcity works for you; a distant sparse listing kills it.

**What to expect:** most seats sell in the last 10–14 days. Don't panic at week four with 3 sold — that's normal.

| Timing | Action |
|---|---|
| T-4 to 6 weeks | Publish the event |
| T-10 days | Social post / email blast — sells the most seats |
| T-3 days | Reminder to people already booked (cuts no-shows) |
| T-1 day | Headcount email to the venue |

### The build consequence
At 4–6 weeks of lead time you'll have maybe 4–8 published events at once. **You do not need recurring-event or series support.** A **"Clone this event"** button — copy everything, pick a new date and venue — covers it in about an hour of work versus several days for a real recurrence engine. Already in §2.

If you ever move to a fixed weekly slot ("every Thursday at Brewery X"), revisit then.

---

## 13. Round-two answers

| Question | Your answer | Effect |
|---|---|---|
| Where does the policy show | **Both** — event page and confirmation email | Policy text becomes a field on the event, rendered in both places from one source |
| Max seats per order | **8** | Confirmed. Picker caps at `min(spots_left, 8)`. |
| Domain | Buying today | See §14 before you buy — one detail matters |
| Images | None yet, placeholders fine | See §15 |

---

## 14. Hosting: Cloudflare instead of Vercel

**Short answer: yes, and it's arguably the better choice here.** One specific reason makes it more than a preference.

### The reason that actually matters: cron

The plan needs a job every ~5 minutes to sweep expired seat holds (§3, step 8).

- **Vercel's free Hobby plan only allows cron jobs that run once per day**, and it may fire them anywhere within the scheduled hour. A daily sweep is useless for releasing 30-minute holds. On Vercel you'd need the $20/mo Pro plan or an external cron service.
- **Cloudflare Workers Cron Triggers run at a 1-minute minimum on the free plan** (3 triggers per Worker).

So Cloudflare does for free what Vercel charges $240/yr for. That's the whole argument.

### Why the rest of the plan ports cleanly

The one thing that could have broken is the row lock in §3 — you can't run a multi-statement transaction over Supabase's HTTP client, which is all a Worker can use.

**But the design already handles this.** All the locking lives inside a Postgres function (`reserve_seats`) called via a single RPC. The transaction and the `SELECT … FOR UPDATE` happen inside the database, not in the app. One HTTP call in, one answer out. Workers-safe by construction.

Everything else is fine: Stripe's SDK and webhook signature verification work on Workers, Resend is an HTTP API, and Supabase's JS client is fetch-based.

### What you give up

- **An extra build layer.** Next.js on Cloudflare goes through the OpenNext adapter (`@opennextjs/cloudflare`). It hit 1.0 GA in February 2026 and supports Next.js 14, 15, and 16 unmodified — mature, but it's one more moving part than Vercel's zero-config deploy.
- **Failed cron runs are not retried.** If the sweep errors, that run is simply gone. Not a real risk for us: the sweep is idempotent and it's already the *backup* — Stripe's `checkout.session.expired` webhook is the primary path.
- Slightly more setup: a `wrangler.jsonc` and an `open-next.config.ts` in the repo.

### On buying the domain today

Cloudflare Registrar sells at cost — a `.com` runs about **$9.77/yr, and renews at the same price**, with WHOIS privacy included. No first-year-cheap, year-two-triple pricing.

**The one catch:** Cloudflare Registrar requires you to use Cloudflare's nameservers. You can't point DNS at Route53 or another provider. Since you're hosting on Cloudflare anyway, that's a non-issue — but know it before you buy, because transferring later is a chore.

**Also:** buy the bare domain and put booking on the root (`makeinmotion.com/events`), not a subdomain. Same site, better SEO, one less thing to explain to a customer at a brewery.

### Verdict
Cloudflare. Free cron at the interval we need, cheaper domain, no egress fees on images. The OpenNext layer is the only real cost and it's a mature one.

---

## 15. Images

Placeholders are fine to build against. Plan:

- **Phase 2:** ship with a neutral placeholder — a solid brand-color card with the event title typeset over it, generated automatically. Better than a stock-photo look, and an event with no photo won't look broken.
- **Storage:** Cloudflare R2. Free to 10GB, and no egress charges, which matters because event photos are the heaviest thing on the page.
- **Upload:** drag-and-drop in the admin event form, auto-resized to a consistent aspect ratio so the card grid stays even.
- **What to shoot:** at your next event, get 3–4 wide shots of *people painting and laughing*, not close-ups of finished canvases. You're selling the night out, not the artwork. That's the single highest-leverage marketing thing on this whole list.

Until then, free sources that don't look like stock: Unsplash and Pexels, searching "paint night," "art class," "craft workshop."

---

## 16. Before a single line of code

### A. Hard blockers — RESOLVED

**1. Stripe account.** ✅ Already live and active. Nothing to do.

**2. Required site pages.** ✅ Decided — see §17. FAQ page + checkout checkbox + policy in the confirmation email.

**3. Email domain verification.** ⏳ Waiting on the domain purchase today. SPF/DKIM/DMARC records go in as soon as the domain exists. Still Phase 0.

**4. Liability insurance.** ⏸ Deferred until revenue comes in — your call. One free thing to do in the meantime: **ask your next venue what they require.** Some won't ask at all; the ones that do will tell you the exact coverage amount, and you'd rather learn that now than a week before a date you've already sold tickets for.

### B. Decisions — RESOLVED

**5. Timezone.** ✅ US Eastern (`America/New_York`). Stored UTC, displayed Eastern.

**6. Minimum to run.** ✅ 6, decided at T-3 days. See §18.

**7. Age policy.** ✅ Blanket 21+. No per-event field. Appears in the FAQ, on every event page, and in the confirmation email.

**8. Photo consent.** ✅ Yes. Wording in §18.

### C. Cheap additions I'd put in v1

**9. Email capture for people who don't buy.**
A "tell me about future events" box on the homepage. Most first-time visitors won't buy that day — they're browsing at work. **Your email list is worth more than this software.** This is maybe two hours of work and the highest-ROI thing on the whole list.

**10. Printable roster.**
Brewery wifi is unreliable and your phone will be in a bag covered in paint. You need to download or print the attendee list before you leave the house. Check-in should work on paper as a fallback.

**11. "Event changed" notification.**
Time moves, venue swaps, you get sick. You need a button that emails everyone who bought. Without it you're copy-pasting from a spreadsheet at 11pm.

**12. Code lives in GitHub, not just your laptop.**
So it's backed up, and so anyone else can pick it up later. Also gives Cloudflare automatic deploys on push.

**13. Export your attendee list monthly.**
Supabase's free tier has limited backup guarantees. Losing your customer list would hurt far more than losing the code.

### D. What you owe me — the copy

This is the real bottleneck on projects like this. Software waits on words.

- One **sample event description** written the way you'd actually write it, so the whole site matches your voice
- **What's included** and **what to bring** boilerplate
- Your **cancellation/refund policy** in your own words (§11 is my draft — rewrite it however you like)
- A short **about** paragraph
- Business name, contact email, phone (if you want one public)

Send me those and the site fills itself in.

---

## 17. Refund policy — how it gets surfaced

Your call, and it's the right one. Three places:

**1. FAQ page (`/faq`)** — refunds as one answer among several. Also covers what's included, what to bring, age policy, transfers, lateness, private events. This page does double duty as the terms page Stripe wants to see.

**2. Required checkbox at checkout** — on your event page, before the redirect to Stripe. Unticked, the pay button stays disabled.

> ☐ I understand the [refund and cancellation policy](/faq#refunds).

Building it on your own page rather than inside Stripe Checkout keeps the wording under your control and lets you record the acceptance.

**3. Full policy text in the confirmation email** — so nobody can say they never saw it.

### The part that makes the checkbox actually count

A ticked box that isn't recorded is worthless. Every order stores:

- `policy_accepted_at` — the timestamp
- `policy_version` — which wording they agreed to

Version it, because you *will* change the policy, and six months from now you need to know which version a given customer accepted. Keep old versions as static text; never edit one in place.

**Why this matters beyond arguments:** if someone disputes a charge, Stripe asks you for evidence. "Customer accepted this exact policy at 8:42pm on March 3rd, here's the confirmation email we sent them" is strong evidence. Without the timestamp it's your word against theirs, and the default outcome of a dispute favors the cardholder.

That's roughly twenty minutes of extra work and it's the cheapest insurance in this whole plan.

---

## 18. Round-three decisions, spelled out

### Minimum to run: 6, decided 3 days out

`min_to_run` defaults to 6 and is editable per event, so a high-cost night can require more.

**What the system does:** at T-3 days, a scheduled job checks every upcoming event. Any published event under its minimum gets flagged in your admin with a **"Cancel & refund all"** button. It does *not* auto-cancel — you might know something the software doesn't, like eight people who swore they'd book tonight.

**Full refund on an underbooked cancellation**, no credits. This one's on you, not the customer.

**What the customer is told**, on the event page and in the FAQ:

> These events run with a minimum of 6 people. If we don't reach it, we'll let you know 3 days ahead and refund you in full.

Saying this upfront turns a cancellation from a broken promise into a known term. Also quietly encourages people to bring a friend.

**Note on your own cost:** Stripe doesn't return its fee on refunds, so cancelling a night with 5 people booked costs you about $8 out of pocket. Not a reason to change anything — just don't be surprised.

### Blanket 21+

Appears in three places: a badge on every event card and event page, an FAQ answer, and a line in the confirmation email.

> **21+ only.** These events are hosted at breweries and eateries that require all guests to be 21 or older. Please bring valid ID.

The reason it goes in the confirmation email too: the person who bought four spots is not necessarily the person who has to turn a 20-year-old away at the door. Better they read it a week early than argue about it in a doorway.

### Photo consent

One line in the confirmation email:

> We sometimes photograph our events to share on social media and promote future ones. If you'd rather not appear in photos, just tell your host when you arrive — no explanation needed.

Opt-out rather than opt-in is the right call for a casual social event; opt-in checkboxes at checkout add friction for something almost nobody objects to. "Tell your host when you arrive" is the important half — it gives the reluctant person a low-drama way out.

### Timezone: America/New_York

Stored UTC, rendered Eastern everywhere — site, emails, calendar invites, admin. Set in one config constant. Handles daylight saving automatically, which matters for your March and November events.

---

## 19. Brand facts

| | |
|---|---|
| Business name | Make In Motion |
| Domain | **makeinmotion.com** |
| Contact email | makeinmotionct@gmail.com |
| Phone | 860-348-7466 |
| Timezone | America/New_York |
| Policy version | 1.0 |

---

## 20. Content — what's ready, what's missing

### Ready: Canvas Collab Night

**Description (yours, verbatim):**

> You'll start a canvas, then rotate throughout the night—adding, layering, and transforming each piece along the way. No pressure, no perfection, just a fun, evolving process that ends in something completely unexpected.
>
> Perfect if you want to relax, get a little messy, and be part of something creative without overthinking it.

This is good copy. It sells the feeling, not the craft, which is the right instinct for a brewery crowd.

**What's included / what to bring** — your three-column breakdown maps directly onto the event page:

| We bring | Venue provides | You bring |
|---|---|---|
| Art supplies & setup | Tables & seating | Just yourself |
| Instruction & facilitation | Normal service (food/drinks) | |
| Branding & promo assets | | |

**Bonus use:** that same table is a venue pitch. It answers a bar manager's only real question — *what does this cost me?* — in five seconds. Worth a one-page PDF for venue outreach. Say the word and I'll make it.

### Two small gaps in the guest column

"Just themselves" is the right vibe, but two practical lines belong in the confirmation email:

- **Wear something you don't mind getting paint on.** We use washable acrylics, but accidents are part of it.
- **Bring valid ID — these events are 21+.**

Neither belongs on the event page where they'd undercut the easygoing tone. Both belong in the email, three days out, when they're deciding what to wear.

### FAQ page outline

Everything below is already answered in your policy — this is just the ordering:

1. What is Canvas Collab Night?
2. Do I need any experience? *(No.)*
3. What should I wear?
4. Is there an age limit? *(21+, bring ID.)*
5. **Refunds & cancellations** — full §11 text, anchor `#refunds`
6. Can I transfer my ticket?
7. What if I'm running late? *(15-minute rule.)*
8. What if you cancel?
9. Do you do private events?
10. How do I reach you?

### Still missing

- A short **about** paragraph — who you are, why you started this. Two or three sentences. It goes on the homepage and in venue pitches.
- **Photos** — placeholders until your first event (§15).

---

## 21. One thing to sort out today: sending email from your domain

You're buying makeinmotion.com but your contact address is a Gmail. That's fine for people writing *to* you. It's a problem for confirmation emails going *out*.

**Why:** confirmation emails can't be sent from a `@gmail.com` address through Resend — Gmail's DMARC policy rejects it, and the mail lands in spam or bounces. Since the confirmation *is* the ticket, that breaks the product.

**The fix, roughly fifteen minutes:**

1. Send from `hello@makeinmotion.com` (verified in Resend with SPF/DKIM/DMARC records on your Cloudflare DNS).
2. Set **reply-to** as `makeinmotionct@gmail.com`, so replies still land in the inbox you already watch.
3. Turn on **Cloudflare Email Routing** (free) to forward `hello@makeinmotion.com` → your Gmail, so nothing sent to the domain gets lost.

You keep working out of Gmail. Customers see a real business address. Deliverability works.

**Worth considering separately:** put `hello@makeinmotion.com` on the FAQ and contact pages instead of the Gmail. Costs nothing, and it reads more established to a venue manager deciding whether to book you.

---

*Nothing has been built. Say go and I'll start at Phase 0.*
