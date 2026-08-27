-- Publish the scheduled Mini Terrarium event shown in the event details.
-- This is intentionally conditional: Urban Lodge must already be in venues.
insert into events (
  slug, title, description, venue_id, workshop_id, starts_at, ends_at,
  capacity, min_to_run, price_cents, whats_included, what_to_bring,
  image_url, status
)
select
  'build-your-own-mini-terrarium-urban-lodge-2026-09-22',
  w.name,
  w.description,
  v.id,
  w.id,
  timestamp '2026-09-22 18:00' at time zone 'America/New_York',
  timestamp '2026-09-22 20:00' at time zone 'America/New_York',
  30,
  8,
  3700,
  'Geometric glass vessel, succulents, soil, moss, stones, and all materials included.',
  'Just yourself. Ages 16+.',
  '/images/terrarium.jpg',
  'published'
from workshops w
cross join venues v
where w.slug = 'mini-terrariums'
  and lower(v.name) = 'urban lodge brewing'
  and not exists (
    select 1 from events e
    where e.slug = 'build-your-own-mini-terrarium-urban-lodge-2026-09-22'
  );
