-- Seven more workshop images.
--
-- These are AI-generated, not photographs of real Make In Motion events.
-- They're a strong placeholder set — swap each one for a real photo as you
-- run that workshop. See BRAND.html §07 for what to shoot.

update workshops set image_url = '/images/candle-making.jpg'         where slug = 'candle-making';
update workshops set image_url = '/images/paint-pour.jpg'            where slug = 'paint-pour';
update workshops set image_url = '/images/coasters.jpg'              where slug = 'coasters';
update workshops set image_url = '/images/coffee-filter-flowers.jpg' where slug = 'coffee-filter-flowers';
update workshops set image_url = '/images/onesie-decorating.jpg'     where slug = 'onesie-decorating';
update workshops set image_url = '/images/garter-making.jpg'         where slug = 'garter-making';

-- Ink Tiles now has a proper image of alcohol ink on white tile, replacing
-- the procedural render from 0004. tools/generate_ink_tiles.py still works if
-- you ever want generated variations for social.
update workshops set image_url = '/images/ink-tiles.jpg' where slug = 'ink-tiles';

-- Events inherit their workshop's photo when they don't have one.
update events e
   set image_url = w.image_url
  from workshops w
 where e.image_url is null
   and w.image_url is not null
   and (e.workshop_id = w.id or e.title = w.name);

-- 11 of 17 workshops now have artwork. The 6 still bare:
--   glassware-painting, yeti-personalization, wreaths,
--   door-signs, vision-boards, cornhole-boards
-- They fall back to the generated neon placeholder, which is fine.
