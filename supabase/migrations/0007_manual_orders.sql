-- Manual orders: door sales (cash/Venmo, sold in person) and the emergency
-- fallback for whenever Stripe itself is down.
--
-- This is a second entry point into the orders table, so it goes through the
-- exact same defense as reserve_seats() — a row lock on the event, a recount
-- inside that lock — because "count seats in exactly one place" doesn't mean
-- "exactly one function"; it means every path that can insert a paid seat has
-- to take the same lock and ask the same question.
--
-- Two differences from reserve_seats(), both deliberate:
--   1. No hold/expiry — the admin is looking at the money right now, so the
--      order goes straight to 'paid'.
--   2. No event_started check — a walk-up sale after the doors open is a
--      normal thing an admin does; the software shouldn't block it.

alter table orders
  add column payment_method text not null default 'stripe'
    check (payment_method in ('stripe', 'cash', 'venmo', 'cashapp', 'comp', 'other'));

comment on column orders.payment_method is
  'How this order was actually paid. Stripe checkout always sets this by default; '
  'manual/door sales set it explicitly so revenue can be reconciled by method.';

create or replace function create_manual_order(
  p_event_id       uuid,
  p_seats          integer,
  p_customer_name  text,
  p_email          text,
  p_phone          text,
  p_amount_cents   integer,
  p_payment_method text,
  p_policy_version text,
  p_notes          text default null
) returns jsonb
language plpgsql as $$
declare
  v_event       events%rowtype;
  v_taken       integer;
  v_spots_left  integer;
  v_order_id    uuid;
  v_code        text;
begin
  if p_seats is null or p_seats < 1 or p_seats > 8 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_quantity');
  end if;

  if p_amount_cents is null or p_amount_cents < 0 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_amount');
  end if;

  -- Same lock reserve_seats() takes. Concurrent door sales and online
  -- checkouts on the same event are forced to take turns here too.
  select * into v_event from events where id = p_event_id for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'event_not_found');
  end if;

  if v_event.status = 'cancelled' then
    return jsonb_build_object('ok', false, 'reason', 'event_cancelled');
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

  v_code := generate_confirmation_code();

  insert into orders (
    confirmation_code, event_id, customer_name, email, phone,
    seats, amount_cents, status, paid_at,
    policy_accepted_at, policy_version,
    payment_method, notes
  ) values (
    v_code, p_event_id, p_customer_name,
    -- No email on a cash sale is normal. A synthetic address keyed to the
    -- confirmation code (unique) satisfies the not-null column without
    -- pretending we can reach this person electronically.
    lower(trim(coalesce(nullif(trim(p_email), ''), v_code || '@walkup.makeinmotion.com'))),
    p_phone, p_seats, p_amount_cents, 'paid', now(),
    now(), p_policy_version,
    p_payment_method, p_notes
  )
  returning id into v_order_id;

  return jsonb_build_object(
    'ok', true,
    'order_id', v_order_id,
    'confirmation_code', v_code,
    'spots_left', v_spots_left - p_seats,
    'has_email', nullif(trim(p_email), '') is not null
  );
end;
$$;
