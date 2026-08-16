# Make In Motion — booking system

Pop-up art tutorials at breweries and eateries. Customers pick an event, pick spots,
pay, and get a confirmation. Selling stops automatically at capacity.

Full design rationale lives in **[PLAN-v2.md](./PLAN-v2.md)**. This file is how to run it.

---

## Stack

| | |
|---|---|
| Framework | Next.js 15 (App Router) |
| Hosting | Cloudflare Workers via the OpenNext adapter |
| Database | Supabase (Postgres) |
| Payments | Stripe Checkout (hosted) |
| Email | Resend |
| Timezone | `America/New_York` — stored UTC, displayed Eastern |

---

## The one thing to understand before changing anything

**All capacity logic lives in two places and only two places:**

1. `supabase/migrations/0001_init.sql` — the `reserve_seats()` function
2. `lib/availability.ts` — the thin wrapper around it

`reserve_seats()` takes a `SELECT … FOR UPDATE` row lock on the event, re-counts
inside the lock, and inserts the hold — all in one database round trip. That single
round trip is what makes this safe on Cloudflare Workers, which cannot hold a
multi-statement transaction open.

**Never count seats anywhere else.** Not in a page, not in a component, not in an API
route. The moment that logic exists in two places they disagree, and the way you find
out is a brewery with more people than chairs.

A database trigger (`assert_not_oversold`) is the backstop. It should never fire.

---

## Local setup

```bash
npm install
cp .env.example .env.local     # then fill it in
npm run dev
```

**Database:** create a Supabase project, then run in the SQL editor, in order:

1. Everything in `supabase/migrations/` (`0001_init.sql` through the highest-numbered file)
2. `supabase/seed.sql` (sample venues and two events — dev only)

**Stripe webhooks locally:**

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Copy the `whsec_…` it prints into `STRIPE_WEBHOOK_SECRET`.

---

## Tests

```bash
pip install pgserver "psycopg[binary]" --break-system-packages
python3 tests/concurrency_check.py
```

Spins up a throwaway Postgres, applies the migration, and runs 8 scenarios —
including 20 simultaneous buyers racing for 10 seats. **Run this after any change to
the schema, `reserve_seats()`, or `lib/availability.ts`.** It is the only test that
catches the failure mode that actually matters.

```bash
npm run typecheck
```

---

## Deploying

```bash
npx wrangler login
npm run deploy
```

Secrets are not in `wrangler.jsonc`. Set each one:

```bash
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put RESEND_API_KEY
wrangler secret put ADMIN_PASSWORD
wrangler secret put SESSION_SECRET
wrangler secret put CRON_SECRET
```

The cron trigger in `wrangler.jsonc` runs every 5 minutes to sweep expired seat holds.
Cloudflare's free plan allows a 1-minute minimum; Vercel's would only allow once a day,
which is why this is on Cloudflare.

---

## Before the first real sale

- [ ] Buy `makeinmotion.com` (Cloudflare Registrar — at-cost, renews at the same price)
- [ ] **Verify the sending domain in Resend** (SPF/DKIM/DMARC). Sending from a
      `@gmail.com` address fails DMARC and lands in spam — and the confirmation email
      *is* the ticket. Send from `hello@makeinmotion.com`, reply-to the Gmail.
- [ ] Turn on Cloudflare Email Routing so mail to the domain forwards to Gmail
- [ ] Add the production webhook endpoint in Stripe → `/api/webhooks/stripe`
- [ ] Switch `sk_test_` → `sk_live_`
- [ ] Make one real purchase and one real refund
- [ ] Confirm an event created at 7pm Eastern displays as 7pm
- [ ] Check the confirmation email on a phone

---

## Layout

```
app/
  page.tsx                     upcoming events
  events/[slug]/               event detail + seat picker
  booked/[code]/               confirmation
  faq/                         policy + terms (Stripe needs this visible)
  private-events/              inquiry form, not a checkout flow
  admin/                       single-password admin
  api/
    checkout/                  hold seats, then create the Stripe session
    webhooks/stripe/           source of truth for payment
    cron/expire-holds/         backup sweep
lib/
  availability.ts              ALL capacity logic
  policy.ts                    versioned refund policy
  config.ts                    every business constant
supabase/migrations/           schema + reserve_seats + oversell trigger
tests/concurrency_check.py     the test that matters
```

---

## Gotchas that are already handled — don't "fix" them

- **Prices are recomputed server-side** inside `reserve_seats()`. Whatever the browser
  sends about money is ignored.
- **The webhook, not the redirect, marks an order paid.** Someone who pays and closes
  the tab still gets their ticket.
- **Webhook handlers are idempotent.** Stripe delivers duplicates; the `.eq("status",
  "pending")` filter means a second delivery matches zero rows and sends no second email.
- **A no-show seat stays sold.** It was paid for. `partially_refunded` still occupies a
  seat — they cancelled inside 72 hours and forfeited it. Only a full refund frees it.
- **Check-in is per-seat, not per-name.** Each seat on a paid order gets its own
  single-use QR code (`tickets` table, generated right after payment). The door scans
  at `/admin/checkin` — no attendee-name list to maintain. `check_in_ticket()` claims a
  code atomically, so two scans of the same code can't both "win."
- **Door sales and Stripe-outage sales go through `create_manual_order()`, not a
  second capacity check.** It takes the same row lock and calls the same
  `seats_taken()` as `reserve_seats()` — see `supabase/migrations/0007_manual_orders.sql`.
  Never add a third way to insert a paid order without going through one of these two
  functions, or the "count seats in exactly one place" guarantee breaks.
- **Refund tiers are computed in hours, not days** (`lib/policy.ts`) to avoid
  off-by-one bugs at midnight and across daylight saving.
- **The policy is versioned.** Orders store `policy_version` and `policy_accepted_at`.
  Never edit a published version in place — add a new one.
