-- Workshops catalog.
--
-- A workshop is the ACTIVITY ("Candle Making"). An event is one INSTANCE of a
-- workshop at a venue on a date. Separating them means the menu page can list
-- 17 things you offer while only 4 are currently on sale — and creating a new
-- event becomes "pick workshop + venue + date" instead of retyping copy.

create table workshops (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  name             text not null,
  tagline          text not null default '',
  description      text not null default '',
  what_you_make    text not null default '',

  -- Occasion tags, used for filtering on the menu page.
  good_for         text[] not null default '{}',

  duration_minutes integer not null default 120,
  -- Indicative "from" pricing for the menu. Actual price is set per event.
  base_price_cents integer not null default 4500,

  min_group        integer not null default 6,
  max_group        integer not null default 24,

  -- Low-mess activities a bar manager will say yes to more easily.
  bar_friendly     boolean not null default true,

  image_url        text,
  active           boolean not null default true,
  sort_order       integer not null default 100,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger workshops_touch before update on workshops
  for each row execute function touch_updated_at();

create index workshops_active_idx on workshops (sort_order, name) where active;

-- An event may be an instance of a catalog workshop. Nullable so one-off
-- experiments don't need a catalog entry first.
alter table events add column workshop_id uuid references workshops(id) on delete set null;
create index events_workshop_idx on events (workshop_id);

-- Inquiries now come from two audiences with different needs.
alter table private_inquiries
  add column inquiry_type text not null default 'private'
    check (inquiry_type in ('private', 'venue')),
  add column workshop_interest text,
  add column venue_name text;

comment on column private_inquiries.inquiry_type is
  'private = a guest booking a group. venue = a bar/restaurant wanting to host.';

alter table workshops enable row level security;
create policy workshops_public_read on workshops
  for select using (active);

-- ---------------------------------------------------------------------------
-- The catalog
-- ---------------------------------------------------------------------------

insert into workshops
  (slug, name, tagline, description, what_you_make, good_for,
   duration_minutes, base_price_cents, min_group, max_group, bar_friendly, sort_order)
values

('canvas-collab-night', 'Canvas Collab Night',
 'Everyone paints everyone else''s canvas.',
 E'You''ll start a canvas, then rotate throughout the night—adding, layering, and transforming each piece along the way. No pressure, no perfection, just a fun, evolving process that ends in something completely unexpected.\n\nPerfect if you want to relax, get a little messy, and be part of something creative without overthinking it.',
 'A collaborative canvas nobody could have made alone',
 '{"Girls'' night","Team building","Date night","Beginner-friendly"}',
 120, 4500, 6, 24, true, 10),

('classic-canvas', 'Classic Canvas',
 'One painting, step by step, at your own pace.',
 E'The one everybody pictures when they hear "paint night." We pick the image, break it into steps, and walk the whole room through it together.\n\nYou''ll surprise yourself. People who swear they can''t draw leave with something they actually hang up.',
 'A finished 11x14 canvas to take home',
 '{"Date night","Girls'' night","Birthday","Beginner-friendly"}',
 120, 4500, 6, 30, true, 20),

('ink-tiles', 'Ink Tiles',
 'Alcohol ink on ceramic. Impossible to do badly.',
 E'Alcohol ink moves on its own—you drop it, tilt it, blow it around, and it blooms into something you couldn''t have planned. Every tile comes out different and every one looks good.\n\nThe lowest-pressure thing we do. Great for people who are nervous about "being creative."',
 'Two finished ceramic tiles, sealed and ready to display',
 '{"Beginner-friendly","Date night","Team building","Girls'' night"}',
 90, 4000, 6, 28, true, 30),

('paint-pour', 'Paint Pour',
 'Controlled chaos. Wildly satisfying.',
 E'Layer the paint, tip the canvas, and watch cells bloom across the surface. It''s part chemistry, part gravity, and completely mesmerizing.\n\nMessier than most—we bring the drop cloths—and worth it.',
 'A poured canvas plus the video everyone takes of it happening',
 '{"Girls'' night","Birthday","Beginner-friendly"}',
 120, 5000, 6, 20, false, 40),

('glassware-painting', 'Beer Mug & Wine Glass Painting',
 'Paint the thing you''re drinking out of.',
 E'Pick a mug or a stemless wine glass and make it yours. We use enamel that bakes on and survives the dishwasher, so this one actually gets used instead of living in a cabinet.\n\nThe most natural fit for a brewery night—people are already holding a glass.',
 'A dishwasher-safe glass or mug you''ll actually use',
 '{"Date night","Birthday","Girls'' night","Beginner-friendly"}',
 120, 4500, 6, 26, true, 50),

('yeti-personalization', 'Tumbler Personalization',
 'Make your Yeti unmistakably yours.',
 E'Vinyl, monograms, and designs applied to insulated tumblers. Bring your own or use one of ours.\n\nPopular with teams and anyone who has lost a tumbler to a shared office kitchen.',
 'A personalized insulated tumbler',
 '{"Team building","Birthday","Guys'' night"}',
 90, 5500, 6, 24, true, 60),

('candle-making', 'Candle Making',
 'Pick your scent, pour your own.',
 E'Blend from a tray of fragrance oils until you land on something that''s yours, then pour it into a vessel you choose. We''ll talk you through what layers well and what fights.\n\nThe room smells incredible for the entire two hours, which venues tend to like.',
 'A poured candle in a reusable vessel',
 '{"Girls'' night","Date night","Baby shower","Bachelorette"}',
 120, 5000, 6, 24, true, 70),

('tie-dye', 'Tie Dye',
 'Not the summer camp version.',
 E'Ice dye, reverse dye, and folding patterns that come out looking deliberate. Bring a shirt or use one of ours.\n\nBest outdoors or in a space that doesn''t mind color. We handle containment either way.',
 'A dyed shirt or tote, wrapped to set overnight',
 '{"Team building","Birthday","Girls'' night","Beginner-friendly"}',
 120, 4000, 8, 30, false, 80),

('wreaths', 'Wreath Making',
 'Seasonal, and better than the store-bought one.',
 E'Build a wreath on a real frame with materials that suit the season—dried florals, eucalyptus, ribbon, whatever the month calls for.\n\nRuns bigger than most of our workshops because people bring their mothers.',
 'A finished wreath for your door',
 '{"Seasonal","Girls'' night","Birthday"}',
 120, 6000, 6, 22, true, 90),

('door-signs', 'Door Signs',
 'Wood, paint, and something to say.',
 E'Stencil and paint a wooden sign for a front door or entryway. Seasonal designs or your own words.\n\nAnother one that scales well and photographs nicely.',
 'A painted wooden door sign',
 '{"Seasonal","Girls'' night","Birthday"}',
 120, 5500, 6, 22, true, 100),

('coasters', 'Coasters',
 'Small project, big payoff.',
 E'Resin, ink, or tile coasters in a set of four. Short enough to finish comfortably in an evening and useful enough that people keep them.\n\nGood entry point if a venue wants to test a shorter format.',
 'A set of four finished coasters',
 '{"Beginner-friendly","Date night","Team building"}',
 90, 3500, 6, 28, true, 110),

('jewelry-bar', 'Jewelry Bar',
 'Build it from a table of parts.',
 E'Beads, charms, chain, and clasps laid out bar-style. You browse, pick, and we help you assemble. No two people make the same thing.\n\nFormat works well as a drop-in, which suits a venue that wants foot traffic across a whole evening rather than a fixed start time.',
 'A necklace, bracelet, or pair of earrings',
 '{"Girls'' night","Bachelorette","Birthday","Beginner-friendly"}',
 90, 4500, 6, 30, true, 120),

('vision-boards', 'Vision Boards',
 'January energy, any month.',
 E'Magazines, prompts, and a board. We give it enough structure that it doesn''t stall out—prompts to work from, and time to actually talk about what people put down.\n\nQuieter and more reflective than our other nights. Groups tend to stay late.',
 'A finished vision board',
 '{"Girls'' night","Team building","Seasonal","Beginner-friendly"}',
 120, 4000, 6, 24, true, 130),

('coffee-filter-flowers', 'Coffee Filter Flowers',
 'Cheap materials, absurdly pretty results.',
 E'Dyed coffee filters become peonies, roses, and things that look nothing like coffee filters. The reveal when the first one opens up gets a reaction every time.\n\nAlmost no mess, which makes it easy for a venue to say yes to.',
 'A small bouquet of paper flowers',
 '{"Baby shower","Girls'' night","Beginner-friendly","Seasonal"}',
 90, 3500, 6, 28, true, 140),

('onesie-decorating', 'Onesie Decorating',
 'The baby shower activity that isn''t a game.',
 E'Guests decorate onesies for the baby with fabric paint, stencils, and iron-on vinyl. The parents leave with a dozen one-of-a-kind pieces instead of another set of clothes from a registry.\n\nWorks alongside food and drinks rather than interrupting them.',
 'Decorated onesies for the guest of honor',
 '{"Baby shower","Beginner-friendly"}',
 90, 4000, 6, 24, true, 150),

('garter-making', 'Garter Making',
 'Bachelorette, handled.',
 E'Lace, ribbon, and trim to build a garter for the bride—plus whatever the group decides to make for themselves. Runs loud and it should.\n\nPairs well with a bar tab.',
 'A handmade garter, plus whatever else the group gets up to',
 '{"Bachelorette","Girls'' night"}',
 90, 4500, 6, 20, true, 160),

('cornhole-boards', 'Cornhole Board Painting',
 'For the group that says they''re not crafty.',
 E'Paint a set of cornhole boards—team logos, custom designs, whatever the group wants. Then play on them.\n\nBuilt for the crowd that wouldn''t sign up for a paint night. Longer session and it needs floor space.',
 'A painted cornhole set for the group',
 '{"Guys'' night","Team building","Birthday"}',
 180, 7500, 4, 16, false, 170);
