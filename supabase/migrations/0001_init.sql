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
