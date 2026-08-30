-- Ticket numbers were sequential — MIM-TKT-000001, 000002, and so on. That is
-- predictable (anyone can guess the next one) and it publishes how many tickets
-- have ever been sold. Replace the counter with random codes drawn from the
-- same unambiguous alphabet the door codes already use: no 0/O/1/I/L, because
-- these get read aloud in a loud room.
--
-- 31^6 = 887,503,681 possibilities. The loop below re-rolls on the (vanishingly
-- rare) collision, exactly like generate_ticket_code() in 0006.

create or replace function generate_ticket_number() returns text
language plpgsql as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  candidate text;
  i integer;
begin
  loop
    candidate := 'MIM-TKT-';
    for i in 1..6 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from tickets where ticket_number = candidate);
  end loop;
  return candidate;
end;
$$;

-- New tickets get a random number from here on.
alter table tickets
  alter column ticket_number set default generate_ticket_number();

-- Re-number anything already issued in the old sequential format, so no
-- guessable numbers remain in circulation.
do $$
declare
  r record;
begin
  for r in select id from tickets where ticket_number ~ '^MIM-TKT-[0-9]+$' loop
    update tickets set ticket_number = generate_ticket_number() where id = r.id;
  end loop;
end $$;

-- The counter has no remaining references. Safe to remove.
drop sequence if exists ticket_number_seq;

-- Confirm: expect no row to come back in the old format.
select ticket_number from tickets where ticket_number ~ '^MIM-TKT-[0-9]+$';
