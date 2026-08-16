# Supabase setup — 10 minutes

You need three values out of Supabase and into a file called `.env.local`.
That's the whole job.

---

## 1. Create the project

Go to **supabase.com** → sign up → **New project**.

| Field | What to put |
|---|---|
| Name | `make-in-motion` |
| Database password | Generate one and **save it in your password manager**. You won't need it day to day, but you can't recover it. |
| Region | **East US (North Virginia)** — closest to Connecticut |
| Plan | Free |

It takes about two minutes to spin up.

---

## 2. Run the SQL

Left sidebar → **SQL Editor** → **New query**.

Open **`supabase/SETUP.sql`** from this project, select all of it, paste it in,
and click **Run**.

It's one file, ~31KB, and it does everything: every table, the seat-reservation
function that stops you overselling, the oversell guard, and all 17 workshops
with their descriptions and images.

You should see **"Success. No rows returned."**

**Check it worked** — new query, paste this:

```sql
select count(*) as workshops, count(image_url) as with_images from workshops;
```

You want **17 workshops, 11 with images**. If you get that, the database is done.

> Only run `SETUP.sql` once. Running it twice will error on "type already exists"
> — harmless, but it means it already ran.

---

## 3. Copy the three values

Left sidebar → **Project Settings** (gear icon) → **API**.

You need three things off that page:

| On the Supabase page | Goes into |
|---|---|
| **Project URL** — `https://xxxxx.supabase.co` | `NEXT_PUBLIC_SUPABASE_URL` |
| **anon / public** key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| **service_role** key (click *Reveal*) | `SUPABASE_SERVICE_ROLE_KEY` |

⚠️ **The service_role key bypasses all security.** It goes in `.env.local` and
nowhere else. Never paste it into a browser, a chat, a screenshot, or any file
that gets committed to git. `.env.local` is already in `.gitignore`.

---

## 4. Make the .env.local file

In the project folder, copy `.env.example` and rename the copy to `.env.local`.
Open it in Notepad and fill in the three Supabase lines:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
```

Also set these two now so the admin works:

```
ADMIN_PASSWORD=pick-something-long
SESSION_SECRET=any-random-32-characters
```

**Leave the Stripe and Resend lines as the placeholder values.** Nothing breaks
— you just can't take a real payment yet. That's the next step, not this one.

---

## 5. Run it

```
cd C:\Users\madrazall\_PROJECTS\web\make_in_motion
npm install
npm run dev
```

Open **http://localhost:3000**.

**What you should see:** the workshop menu at `/workshops` with all 17, real
photos on 11 of them. The home page will say *"Nothing on the calendar right
now"* — correct, because you have no events yet.

The "Preview mode" banner should be **gone**. If it's still there, the app
can't see your Supabase URL — check `.env.local` is named exactly that (not
`.env.local.txt`, which Notepad does silently).

---

## 6. Add your first venue and event

Go to **http://localhost:3000/admin** and log in with your `ADMIN_PASSWORD`.

You need a venue before you can create an event. Two ways:

**In Supabase** — SQL Editor, uncomment the venue template at the bottom of
`SETUP.sql`, fill in a real brewery, run it.

**Or** paste this with your own details:

```sql
insert into venues (name, address, city, state, zip, contact_name, contact_email)
values ('Stubborn Beauty Brewing', '180 Johnson St', 'Middletown', 'CT', '06457',
        'Bar manager', 'them@example.com');
```

Then `/admin/events/new` → pick the venue, set a date, capacity, price → **Publish**.
It'll appear on the homepage immediately.

---

## If something goes wrong

| Symptom | Cause |
|---|---|
| Still says "Preview mode" | `.env.local` missing, misnamed, or the URL doesn't start with `https://`. Restart `npm run dev` after editing it. |
| "Missing required environment variable" | A line in `.env.local` is blank. Every key needs a value. |
| Pages load but no workshops | `SETUP.sql` didn't run, or ran against a different project. |
| "relation does not exist" | Same — the SQL didn't run. |
| Admin login rejects you | `ADMIN_PASSWORD` and `SESSION_SECRET` must both be set. |

**Nothing here can break anything permanently.** Worst case you delete the
Supabase project and start over — it's free and takes two minutes.

---

## What's next after this

1. **Stripe keys** — test mode first (`sk_test_...`), so you can run a fake purchase end to end
2. **Resend + domain verification** — the confirmation email is the ticket, and it needs SPF/DKIM on makeinmotion.com
3. **Deploy to Cloudflare**

Don't do those today. Get the database up and look at your own workshops on
your own screen first.
