-- ===========================================================================
-- MAKE IN MOTION — full database setup
--
-- Paste this whole file into the Supabase SQL Editor and hit Run. Once.
--
-- It creates every table, the seat-reservation function that stops you
-- overselling, the oversell guard, and the 17-workshop catalogue with images.
--
-- It does NOT create any venues or events — you add those yourself in the
-- admin, or with the template at the bottom of this file.
--
-- Safe to read top to bottom. Nothing here deletes data.
-- ===========================================================================



-- ---------------------------------------------------------------------------
-- migrations/0001_init.sql
-- ---------------------------------------------------------------------------

-- Make In Motion — initial schema
-- The whole point of this file is the reserve_seats() function further down.
-- Everything else is bookkeeping.

-- gen_random_uuid() is built into Postgres 13+, so no extension is required.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type event_status as enum ('draft', 'published', 'completed', 'cancelled');

create type order_status as enum (
  'pending',              -- holding seats, not yet paid
  'paid',
  'refunded',             -- full refund
  'partially_refunded',   -- the 50% tier
  'expired',              -- hold lapsed before payment
  'cancelled'             -- we cancelled the event
);

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table venues (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  address       text not null,
  city          text not null,
  state         text not null default 'CT',
  zip           text not null,
  map_url       text,
  contact_name  text,
  contact_email text,
  contact_phone text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table events (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique,
  title              text not null,
  description        text not null default '',
  image_url          text,
  venue_id           uuid not null references venues(id) on delete restrict,

  starts_at          timestamptz not null,
  ends_at            timestamptz not null,

  capacity           integer not null check (capacity > 0),
  -- Below this at T-3 days, the event gets flagged for cancellation. Plan §18.
  min_to_run         integer not null default 6 check (min_to_run >= 0),
  price_cents        integer not null check (price_cents >= 0),

  whats_included     text not null default '',
  what_to_bring      text not null default '',
  -- Your own margin notes: what you owe the venue, or what they comp you.
  venue_payout_note  text,

  status             event_status not null default 'draft',

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint ends_after_starts check (ends_at > starts_at),
  constraint min_to_run_within_capacity check (min_to_run <= capacity)
);

comment on column events.min_to_run is
  'Minimum paid seats to run the event. Checked at T-3 days; never auto-cancels.';

create table orders (
  id                       uuid primary key default gen_random_uuid(),
  confirmation_code        text not null unique,
  event_id                 uuid not null references events(id) on delete restrict,

  customer_name            text not null,
  email                    text not null,
  phone                    text,

  seats                    integer not null check (seats between 1 and 8),
  amount_cents             integer not null check (amount_cents >= 0),

  status                   order_status not null default 'pending',

  stripe_session_id        text unique,
  stripe_payment_intent_id text,

  -- Seats are held until this moment. Matches Stripe Checkout's 30-min minimum.
  hold_expires_at          timestamptz,
  paid_at                  timestamptz,

  -- Proof they accepted the refund policy. Worthless without both columns.
  policy_accepted_at       timestamptz,
  policy_version           text,

  refund_cents             integer not null default 0 check (refund_cents >= 0),
  refunded_at              timestamptz,

  checked_in_at            timestamptz,
  notes                    text,

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

comment on column orders.policy_version is
  'Which version of the refund policy this customer agreed to. Never edit a published version in place.';

create table waitlist (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references events(id) on delete cascade,
  name         text not null,
  email        text not null,
  seats_wanted integer not null default 1 check (seats_wanted between 1 and 8),
  notified_at  timestamptz,
  created_at   timestamptz not null default now(),
  unique (event_id, email)
);

create table private_inquiries (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  email          text not null,
  phone          text,
  preferred_date date,
  headcount      integer,
  message        text,
  handled        boolean not null default false,
  created_at     timestamptz not null default now()
);

-- Homepage capture for people who aren't ready to buy. Plan §16 item 9.
create table subscribers (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  source     text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index orders_event_status_idx on orders (event_id, status);
create index orders_hold_sweep_idx   on orders (hold_expires_at) where status = 'pending';
create index orders_email_idx        on orders (lower(email));
create index events_upcoming_idx     on events (starts_at) where status = 'published';
create index waitlist_event_idx      on waitlist (event_id) where notified_at is null;

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger venues_touch before update on venues
  for each row execute function touch_updated_at();
create trigger events_touch before update on events
  for each row execute function touch_updated_at();
create trigger orders_touch before update on orders
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- Availability
--
-- A seat is unavailable if it is PAID FOR or CURRENTLY HELD by someone
-- mid-checkout. Nothing else counts. Sold-out is always computed, never stored.
-- ---------------------------------------------------------------------------

create or replace function seats_taken(p_event_id uuid) returns integer
language sql stable as $$
  select coalesce(sum(seats), 0)::integer
  from orders
  where event_id = p_event_id
    and (
      status in ('paid', 'partially_refunded')
      or (status = 'pending' and hold_expires_at > now())
    );
$$;

comment on function seats_taken is
  'Paid seats plus live holds. A no-show stays counted — it was paid for. '
  'partially_refunded still occupies a seat: they cancelled inside 72h and forfeited it.';

create or replace view event_availability as
  select
    e.id           as event_id,
    e.capacity,
    seats_taken(e.id) as seats_taken,
    greatest(e.capacity - seats_taken(e.id), 0) as spots_left,
    (seats_taken(e.id) >= e.capacity) as sold_out
  from events e;

-- ---------------------------------------------------------------------------
-- Confirmation codes
-- ---------------------------------------------------------------------------

create or replace function generate_confirmation_code() returns text
language plpgsql as $$
declare
  -- No 0/O/1/I/L — these get read aloud over a noisy brewery.
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  candidate text;
  i integer;
begin
  loop
    candidate := 'MIM-';
    for i in 1..6 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from orders where confirmation_code = candidate);
  end loop;
  return candidate;
end;
$$;

-- ---------------------------------------------------------------------------
-- reserve_seats — THE IMPORTANT ONE
--
-- Everything about not overselling lives here. It runs entirely inside the
-- database as a single statement, which is what makes it safe to call from a
-- Cloudflare Worker: Workers can only speak HTTP to Supabase and cannot hold a
-- multi-statement transaction open.
--
-- The lock is `select ... for update` on the event row. Two simultaneous
-- callers are forced to take turns; the second one sees the first one's hold.
-- ---------------------------------------------------------------------------

create or replace function reserve_seats(
  p_event_id        uuid,
  p_seats           integer,
  p_customer_name   text,
  p_email           text,
  p_phone           text,
  p_policy_version  text,
  p_hold_minutes    integer default 30
) returns jsonb
language plpgsql as $$
declare
  v_event       events%rowtype;
  v_taken       integer;
  v_spots_left  integer;
  v_order_id    uuid;
  v_code        text;
  v_amount      integer;
begin
  if p_seats is null or p_seats < 1 or p_seats > 8 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_quantity');
  end if;

  -- Take the lock. Everything after this point is serialized per event.
  select * into v_event from events where id = p_event_id for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'event_not_found');
  end if;

  if v_event.status <> 'published' then
    return jsonb_build_object('ok', false, 'reason', 'event_not_on_sale');
  end if;

  if v_event.starts_at <= now() then
    return jsonb_build_object('ok', false, 'reason', 'event_started');
  end if;

  v_taken      := seats_taken(p_event_id);
  v_spots_left := greatest(v_event.capacity - v_taken, 0);

  if p_seats > v_spots_left then
    return jsonb_build_object(
      'ok', false,
      'reason', case when v_spots_left = 0 then 'sold_out' else 'not_enough_spots' end,
      'spots_left', v_spots_left
    );
  end if;

  -- Price is recomputed here from the event record. Never trust the browser.
  v_amount := v_event.price_cents * p_seats;
  v_code   := generate_confirmation_code();

  insert into orders (
    confirmation_code, event_id, customer_name, email, phone,
    seats, amount_cents, status, hold_expires_at,
    policy_accepted_at, policy_version
  ) values (
    v_code, p_event_id, p_customer_name, lower(trim(p_email)), p_phone,
    p_seats, v_amount, 'pending', now() + make_interval(mins => p_hold_minutes),
    now(), p_policy_version
  )
  returning id into v_order_id;

  return jsonb_build_object(
    'ok', true,
    'order_id', v_order_id,
    'confirmation_code', v_code,
    'amount_cents', v_amount,
    'spots_left', v_spots_left - p_seats
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Belt and suspenders
--
-- This should never fire. If it does, the transaction rolls back and one
-- customer sees an error — which beats explaining to a brewery why 22 people
-- turned up for 18 chairs.
-- ---------------------------------------------------------------------------

create or replace function assert_not_oversold() returns trigger
language plpgsql as $$
declare
  v_capacity integer;
  v_taken    integer;
begin
  -- Re-lock: a no-op if reserve_seats already holds it, protection if not
  -- (e.g. an order inserted by hand through the admin).
  select capacity into v_capacity from events where id = new.event_id for update;

  v_taken := seats_taken(new.event_id);

  if v_taken > v_capacity then
    raise exception
      'OVERSOLD: event % would have % seats committed against a capacity of %',
      new.event_id, v_taken, v_capacity
      using errcode = 'MIM01';
  end if;

  return null;
end;
$$;

create trigger orders_no_oversell
  after insert or update of seats, status, hold_expires_at, event_id on orders
  for each row execute function assert_not_oversold();

-- ---------------------------------------------------------------------------
-- Hold sweep — backup for the checkout.session.expired webhook
-- ---------------------------------------------------------------------------

create or replace function expire_holds() returns integer
language plpgsql as $$
declare
  v_count integer;
begin
  with expired as (
    update orders
       set status = 'expired'
     where status = 'pending'
       and hold_expires_at is not null
       and hold_expires_at <= now()
    returning 1
  )
  select count(*)::integer into v_count from expired;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Underbooked events, for the T-3 day go/no-go
-- ---------------------------------------------------------------------------

create or replace view events_needing_decision as
  select
    e.id,
    e.slug,
    e.title,
    e.starts_at,
    e.min_to_run,
    e.capacity,
    coalesce(paid.seats, 0) as paid_seats
  from events e
  left join lateral (
    select sum(seats)::integer as seats
    from orders o
    where o.event_id = e.id
      and o.status in ('paid', 'partially_refunded')
  ) paid on true
  where e.status = 'published'
    and e.starts_at between now() and now() + interval '3 days'
    and coalesce(paid.seats, 0) < e.min_to_run;

-- ---------------------------------------------------------------------------
-- Row level security
--
-- The app talks to Supabase with the service role key from the server only,
-- which bypasses RLS. These policies exist so that if the anon key ever leaks
-- into the browser, the blast radius is "can read published events".
-- ---------------------------------------------------------------------------

alter table venues            enable row level security;
alter table events            enable row level security;
alter table orders            enable row level security;
alter table waitlist          enable row level security;
alter table private_inquiries enable row level security;
alter table subscribers       enable row level security;

create policy venues_public_read on venues
  for select using (
    exists (select 1 from events e where e.venue_id = venues.id and e.status = 'published')
  );

create policy events_public_read on events
  for select using (status = 'published');

-- No anon policies on orders, waitlist, private_inquiries, subscribers.
-- Those are service-role only, by omission.


-- ---------------------------------------------------------------------------
-- migrations/0002_workshops.sql
-- ---------------------------------------------------------------------------

-- Workshops catalog.
--
-- A workshop is the ACTIVITY ("Candle Making"). An event is one INSTANCE of a
-- workshop at a venue on a date. Separating them means the menu page can list
-- 17 things you offer while only 4 are currently on sale — and creating a new
-- event becomes "pick workshop + venue + date" instead of retyping copy.

create table workshops (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  name             text not null,
  tagline          text not null default '',
  description      text not null default '',
  what_you_make    text not null default '',

  -- Occasion tags, used for filtering on the menu page.
  good_for         text[] not null default '{}',

  duration_minutes integer not null default 120,
  -- Indicative "from" pricing for the menu. Actual price is set per event.
  base_price_cents integer not null default 4500,

  min_group        integer not null default 6,
  max_group        integer not null default 24,

  -- Low-mess activities a bar manager will say yes to more easily.
  bar_friendly     boolean not null default true,

  image_url        text,
  active           boolean not null default true,
  sort_order       integer not null default 100,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger workshops_touch before update on workshops
  for each row execute function touch_updated_at();

create index workshops_active_idx on workshops (sort_order, name) where active;

-- An event may be an instance of a catalog workshop. Nullable so one-off
-- experiments don't need a catalog entry first.
alter table events add column workshop_id uuid references workshops(id) on delete set null;
create index events_workshop_idx on events (workshop_id);

-- Inquiries now come from two audiences with different needs.
alter table private_inquiries
  add column inquiry_type text not null default 'private'
    check (inquiry_type in ('private', 'venue')),
  add column workshop_interest text,
  add column venue_name text;

comment on column private_inquiries.inquiry_type is
  'private = a guest booking a group. venue = a bar/restaurant wanting to host.';

alter table workshops enable row level security;
create policy workshops_public_read on workshops
  for select using (active);

-- ---------------------------------------------------------------------------
-- The catalog
-- ---------------------------------------------------------------------------

insert into workshops
  (slug, name, tagline, description, what_you_make, good_for,
   duration_minutes, base_price_cents, min_group, max_group, bar_friendly, sort_order)
values

('canvas-collab-night', 'Canvas Collab Night',
 'Everyone paints everyone else''s canvas.',
 E'You''ll start a canvas, then rotate throughout the night—adding, layering, and transforming each piece along the way. No pressure, no perfection, just a fun, evolving process that ends in something completely unexpected.\n\nPerfect if you want to relax, get a little messy, and be part of something creative without overthinking it.',
 'A collaborative canvas nobody could have made alone',
 '{"Girls'' night","Team building","Date night","Beginner-friendly"}',
 120, 4500, 6, 24, true, 10),

('classic-canvas', 'Classic Canvas',
 'One painting, step by step, at your own pace.',
 E'The one everybody pictures when they hear "paint night." We pick the image, break it into steps, and walk the whole room through it together.\n\nYou''ll surprise yourself. People who swear they can''t draw leave with something they actually hang up.',
 'A finished 11x14 canvas to take home',
 '{"Date night","Girls'' night","Birthday","Beginner-friendly"}',
 120, 4500, 6, 30, true, 20),

('ink-tiles', 'Ink Tiles',
 'Alcohol ink on ceramic. Impossible to do badly.',
 E'Alcohol ink moves on its own—you drop it, tilt it, blow it around, and it blooms into something you couldn''t have planned. Every tile comes out different and every one looks good.\n\nThe lowest-pressure thing we do. Great for people who are nervous about "being creative."',
 'Two finished ceramic tiles, sealed and ready to display',
 '{"Beginner-friendly","Date night","Team building","Girls'' night"}',
 90, 4000, 6, 28, true, 30),

('paint-pour', 'Paint Pour',
 'Controlled chaos. Wildly satisfying.',
 E'Layer the paint, tip the canvas, and watch cells bloom across the surface. It''s part chemistry, part gravity, and completely mesmerizing.\n\nMessier than most—we bring the drop cloths—and worth it.',
 'A poured canvas plus the video everyone takes of it happening',
 '{"Girls'' night","Birthday","Beginner-friendly"}',
 120, 5000, 6, 20, false, 40),

('glassware-painting', 'Beer Mug & Wine Glass Painting',
 'Paint the thing you''re drinking out of.',
 E'Pick a mug or a stemless wine glass and make it yours. We use enamel that bakes on and survives the dishwasher, so this one actually gets used instead of living in a cabinet.\n\nThe most natural fit for a brewery night—people are already holding a glass.',
 'A dishwasher-safe glass or mug you''ll actually use',
 '{"Date night","Birthday","Girls'' night","Beginner-friendly"}',
 120, 4500, 6, 26, true, 50),

('yeti-personalization', 'Tumbler Personalization',
 'Make your Yeti unmistakably yours.',
 E'Vinyl, monograms, and designs applied to insulated tumblers. Bring your own or use one of ours.\n\nPopular with teams and anyone who has lost a tumbler to a shared office kitchen.',
 'A personalized insulated tumbler',
 '{"Team building","Birthday","Guys'' night"}',
 90, 5500, 6, 24, true, 60),

('candle-making', 'Candle Making',
 'Pick your scent, pour your own.',
 E'Blend from a tray of fragrance oils until you land on something that''s yours, then pour it into a vessel you choose. We''ll talk you through what layers well and what fights.\n\nThe room smells incredible for the entire two hours, which venues tend to like.',
 'A poured candle in a reusable vessel',
 '{"Girls'' night","Date night","Baby shower","Bachelorette"}',
 120, 5000, 6, 24, true, 70),

('tie-dye', 'Tie Dye',
 'Not the summer camp version.',
 E'Ice dye, reverse dye, and folding patterns that come out looking deliberate. Bring a shirt or use one of ours.\n\nBest outdoors or in a space that doesn''t mind color. We handle containment either way.',
 'A dyed shirt or tote, wrapped to set overnight',
 '{"Team building","Birthday","Girls'' night","Beginner-friendly"}',
 120, 4000, 8, 30, false, 80),

('wreaths', 'Wreath Making',
 'Seasonal, and better than the store-bought one.',
 E'Build a wreath on a real frame with materials that suit the season—dried florals, eucalyptus, ribbon, whatever the month calls for.\n\nRuns bigger than most of our workshops because people bring their mothers.',
 'A finished wreath for your door',
 '{"Seasonal","Girls'' night","Birthday"}',
 120, 6000, 6, 22, true, 90),

('door-signs', 'Door Signs',
 'Wood, paint, and something to say.',
 E'Stencil and paint a wooden sign for a front door or entryway. Seasonal designs or your own words.\n\nAnother one that scales well and photographs nicely.',
 'A painted wooden door sign',
 '{"Seasonal","Girls'' night","Birthday"}',
 120, 5500, 6, 22, true, 100),

('coasters', 'Coasters',
 'Small project, big payoff.',
 E'Resin, ink, or tile coasters in a set of four. Short enough to finish comfortably in an evening and useful enough that people keep them.\n\nGood entry point if a venue wants to test a shorter format.',
 'A set of four finished coasters',
 '{"Beginner-friendly","Date night","Team building"}',
 90, 3500, 6, 28, true, 110),

('jewelry-bar', 'Jewelry Bar',
 'Build it from a table of parts.',
 E'Beads, charms, chain, and clasps laid out bar-style. You browse, pick, and we help you assemble. No two people make the same thing.\n\nFormat works well as a drop-in, which suits a venue that wants foot traffic across a whole evening rather than a fixed start time.',
 'A necklace, bracelet, or pair of earrings',
 '{"Girls'' night","Bachelorette","Birthday","Beginner-friendly"}',
 90, 4500, 6, 30, true, 120),

('vision-boards', 'Vision Boards',
 'January energy, any month.',
 E'Magazines, prompts, and a board. We give it enough structure that it doesn''t stall out—prompts to work from, and time to actually talk about what people put down.\n\nQuieter and more reflective than our other nights. Groups tend to stay late.',
 'A finished vision board',
 '{"Girls'' night","Team building","Seasonal","Beginner-friendly"}',
 120, 4000, 6, 24, true, 130),

('coffee-filter-flowers', 'Coffee Filter Flowers',
 'Cheap materials, absurdly pretty results.',
 E'Dyed coffee filters become peonies, roses, and things that look nothing like coffee filters. The reveal when the first one opens up gets a reaction every time.\n\nAlmost no mess, which makes it easy for a venue to say yes to.',
 'A small bouquet of paper flowers',
 '{"Baby shower","Girls'' night","Beginner-friendly","Seasonal"}',
 90, 3500, 6, 28, true, 140),

('onesie-decorating', 'Onesie Decorating',
 'The baby shower activity that isn''t a game.',
 E'Guests decorate onesies for the baby with fabric paint, stencils, and iron-on vinyl. The parents leave with a dozen one-of-a-kind pieces instead of another set of clothes from a registry.\n\nWorks alongside food and drinks rather than interrupting them.',
 'Decorated onesies for the guest of honor',
 '{"Baby shower","Beginner-friendly"}',
 90, 4000, 6, 24, true, 150),

('garter-making', 'Garter Making',
 'Bachelorette, handled.',
 E'Lace, ribbon, and trim to build a garter for the bride—plus whatever the group decides to make for themselves. Runs loud and it should.\n\nPairs well with a bar tab.',
 'A handmade garter, plus whatever else the group gets up to',
 '{"Bachelorette","Girls'' night"}',
 90, 4500, 6, 20, true, 160),

('cornhole-boards', 'Cornhole Board Painting',
 'For the group that says they''re not crafty.',
 E'Paint a set of cornhole boards—team logos, custom designs, whatever the group wants. Then play on them.\n\nBuilt for the crowd that wouldn''t sign up for a paint night. Longer session and it needs floor space.',
 'A painted cornhole set for the group',
 '{"Guys'' night","Team building","Birthday"}',
 180, 7500, 4, 16, false, 170);


-- ---------------------------------------------------------------------------
-- migrations/0003_workshop_photos.sql
-- ---------------------------------------------------------------------------

-- Attach the first real photos.
--
-- Paths are relative to the site root: files live in public/images/ and are
-- served at /images/<name>. Anything left null falls back to the generated
-- neon placeholder, so a half-photographed catalog still looks deliberate.

update workshops set image_url = '/images/paint-and-sip.jpg' where slug = 'classic-canvas';
update workshops set image_url = '/images/jewelry-bar.jpg'   where slug = 'jewelry-bar';
update workshops set image_url = '/images/tie-dye.jpg'       where slug = 'tie-dye';

-- Canvas Collab Night is the flagship and currently has no photo of its own.
-- The paint-and-sip shot is close enough in feel to carry it until there is one.
update workshops set image_url = '/images/paint-and-sip.jpg' where slug = 'canvas-collab-night';

-- Existing published events inherit their workshop's photo where they don't
-- already have one of their own.
update events e
   set image_url = w.image_url
  from workshops w
 where e.image_url is null
   and w.image_url is not null
   and (e.workshop_id = w.id or e.title = w.name);


-- ---------------------------------------------------------------------------
-- migrations/0004_ink_tiles_photo.sql
-- ---------------------------------------------------------------------------

-- Placeholder artwork for Ink Tiles.
--
-- This one is RENDERED, not photographed (tools/generate_ink_tiles.py).
-- It's honest about what the workshop produces, but swap it for a real photo
-- after the first Ink Tiles night — actual guest work always beats a render.

update workshops set image_url = '/images/ink-tiles.jpg' where slug = 'ink-tiles';

update events e
   set image_url = w.image_url
  from workshops w
 where e.image_url is null
   and w.image_url is not null
   and (e.workshop_id = w.id or e.title = w.name);


-- ---------------------------------------------------------------------------
-- migrations/0005_workshop_photos_batch2.sql
-- ---------------------------------------------------------------------------

-- Seven more workshop images.
--
-- These are AI-generated, not photographs of real Make In Motion events.
-- They're a strong placeholder set — swap each one for a real photo as you
-- run that workshop. See BRAND.html §07 for what to shoot.

update workshops set image_url = '/images/candle-making.jpg'         where slug = 'candle-making';
update workshops set image_url = '/images/paint-pour.jpg'            where slug = 'paint-pour';
update workshops set image_url = '/images/coasters.jpg'              where slug = 'coasters';
update workshops set image_url = '/images/coffee-filter-flowers.jpg' where slug = 'coffee-filter-flowers';
update workshops set image_url = '/images/onesie-decorating.jpg'     where slug = 'onesie-decorating';
update workshops set image_url = '/images/garter-making.jpg'         where slug = 'garter-making';

-- Ink Tiles now has a proper image of alcohol ink on white tile, replacing
-- the procedural render from 0004. tools/generate_ink_tiles.py still works if
-- you ever want generated variations for social.
update workshops set image_url = '/images/ink-tiles.jpg' where slug = 'ink-tiles';

-- Events inherit their workshop's photo when they don't have one.
update events e
   set image_url = w.image_url
  from workshops w
 where e.image_url is null
   and w.image_url is not null
   and (e.workshop_id = w.id or e.title = w.name);

-- 11 of 17 workshops now have artwork. The 6 still bare:
--   glassware-painting, yeti-personalization, wreaths,
--   door-signs, vision-boards, cornhole-boards
-- They fall back to the generated neon placeholder, which is fine.



-- ===========================================================================
-- YOUR FIRST VENUE
--
-- Events need a venue. Add one here (edit the values), or skip this and add
-- it later. Delete the /* */ around it to run it.
-- ===========================================================================

/*
insert into venues (name, address, city, state, zip, map_url, contact_name, contact_email, contact_phone, notes)
values (
  'Venue Name Here',
  '123 Main St',
  'Middletown',
  'CT',
  '06457',
  'https://maps.google.com/?q=Venue+Name+Middletown+CT',
  'Bar manager name',
  'them@example.com',
  '860-555-0000',
  'Anything you want to remember — where the outlets are, how many the back room seats.'
);
*/


-- ===========================================================================
-- CHECK IT WORKED
-- Run these after the above. You should get 17 workshops and 11 with images.
-- ===========================================================================

-- select count(*) as workshops, count(image_url) as with_images from workshops;
-- select slug, name, base_price_cents/100 as price from workshops order by sort_order;
