-- Add the Mini Terrariums workshop to an existing database.
insert into workshops
  (slug, name, tagline, description, what_you_make, good_for,
   duration_minutes, base_price_cents, min_group, max_group, bar_friendly, sort_order, image_url)
select
  'mini-terrariums',
  'Build Your Own Mini Terrarium',
  'Build a tiny living world to take home.',
  E'Looking for a creative night out that doesn''t require an art degree or a Pinterest-perfect craft room? Join us for Build Your Own Mini Terrarium — a hands-on, beginner-friendly workshop where you''ll design and build a tiny living world to take home.\n\nWe''ll provide everything: a geometric glass vessel, a curated selection of succulents, soil, moss, stones, and all the little details that make your terrarium yours. No green thumb required. Just show up, grab a drink from Urban Lodge''s scratch kitchen and taproom, and settle in for a relaxed evening of making.\n\nThis is a come-as-you-are, make-something-cool kind of night. Perfect for a date night, a solo creative reset, or a catch-up with pals. You''ll leave with a thriving mini ecosystem, care instructions, and probably a few new friends.\n\nAll materials included.\nAges 16+\nCreativity looks better together.',
  'A finished mini terrarium with care instructions',
  '{"Date night","Beginner-friendly","Girls'' night","Solo creative reset"}',
  120, 3700, 1, 24, true, 180, '/images/terrarium.jpg'
where not exists (select 1 from workshops where slug = 'mini-terrariums');