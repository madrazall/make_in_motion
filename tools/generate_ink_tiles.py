"""
Alcohol ink on white ceramic tile — rendered, not photographed.

Alcohol ink behaves in a specific way and the render has to respect it or it
reads as generic digital blur:
  - pigment gets pushed OUTWARD by the alcohol, so each bloom is pale in the
    middle with a concentrated darker rim
  - edges are feathered and irregular, never circular
  - overlapping blooms multiply into deeper tones
  - the tile is glossy, so there's a broad soft highlight over everything
"""
import numpy as np
from PIL import Image, ImageFilter

rng = np.random.default_rng(7)
S = 1024  # per-tile working resolution


def fractal_noise(size, octaves=5, base=4):
    """Value noise: random grids upscaled and summed. Cheap, looks organic."""
    out = np.zeros((size, size), np.float32)
    amp, total = 1.0, 0.0
    for o in range(octaves):
        res = base * 2 ** o
        g = rng.random((res, res)).astype(np.float32)
        img = Image.fromarray((g * 255).astype(np.uint8)).resize((size, size), Image.BICUBIC)
        out += np.asarray(img, np.float32) / 255.0 * amp
        total += amp
        amp *= 0.5
    return out / total


def bloom(size, cx, cy, radius, warp_strength=0.45):
    """One ink drop. Returns (coverage, rim) in 0..1."""
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    xx = (xx - cx) / radius
    yy = (yy - cy) / radius
    r = np.sqrt(xx ** 2 + yy ** 2)

    # Warp the radius with noise so the edge is ragged, not circular.
    n = fractal_noise(size, octaves=5, base=3)
    n = (n - n.mean()) / (n.std() + 1e-6)
    r = r * (1.0 + warp_strength * n * 0.35)

    # Fine dendrites reaching past the main edge.
    d = fractal_noise(size, octaves=6, base=12)
    d = (d - d.mean()) / (d.std() + 1e-6)
    r = r + d * 0.10

    inside = np.clip(1.0 - r, 0.0, 1.0)
    coverage = inside ** 0.55                      # pale, translucent centre
    rim = np.exp(-((r - 0.86) ** 2) / (2 * 0.075 ** 2))  # pigment piled at edge
    rim *= (r < 1.25)
    return np.clip(coverage, 0, 1), np.clip(rim, 0, 1)


def render_tile(palette, n_drops=4, seed_shift=0):
    global rng
    rng = np.random.default_rng(7 + seed_shift * 31)

    # Warm-white glazed ceramic, very slightly uneven.
    base = np.ones((S, S, 3), np.float32) * np.array([0.985, 0.980, 0.972], np.float32)
    base *= (0.985 + 0.03 * fractal_noise(S, 4, 2))[..., None]

    for i in range(n_drops):
        col = np.array(palette[i % len(palette)], np.float32) / 255.0
        cx = rng.uniform(0.24, 0.76) * S
        cy = rng.uniform(0.24, 0.76) * S
        rad = rng.uniform(0.17, 0.30) * S

        cov, rim = bloom(S, cx, cy, rad)
        a = np.clip(cov * 0.40 + rim * 0.72, 0, 1)[..., None]

        # Multiply blend: overlaps deepen the way real ink layers do.
        ink = col[None, None, :]
        base = base * (1 - a) + (base * ink) * a
        # Concentrated rim gets an extra hit of saturated pigment.
        base = base * (1 - (rim[..., None] * 0.38)) + ink * 0.9 * (rim[..., None] * 0.38)

    # A few gold veins — standard in alcohol ink work, and it catches the eye.
    gold = np.array([0.80, 0.64, 0.28], np.float32)
    for _ in range(2):
        cov, rim = bloom(S, rng.uniform(0.28, 0.72) * S, rng.uniform(0.28, 0.72) * S,
                         rng.uniform(0.13, 0.24) * S, warp_strength=1.2)
        # Thin the rim to a hairline and break it up so it pools rather than draws.
        g = np.clip((rim - 0.55) / 0.45, 0, 1)
        g *= fractal_noise(S, 5, 10) ** 1.6 * 2.2
        g = np.clip(g, 0, 1)[..., None] * 0.85
        base = base * (1 - g) + gold[None, None, :] * g

    # Glaze: broad specular sheen across the upper left.
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32) / S
    sheen = np.exp(-(((xx - 0.28) ** 2 + (yy - 0.22) ** 2) / 0.30)) * 0.16
    base = np.clip(base + sheen[..., None], 0, 1)

    img = Image.fromarray((np.clip(base, 0, 1) * 255).astype(np.uint8))
    return img.filter(ImageFilter.GaussianBlur(0.6))


PALETTES = [
    [(214, 30, 110), (120, 40, 190), (30, 190, 220)],   # pink / violet / cyan
    [(30, 170, 225), (20, 80, 190), (150, 40, 170)],    # blues
    [(235, 70, 60), (240, 150, 40), (200, 30, 120)],    # warm
    [(20, 190, 190), (60, 120, 210), (190, 40, 150)],   # teal / pink
    [(150, 40, 200), (215, 35, 120), (40, 160, 210)],   # violet led
]

tiles = [render_tile(PALETTES[i], n_drops=4, seed_shift=i) for i in range(5)]
for i, t in enumerate(tiles):
    t.save(f"/tmp/tile_{i}.png")
print("tiles rendered")
