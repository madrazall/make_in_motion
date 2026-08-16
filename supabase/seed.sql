-- Sample data for local development. Do not run against production.

insert into venues (name, address, city, state, zip, map_url, contact_name, contact_email, notes)
values
  ('Stubborn Beauty Brewing', '180 Johnson St', 'Middletown', 'CT', '06457',
   'https://maps.google.com/?q=Stubborn+Beauty+Brewing+Middletown+CT',
   'Bar Manager', 'hello@example.com',
   'Long tables in the back room. Ask about the projector.'),
  ('Little House Brewing', '3 Sherman St', 'Chester', 'CT', '06412',
   'https://maps.google.com/?q=Little+House+Brewing+Chester+CT',
   'Events', 'events@example.com',
   'Smaller room — cap around 16.');

insert into events (
  slug, title, description, venue_id, starts_at, ends_at,
  capacity, min_to_run, price_cents, whats_included, what_to_bring,
  venue_payout_note, status
)
select
  'canvas-collab-night-middletown',
  'Canvas Collab Night',
  E'You''ll start a canvas, then rotate throughout the night—adding, layering, and transforming each piece along the way. No pressure, no perfection, just a fun, evolving process that ends in something completely unexpected.\n\nPerfect if you want to relax, get a little messy, and be part of something creative without overthinking it.',
  v.id,
  -- 5 weeks out, 7–9pm Eastern
  (date_trunc('day', now() at time zone 'America/New_York') + interval '35 days' + interval '19 hours')
    at time zone 'America/New_York',
  (date_trunc('day', now() at time zone 'America/New_York') + interval '35 days' + interval '21 hours')
    at time zone 'America/New_York',
  20, 6, 4500,
  'Art supplies & setup. Instruction & facilitation.',
  'Just yourself.',
  'No room fee — they keep all bar sales.',
  'published'
from venues v where v.name = 'Stubborn Beauty Brewing';

insert into events (
  slug, title, description, venue_id, starts_at, ends_at,
  capacity, min_to_run, price_cents, whats_included, what_to_bring, status
)
select
  'canvas-collab-night-chester',
  'Canvas Collab Night',
  E'You''ll start a canvas, then rotate throughout the night—adding, layering, and transforming each piece along the way. No pressure, no perfection, just a fun, evolving process that ends in something completely unexpected.\n\nPerfect if you want to relax, get a little messy, and be part of something creative without overthinking it.',
  v.id,
  (date_trunc('day', now() at time zone 'America/New_York') + interval '49 days' + interval '18 hours 30 minutes')
    at time zone 'America/New_York',
  (date_trunc('day', now() at time zone 'America/New_York') + interval '49 days' + interval '20 hours 30 minutes')
    at time zone 'America/New_York',
  16, 6, 4500,
  'Art supplies & setup. Instruction & facilitation.',
  'Just yourself.',
  'published'
from venues v where v.name = 'Little House Brewing';
