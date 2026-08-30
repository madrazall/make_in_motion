-- ============================================================================
-- Create: Build Your Own Mini Terrarium
-- Urban Lodge Brewing, Manchester · Tue Sept 22 2026 · 6–8pm · $37 · 30 seats
--
-- Creates the event as a DRAFT. It will NOT appear on the site and cannot be
-- bought until you flip it to 'published' (last line of this file, commented
-- out) — do that only once you've seen a real confirmation email arrive.
--
-- Safe to run twice. Unlike migration 0012, this RAISES if a prerequisite is
-- missing instead of silently inserting nothing.
-- ============================================================================

-- ------------------------------------------------- 1. venue (if not there) --
insert into venues (name, address, city, state, zip, map_url)
select
  'Urban Lodge Brewing', '47 Purnell Pl', 'Manchester', 'CT', '06040',
  'https://maps.google.com/?q=Urban+Lodge+Brewing+47+Purnell+Pl+Manchester+CT'
where not exists (
  select 1 from venues where lower(name) = 'urban lodge brewing'
);

-- ---------------------------------------------- 2. workshop (if not there) --
insert into workshops
  (slug, name, tagline, description, what_you_make, good_for,
   duration_minutes, base_price_cents, min_group, max_group,
   bar_friendly, sort_order, image_url)
select
  'mini-terrariums',
  'Build Your Own Mini Terrarium',
  'Build a tiny living world to take home.',
  E'Looking for a creative night out that doesn''t require an art degree or a Pinterest-perfect craft room? Join us for Build Your Own Mini Terrarium — a hands-on, beginner-friendly workshop where you''ll design and build a tiny living world to take home.\n\nWe''ll provide everything: a geometric glass vessel, a curated selection of succulents, soil, moss, stones, and all the little details that make your terrarium yours. No green thumb required. Just show up, grab a drink from Urban Lodge''s scratch kitchen and taproom, and settle in for a relaxed evening of making.\n\nThis is a come-as-you-are, make-something-cool kind of night. Perfect for a date night, a solo creative reset, or a catch-up with pals. You''ll leave with a thriving mini ecosystem, care instructions, and probably a few new friends.\n\nAll materials included.\nCreativity looks better together.',
  'A finished mini terrarium with care instructions',
  '{"Date night","Beginner-friendly","Girls'' night","Solo creative reset"}',
  120, 3700, 1, 24, true, 180, '/images/terrarium-photo.jpg'
where not exists (select 1 from workshops where slug = 'mini-terrariums');

-- ---------------------------------------------------------- 3. the event --
do $$
declare
  v_workshop uuid;
  v_venue    uuid;
  v_starts   timestamptz := timestamp '2026-09-22 18:00' at time zone 'America/New_York';
  v_ends     timestamptz := timestamp '2026-09-22 20:00' at time zone 'America/New_York';
  v_slug     text := 'build-your-own-mini-terrarium-urban-lodge-2026-09-22';
begin
  select id into v_workshop from workshops where slug = 'mini-terrariums';
  if v_workshop is null then
    raise exception 'Mini Terrariums workshop missing — step 2 inserted nothing.';
  end if;

  select id into v_venue from venues where lower(name) = 'urban lodge brewing';
  if v_venue is null then
    raise exception 'Urban Lodge Brewing venue missing — step 1 inserted nothing.';
  end if;

  if exists (select 1 from events where slug = v_slug) then
    raise notice 'Event already exists (%). Nothing inserted.', v_slug;
    return;
  end if;

  insert into events (
    slug, title, description, venue_id, workshop_id, starts_at, ends_at,
    capacity, min_to_run, price_cents, whats_included, what_to_bring,
    image_url, status
  )
  select
    v_slug,
    w.name,
    w.description,
    v_venue,
    v_workshop,
    v_starts,
    v_ends,
    30,     -- capacity
    8,      -- min_to_run: below this at T-3 days it gets flagged
    3700,   -- $37.00
    'Geometric glass vessel, succulents, soil, moss, stones, and every material you need — plus a drink chip to use at the bar. Beer, cocktail, or a mocktail if you are not drinking.',
    'Just yourself. 21+ with valid ID. Wear something you don''t mind getting messy.',
    '/images/terrarium-photo.jpg',
    'draft'
  from workshops w where w.id = v_workshop;

  raise notice 'Event created as DRAFT. Publish it when you are ready.';
end $$;

-- --------------------------------------------------------- 4. verify it --
-- Expect one row, status = draft.
select e.slug, e.title, e.status, e.starts_at, e.ends_at,
       e.capacity, e.min_to_run, e.price_cents, v.name as venue
from events e
join venues v on v.id = e.venue_id
where e.slug = 'build-your-own-mini-terrarium-urban-lodge-2026-09-22';

-- ------------------------------------------------- 5. GO LIVE (later) --
-- Run this ONLY after a test purchase has produced: order marked paid,
-- ticket rows minted, guest list populated, confirmation email received.
--
-- update events set status = 'published'
-- where slug = 'build-your-own-mini-terrarium-urban-lodge-2026-09-22';
