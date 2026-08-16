-- Per-seat ticket codes, so check-in doesn't depend on attendee names.
--
-- Orders already track a party (name, email, seats) as one unit, but that's
-- the wrong granularity for the door: four people arrive separately, and
-- nobody wants to maintain four names per order. Instead each *seat* gets its
-- own single-use code, generated once the order is paid. A cheap USB/BT QR
-- scanner (keyboard-wedge — it just types the decoded text + Enter) scans the
-- code from the confirmation email; the door never needs a name at all.

create table tickets (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references orders(id) on delete cascade,
  seat_number    integer not null check (seat_number >= 1),
  code           text not null unique,
  checked_in_at  timestamptz,
  created_at     timestamptz not null default now(),

  unique (order_id, seat_number)
);

create index tickets_order_idx on tickets (order_id);

comment on table tickets is
  'One row per seat on a paid order. code is what the door scanner reads. '
  'checked_in_at can only be set once — see check_in_ticket().';

-- ---------------------------------------------------------------------------
-- Ticket codes
-- ---------------------------------------------------------------------------

create or replace function generate_ticket_code() returns text
language plpgsql as $$
declare
  -- No 0/O/1/I/L — same reasoning as confirmation codes, in case a scanner
  -- battery dies and someone has to read a code aloud or type it by hand.
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  candidate text;
  i integer;
begin
  loop
    candidate := '';
    for i in 1..8 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from tickets where code = candidate);
  end loop;
  return candidate;
end;
$$;

-- ---------------------------------------------------------------------------
-- Ticket generation — called once an order is marked paid
-- ---------------------------------------------------------------------------

create or replace function create_tickets_for_order(p_order_id uuid)
returns setof tickets
language plpgsql as $$
declare
  v_order orders%rowtype;
  i integer;
begin
  select * into v_order from orders where id = p_order_id;
  if not found then
    raise exception 'create_tickets_for_order: order % not found', p_order_id;
  end if;

  -- Idempotent: a retried webhook delivery must not mint duplicate tickets.
  if exists (select 1 from tickets where order_id = p_order_id) then
    return query select * from tickets where order_id = p_order_id order by seat_number;
    return;
  end if;

  for i in 1..v_order.seats loop
    insert into tickets (order_id, seat_number, code)
    values (p_order_id, i, generate_ticket_code());
  end loop;

  return query select * from tickets where order_id = p_order_id order by seat_number;
end;
$$;

-- ---------------------------------------------------------------------------
-- check_in_ticket — THE important one for the door
--
-- Atomically claims a code: two people scanning the same code at the same
-- instant, one wins. `where checked_in_at is null` in the UPDATE is what
-- makes this a single-statement compare-and-set rather than a race.
-- ---------------------------------------------------------------------------

create or replace function check_in_ticket(p_code text) returns jsonb
language plpgsql as $$
declare
  v_ticket_id uuid;
  v_ticket    tickets%rowtype;
  v_order     orders%rowtype;
  v_code      text := upper(trim(p_code));
begin
  select t.* into v_ticket from tickets t where t.code = v_code;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  v_ticket_id := v_ticket.id;

  select * into v_order from orders where id = v_ticket.order_id;

  if v_order.status in ('refunded', 'cancelled') then
    return jsonb_build_object(
      'ok', false, 'reason', 'order_cancelled',
      'guest_name', v_order.customer_name
    );
  end if;

  update tickets
     set checked_in_at = now()
   where id = v_ticket_id
     and checked_in_at is null
  returning * into v_ticket;

  if not found then
    -- Someone already scanned this one. Not an error — just tell the door who.
    select t.* into v_ticket from tickets t where t.id = v_ticket_id;
    return jsonb_build_object(
      'ok', false, 'reason', 'already_used',
      'guest_name', v_order.customer_name,
      'seat_number', v_ticket.seat_number,
      'seats_total', v_order.seats,
      'checked_in_at', v_ticket.checked_in_at
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'guest_name', v_order.customer_name,
    'seat_number', v_ticket.seat_number,
    'seats_total', v_order.seats,
    'event_id', v_order.event_id
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Row level security — service-role only, same as orders.
-- ---------------------------------------------------------------------------

alter table tickets enable row level security;
