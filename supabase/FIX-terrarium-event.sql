-- ============================================================================
-- FIX: no events on the live site, every /events/... URL 404s
--
-- Why: migrations 0011 (mini-terrariums workshop) and 0012 (the Sept 22 event)
-- were never applied to the production database. 0012's insert is conditional
-- on BOTH the workshop AND a venue named "Urban Lodge Brewing" already
-- existing -- when either is missing it inserts zero rows and still reports
-- success, so nothing ever told you it failed.
--
-- Run this whole file in the Supabase SQL editor. It is safe to run twice.
-- Unlike 0012, it RAISES if a prerequisite is missing instead of doing nothing.
--
-- BEFORE YOU RUN: confirm the location on line 26. Urban Lodge has two.
-- ============================================================================

-- ---------------------------------------------------------------- 1. venue --
insert into venues (name, address, city, state, zip, map_url)
select
  'Urban Lodge Brewing',
  '47 Purnell Pl', 'Manchester', 'CT', '06040',
  'https://maps.google.com/?q=Urban+Lodge+Brewing+47+Purnell+Pl+Manchester+CT'
  -- Hartford location instead? Swap the two lines above for:
  --   '88 Pratt St', 'Hartford', 'CT', '06103',
  --   'https://maps.google.com/?q=Urban+Lodge+Brewing+88+Pratt+St+Hartford+CT'
where not exists (
  select 1 from venues where lower(name) = 'urban lodge brewing'
);

-- ------------------------------------------------------------- 2. workshop --
insert into workshops
  (slug, name, tagline, description, what_you_make, good_for,
   duration_minutes, base_price_cents, min_group, max_group,
   bar_friendly, sort_order, image_url)
select
  'mini-terrariums',
  'Build Your Own Mini Terrarium',
  'Build a tiny living world to take home.',
  E'Looking for a creative night out that doesn''t require an art degree or a Pinterest-perfect craft room? Join us for Build Your Own Mini Terrarium — a hands-on, beginner-friendly workshop where you''ll design and build a tiny living world to take home.\n\nWe''ll provide everything: a geometric glass vessel, a curated selection of succulents, soil, moss, stones, and all the little details that make your terrarium yours. No green thumb required. Just show up, grab a drink from Urban Lodge''s scratch kitchen and taproom, and settle in for a relaxed evening of making.\n\nThis is a come-as-you-are, make-something-cool kind of night. Perfect for a date night, a solo creative reset, or a catch-up with pals. You''ll leave with a thriving mini ecosystem, care instructions, and probably a few new friends.\n\nAll materials included.\nAges 16+\nCreativity looks better together.',
  'A finished mini terrarium with care instructions',
  '{"Date night","Beginner-friendly","Girls'' night","Solo creative reset"}',
  120, 3700, 1, 24, true, 180, '/images/terrarium.jpg'
where not exists (select 1 from workshops where slug = 'mini-terrariums');

-- ---------------------------------------------------------------- 3. event --
do $$
declare
  v_workshop uuid;
  v_venue    uuid;
  v_starts   timestamptz := timestamp '2026-09-22 18:00' at time zone 'America/New_York';
begin
  select id into v_workshop from workshops where slug = 'mini-terrariums';
  if v_workshop is null then
    raise exception 'Mini Terrariums workshop is missing — step 2 did not insert.';
  end if;

  select id into v_venue from venues where lower(name) = 'urban lodge brewing';
  if v_venue is null then
    raise exception 'Urban Lodge Brewing venue is missing — step 1 did not insert.';
  end if;

  if exists (select 1 from events
             where workshop_id = v_workshop and starts_at = v_starts) then
    raise notice 'Event already exists — nothing inserted.';
    return;
  end if;

  insert into events (
    slug, title, description, venue_id, workshop_id, starts_at, ends_at,
    capacity, min_to_run, price_cents, whats_included, what_to_bring,
    image_url, status
  )
  select
    'build-your-own-mini-terrarium-urban-lodge-2026-09-22',
    w.name, w.description, v_venue, v_workshop,
    v_starts,
    timestamp '2026-09-22 20:00' at time zone 'America/New_York',
    30, 8, 3700,
    'Geometric glass vessel, succulents, soil, moss, stones, and all materials included.',
    'Just yourself. Ages 16+.',
    '/images/terrarium.jpg',
    'published'
  from workshops w where w.id = v_workshop;

  raise notice 'Event created and published.';
end $$;

-- ----------------------------------------------------------- 4. verify it --
-- Expect exactly one row. If this returns nothing, the site will still be empty.
select e.slug, e.title, e.status, e.starts_at, e.capacity, e.price_cents,
       v.name as venue
from events e
join venues v on v.id = e.venue_id
where e.starts_at > now()
order by e.starts_at;
