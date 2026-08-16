/**
 * Every business constant in one place. Change it here, nowhere else.
 */

export const BUSINESS = {
  name: "Make In Motion",
  email: "makeinmotionct@gmail.com",
  phone: "860-348-7466",
  phoneHref: "tel:+18603487466",
  domain: "makeinmotion.com",
} as const;

/** Homepage "about" section and venue-pitch copy. One place to change it. */
export const ABOUT_TEXT = [
  "Make in Motion is a pop-up creative workshop experience built around one simple idea: making things is more fun when you actually get to make them.",
  "We bring hands-on, guided creative projects to breweries, community spaces, private events, and other unexpected places. Each workshop is designed around a specific project, with the materials, instructions, and creative direction provided, so guests can show up, get comfortable, and start creating without needing an art degree or a perfectly organized craft room.",
  "From painting and mixed-media projects to jewelry, textiles, terrariums, and whatever comes next, Make in Motion is about getting people out of their heads and into the process. Pick a project. Grab some supplies. Make something.",
] as const;

/** All display times render in this zone. Stored values are always UTC. */
export const TIMEZONE = "America/New_York";

/** Matches Stripe Checkout's 30-minute minimum session expiry. Don't lower it. */
export const HOLD_MINUTES = 30;

/** Plan §13. Also enforced by a CHECK constraint on orders.seats. */
export const MAX_SEATS_PER_ORDER = 8;

/** Default floor to run an event; editable per event. Plan §18. */
export const DEFAULT_MIN_TO_RUN = 6;

/** Blanket, every event. Plan §18. */
export const AGE_RESTRICTION = "21+";

/**
 * How people pay, right now.
 *
 *   "manual" — Venmo / CashApp, then an email to get on the list. You confirm
 *              each one by hand and mark it paid in the admin.
 *   "stripe" — card checkout on the site, seats held automatically.
 *
 * FLIPPING THIS IS THE ONLY CHANGE NEEDED. All the Stripe machinery stays
 * built and tested underneath; it just isn't the path guests take yet.
 * Set NEXT_PUBLIC_PAYMENT_MODE=stripe, or edit the fallback below.
 */
export const PAYMENT_MODE: "manual" | "stripe" =
  (process.env.NEXT_PUBLIC_PAYMENT_MODE as "manual" | "stripe") ?? "manual";

/**
 * ⚠️ ONE PLACE TO CHANGE. Instagram, Venmo and CashApp are all the same handle.
 *
 * This is still a PLACEHOLDER — confirm the real one before anyone sees the
 * site. A wrong handle here sends customers' money to a stranger.
 *
 * Note: use a Venmo BUSINESS profile. Venmo prohibits business transactions on
 * personal accounts and enforces it by freezing the balance.
 */
export const HANDLE = "makeinmotionct";

/** Override individually only if one platform ever differs. */
export const PAYMENT_HANDLES = {
  venmo: HANDLE,
  cashapp: HANDLE,
  instagram: HANDLE,
} as const;

export const venmoUrl = () => `https://venmo.com/u/${PAYMENT_HANDLES.venmo}`;
export const cashAppUrl = () => `https://cash.app/$${PAYMENT_HANDLES.cashapp}`;
export const instagramUrl = () =>
  `https://instagram.com/${PAYMENT_HANDLES.instagram}`;

export const siteUrl = () =>
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. See .env.example.`
    );
  }
  return value;
}
