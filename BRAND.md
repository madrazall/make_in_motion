# Make In Motion — Brand Reference

Quick-copy version. The full guide with live specimens is **BRAND.html** — open that one
to actually see it. This file is for pasting values into Canva, a printer, or a form.

---

## The one-line version

A night out that happens to produce art — not an art class that happens to be at a bar.

Palette is nightlife. Type is a gig poster. Photos are people laughing, not finished canvases.

---

## Colour

| Name | Hex | RGB | Role |
|---|---|---|---|
| Midnight | `#08070F` | 8, 7, 15 | Background. Everywhere. Blue-black, never grey. |
| Surface | `#131120` | 19, 17, 32 | Cards and panels, usually at 80% opacity |
| Hot Pink | `#FF2E88` | 255, 46, 136 | Primary accent — actions, the thing to click |
| Electric Cyan | `#22E0FF` | 34, 224, 255 | Secondary accent — labels, info, positive states |
| Violet | `#A855F7` | 168, 85, 247 | Support only. Gradients and artwork, never text |
| Paper White | `#F4F1FA` | 244, 241, 250 | All body text. Faintly violet, not pure white |

**Lit versions** (for glowing text only): pink `#FF5BA3`, cyan `#7AEAFF`

**Proportions:** ~75% midnight, 15% white text, 10% neon. The neon only works because there's
so little of it.

**Pink = do something. Cyan = information.** Never pink and cyan directly against each other
as text and background — they vibrate.

### Contrast (WCAG 2.1, measured)

| Combination | Ratio | |
|---|---|---|
| White text on midnight | 17.95:1 | AAA |
| Cyan on midnight | 12.58:1 | AAA |
| Pink on midnight | 5.73:1 | AA |
| Midnight on pink | 5.73:1 | AA |
| Violet on midnight | 5.07:1 | AA |
| **White on pink** | **3.50:1** | **Large text only — avoid** |

> **Rule:** put midnight text on pink and cyan buttons, not white. Black-on-neon also happens
> to be the more authentic signage look.

---

## Type

All three are free on Google Fonts.

```
https://fonts.googleapis.com/css2?family=Anton&family=Yellowtail&family=Montserrat:wght@300;400;500;600;700;800&display=swap
```

| Job | Face | Weight | Rules |
|---|---|---|---|
| Display | **Anton** | 400 (only) | Always uppercase. Line-height .95–1.0. One sentence max. Never below 18px. |
| Accent | **Yellowtail** | 400 | One phrase per page. Pink or cyan only. Never below 24px. Never functional. |
| Body | **Montserrat** | 300–800 | Everything else. Body at 400/17px, line-height 1.65. |

**Signature move:** Montserrat uppercase at ~14px with `.14em` letter-spacing for spec lines
and labels. Never for paragraphs.

### Scale

| Role | Face | Size |
|---|---|---|
| Hero | Anton | 60–96px |
| Page title | Anton | 40–56px |
| Section head | Anton | 24–32px |
| Accent line | Yellowtail | 28–44px |
| Eyebrow / label | Montserrat 700 | 11–12px, .22em tracking, cyan |
| Body | Montserrat 400 | 15–17px |
| Button | Montserrat 800 | 15–16px uppercase, .04em |
| Fine print | Montserrat 400 | 12–13px at 62% white |

**Print substitutes** if Google Fonts aren't available: Anton → Oswald Bold or Bebas Neue.

---

## Wordmark

**Make in Motion** — capital M on Make and Motion, lowercase "in".
"Motion" carries the pink; "Make in" stays white. Don't swap.

- Clear space: one cap-height of the M on all sides
- Minimum 120px wide on screen, 25mm in print — below that, drop the glow
- One-colour version: all white on midnight, or all midnight on white. Never all pink.

---

## The neon rule

**Maximum two glowing elements per screen.** Body copy never glows.

The glow is three stacked shadows — 6px core, 22px bloom, 48px haze:

```css
color: #FF5BA3;
text-shadow: 0 0 6px rgba(255,46,136,.85),
             0 0 22px rgba(255,46,136,.5),
             0 0 48px rgba(255,46,136,.25);
```

Lit text is always a step *lighter* than the base colour — a real tube is brightest at its centre.

---

## Voice

Warm, plain-spoken, a little dry. A friend who organised something good and isn't overselling it.

**Yes:** "You'll surprise yourself." · "Wear something you don't mind getting paint on." ·
"Fill a slow Tuesday." · "Just bring yourself."

**No:** "Unleash your inner artist!" · "Curated artisanal experiences." · "Embark on a creative
journey." · Exclamation marks in body copy.

- Short sentences. Say the real thing.
- Lowercase "art night," never Title Case
- Never call it a class or the guests students
- Emoji: sparingly on social, never on the site or in email

---

## Photography

**Shoot:** people mid-laugh, wide tables with faces, warm interior light, drinks in frame,
hands in motion, slight mess.

**Don't:** finished canvases alone, empty tidy rooms, flash, anything classroom-like, stock
paintbrushes.

3:2 landscape, 1600px wide, under 400KB. Behind type: 38% opacity + dark scrim + pink/cyan wash.

---

## Never

- Light backgrounds on the site (email is the only exception — dark HTML email breaks in Outlook)
- Pastels — sage, dusty rose, beige, kraft. That's the craft-fair brand this one isn't.
- Glow on body copy
- Anton in a paragraph
- Yellowtail on buttons, labels, or form fields
- Rainbow gradients — two accents, violet supports
- Stretching or recolouring the wordmark

---

*v1.0 · August 2026. Colour values match `tailwind.config.ts` — update both together.*
