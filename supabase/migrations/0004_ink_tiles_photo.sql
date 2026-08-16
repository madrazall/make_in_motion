-- Placeholder artwork for Ink Tiles.
--
-- This one is RENDERED, not photographed (tools/generate_ink_tiles.py).
-- It's honest about what the workshop produces, but swap it for a real photo
-- after the first Ink Tiles night — actual guest work always beats a render.

update workshops set image_url = '/images/ink-tiles.jpg' where slug = 'ink-tiles';

update events e
   set image_url = w.image_url
  from workshops w
 where e.image_url is null
   and w.image_url is not null
   and (e.workshop_id = w.id or e.title = w.name);
