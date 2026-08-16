"""Lay the four finished tiles out on a dark surface, lit like the rest of the site."""
import numpy as np
from PIL import Image, ImageFilter, ImageDraw

W, H = 1600, 1067
rng = np.random.default_rng(3)

# --- surface: dark table with a soft pink/cyan wash, matching the site ------
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
u, v = xx / W, yy / H

base = np.zeros((H, W, 3), np.float32)
base[..., 0] = 0.055; base[..., 1] = 0.048; base[..., 2] = 0.075

cyan = np.exp(-(((u - 0.02) ** 2) / 0.20 + ((v - 0.15) ** 2) / 0.55))
pink = np.exp(-(((u - 1.00) ** 2) / 0.22 + ((v - 0.80) ** 2) / 0.55))
base[..., 0] += pink * 0.34 + cyan * 0.02
base[..., 1] += pink * 0.06 + cyan * 0.30
base[..., 2] += pink * 0.20 + cyan * 0.40

# grain so the dark area isn't flat
grain = rng.normal(0, 0.012, (H, W, 1)).astype(np.float32)
base = np.clip(base + grain, 0, 1)

surface = Image.fromarray((base * 255).astype(np.uint8))

# --- place the tiles --------------------------------------------------------
TILE = 430
positions = [(115, 80), (595, 135), (1075, 80), (350, 565), (835, 600)]
angles = [-4.5, 3.0, -2.0, 5.5, -3.5]

canvas = surface.convert("RGBA")

for i, ((x, y), ang) in enumerate(zip(positions, angles)):
    t = Image.open(f"/tmp/tile_{i}.png").convert("RGBA").resize((TILE, TILE), Image.LANCZOS)

    # soft bevel: darken the outer 6px so the tile has an edge
    d = ImageDraw.Draw(t)
    for k in range(6):
        shade = int(255 * (0.55 + k * 0.075))
        d.rectangle([k, k, TILE - 1 - k, TILE - 1 - k], outline=(shade, shade, shade, 255))

    t = t.rotate(ang, resample=Image.BICUBIC, expand=True)

    # drop shadow
    sh = Image.new("RGBA", t.size, (0, 0, 0, 0))
    sh.paste((0, 0, 0, 190), (0, 0), t.split()[3])
    sh = sh.filter(ImageFilter.GaussianBlur(22))
    canvas.alpha_composite(sh, (x + 10, y + 20))
    canvas.alpha_composite(t, (x, y))

out = canvas.convert("RGB")

# --- final grade: vignette + gentle gloss across the whole scene ------------
arr = np.asarray(out, np.float32) / 255.0
vig = 1.0 - 0.42 * (((u - 0.5) ** 2 + (v - 0.5) ** 2) / 0.5)
arr *= np.clip(vig, 0, 1)[..., None]
sheen = np.exp(-(((u - 0.30) ** 2) / 0.55 + ((v - 0.10) ** 2) / 0.30)) * 0.06
arr = np.clip(arr + sheen[..., None], 0, 1)

Image.fromarray((arr * 255).astype(np.uint8)).save(
    "/tmp/ink-tiles.jpg", "JPEG", quality=86, optimize=True, progressive=True)
print("composed")
