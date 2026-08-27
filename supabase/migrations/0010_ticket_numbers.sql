-- Make In Motion: add a human-facing unique ticket number to every seat.
-- Confirmation code = one order.
-- Ticket number   = one individual ticket/seat.
-- Door code       = the scannable single-use code for that ticket.

create sequence if not exists ticket_number_seq;

alter table tickets
  add column if not exists ticket_number text;

with numbered as (
  select id,
         row_number() over (order by created_at, id) as n
  from tickets
  where ticket_number is null
)
update tickets t
set ticket_number = 'MIM-TKT-' || lpad(numbered.n::text, 6, '0')
from numbered
where t.id = numbered.id;

select setval(
  'ticket_number_seq',
  coalesce(
    (select max(substring(ticket_number from '[0-9]+$')::bigint)
     from tickets
     where ticket_number ~ '[0-9]+$'),
    0
  ),
  true
);

alter table tickets
  alter column ticket_number set default (
    'MIM-TKT-' || lpad(nextval('ticket_number_seq')::text, 6, '0')
  );

alter table tickets
  alter column ticket_number set not null;

create unique index if not exists tickets_ticket_number_uidx
  on tickets (ticket_number);

comment on column tickets.ticket_number is
  'Human-facing unique ticket identifier. One ticket number per seat; distinct from the order confirmation code and scannable door code.';
