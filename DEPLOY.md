# Deploy to Cloudflare

End state: your site live at `make-in-motion.<your-subdomain>.workers.dev`, free,
with the seat-hold sweeper running every 5 minutes.

**Prerequisite:** Supabase is set up and `npm run dev` works locally. If it
doesn't, do `SUPABASE-SETUP.md` first — deploying a broken app just moves the
problem somewhere harder to debug.

Total time: about 20 minutes, most of it waiting.

---

## Step 1 — Cloudflare account

Go to **dash.cloudflare.com** → Sign up. Free plan. No card needed.

---

## Step 2 — Log Wrangler in

In your project folder:

```
cd C:\Users\madrazall\_PROJECTS\web\make_in_motion
npx wrangler login
```

A browser window opens. Click **Allow**. Come back to the terminal — it'll say
you're logged in.

---

## Step 3 — Install the last dependency

I added `@cloudflare/workers-types` to `package.json`, so:

```
npm install
```

---

## Step 4 — Set your secrets

Secrets are **not** in `wrangler.jsonc` and never go in git. You set them one at
a time. Each command prompts you to paste the value, then press Enter.

Run these four now — the ones you actually have:

```
npx wrangler secret put NEXT_PUBLIC_SUPABASE_URL
npx wrangler secret put NEXT_PUBLIC_SUPABASE_ANON_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put ADMIN_PASSWORD
```

Paste the same values you put in `.env.local`.

Then two you need to invent. Any long random string works — mash the keyboard
for 40 characters, or run `openssl rand -hex 32` if you have it:

```
npx wrangler secret put SESSION_SECRET
npx wrangler secret put CRON_SECRET
```

**Skip Stripe and Resend for now.** The site deploys and works without them;
you just can't take a payment or send email yet. We'll do those separately.

> The first `wrangler secret put` will ask to create the Worker first. Say yes.

---

## Step 5 — Deploy

```
npm run deploy
```

This builds Next, converts it for Cloudflare, and uploads. Two to four minutes
the first time. At the end it prints your URL:

```
https://make-in-motion.<your-subdomain>.workers.dev
```

Open it.

---

## Step 6 — Check five things

1. **Homepage loads** and says *"Nothing on the calendar right now"* — correct
   if you haven't made an event yet.
2. **`/workshops` shows all 17** with photos on 11. If it's empty, the Worker
   can't reach Supabase — recheck step 4.
3. **No "Preview mode" banner.** If you see one, `NEXT_PUBLIC_SUPABASE_URL`
   didn't get set.
4. **`/admin` asks for a password.** It must. See the security note below.
5. **Open it on your phone.** That's how people will actually see it.

---

## Step 7 — Confirm the cron is running

Cloudflare dashboard → **Workers & Pages** → **make-in-motion** → **Settings**
→ **Triggers**. You should see a cron schedule of `*/5 * * * *`.

To watch it actually run: **Logs** → **Begin log stream**, then wait up to five
minutes. A sweep that finds nothing logs nothing, which is normal and correct.

---

## Two things I fixed right before this

Worth knowing, because both would have bitten you silently.

**The cron didn't work.** The worker OpenNext generates only exports a `fetch`
handler, but Cloudflare cron triggers invoke `scheduled()`. The trigger would
have fired every 5 minutes and done nothing — meaning any abandoned checkout
whose Stripe webhook got lost would hold a seat forever. `worker.ts` now wraps
OpenNext's handler and adds the missing `scheduled()`. Verified in the compiled
bundle, not just assumed.

**The admin could have been left open.** Demo mode bypasses the admin password
so you can review the UI locally. If you'd deployed without the Supabase secret,
the app would have fallen into demo mode *in production* and published an
unauthenticated `/admin`. It now refuses to bypass auth when `NODE_ENV` is
production, regardless.

---

## When something goes wrong

| Symptom | Fix |
|---|---|
| `Authentication error` on deploy | `npx wrangler login` again |
| Site loads, no workshops | Supabase secrets wrong. `npx wrangler secret list` to see which are set (values are hidden) |
| "Preview mode" banner in production | `NEXT_PUBLIC_SUPABASE_URL` not set |
| `/admin` 500s | `SESSION_SECRET` or `ADMIN_PASSWORD` missing |
| Build fails on `.open-next/worker.js` | Run `npm run deploy`, not `npx wrangler deploy` — the build has to happen first |
| Images 404 | They're in `public/images/`. Confirm they're committed and present |

**Rolling back:** Cloudflare dashboard → your Worker → **Deployments** → pick
the previous one → **Rollback**. Takes seconds.

---

## Deploying again later

After any change:

```
npm run deploy
```

That's it. Secrets persist; you only set them once.

---

## What's still not live

1. **Payments.** Add `STRIPE_SECRET_KEY` (test mode first — `sk_test_...`) and
   `STRIPE_WEBHOOK_SECRET`, then add your deployed URL as a webhook endpoint in
   the Stripe dashboard: `https://<your-url>/api/webhooks/stripe`
2. **Email.** Needs `RESEND_API_KEY` **and** a verified sending domain. This is
   the one that needs makeinmotion.com — you can't send from Gmail.
3. **Your domain.** If you bought it through Cloudflare Registrar, DNS is
   already on Cloudflare — skip to "Add custom domain" below. If you bought it
   elsewhere (Ionos, GoDaddy, etc.), DNS has to move to Cloudflare first,
   because Workers custom domains, Email Routing, and the Resend sending-domain
   records all live in the same Cloudflare zone:

   1. Cloudflare dashboard → **Add a site** → enter your domain → free plan.
      Cloudflare hands you two nameservers.
   2. At your registrar (Ionos, etc.) → domain settings → Nameservers →
      replace the defaults with the two Cloudflare gave you. This only moves
      DNS management — the domain itself stays registered where you bought it.
   3. Wait for Cloudflare's activation email (usually under an hour).
   4. **Add custom domain:** Cloudflare dashboard → your Worker → Settings →
      Domains & Routes → **Add custom domain** → enter your domain.
   5. Redeploy: `npm run deploy`. (`NEXT_PUBLIC_SITE_URL` in `wrangler.jsonc`
      is already `https://makeinmotion.com` — no change needed unless the
      domain differs.)
   6. Verify the Resend sending domain (Resend dashboard → Domains → add
      yours → paste the SPF/DKIM records it gives you into the Cloudflare
      DNS tab for that zone) and turn on Cloudflare Email Routing (Email →
      Email Routing → forward `hello@yourdomain` to your Gmail) — see
      PLAN-v2.md §21 for why both of these matter.

Do them in that order. Payments in test mode is the interesting one — you can
run a fake purchase end to end and watch a real confirmation get written.
