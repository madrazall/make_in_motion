-- Attach the first real photos.
--
-- Paths are relative to the site root: files live in public/images/ and are
-- served at /images/<name>. Anything left null falls back to the generated
-- neon placeholder, so a half-photographed catalog still looks deliberate.

update workshops set image_url = '/images/paint-and-sip.jpg' where slug = 'classic-canvas';
update workshops set image_url = '/images/jewelry-bar.jpg'   where slug = 'jewelry-bar';
update workshops set image_url = '/images/tie-dye.jpg'       where slug = 'tie-dye';

-- Canvas Collab Night is the flagship and currently has no photo of its own.
-- The paint-and-sip shot is close enough in feel to carry it until there is one.
update workshops set image_url = '/images/paint-and-sip.jpg' where slug = 'canvas-collab-night';

-- Existing published events inherit their workshop's photo where they don't
-- already have one of their own.
update events e
   set image_url = w.image_url
  from workshops w
 where e.image_url is null
   and w.image_url is not null
   and (e.workshop_id = w.id or e.title = w.name);
