# Images

Drop image files here. Anything in `public/` is served from the site root, so:

    public/images/candle-making.jpg   ->   /images/candle-making.jpg

## Naming

Name the file after what it is, lowercase with hyphens. The filename is used to
match the image to a workshop or event:

    ink-tiles.jpg
    candle-making.jpg
    canvas-collab-night.jpg
    hero.jpg                  <- home page hero background
    venue-room.jpg            <- the /venues page

## Wiring one up

Workshops and events both have an `image_url` column. Set it to the path:

    update workshops set image_url = '/images/candle-making.jpg'
    where slug = 'candle-making';

Anything without an image falls back to a generated neon placeholder, so a
missing photo never looks broken.

## Sizing

Landscape, roughly 3:2. 1600px wide is plenty. Keep files under ~400KB —
compress at squoosh.app if they're bigger.
