import type { EventWithAvailability, OrderRow, Venue } from "./types";

/**
 * Demo mode — the whole app runs with no database.
 *
 * Turns on automatically when Supabase isn't configured, so `npm run dev` works
 * on a fresh clone. Force it either way with NEXT_PUBLIC_DEMO_MODE=1 or 0.
 *
 * The fixtures deliberately cover every UI state at once: plenty of spots,
 * nearly gone, sold out (waitlist form), and underbooked (admin alert). That
 * way looking at the site shows you all the edges, not just the happy path.
 */
export function isDemoMode(): boolean {
  const flag = process.env.NEXT_PUBLIC_DEMO_MODE;
  if (flag === "1" || flag === "true") return true;
  if (flag === "0" || flag === "false") return false;
  return !process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith("https://");
}

/** Days from now at a given Eastern-ish hour, as an ISO string. */
function daysOut(days: number, hour: number, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

const STUBBORN: Venue = {
  id: "venue-1",
  name: "Stubborn Beauty Brewing",
  address: "180 Johnson St",
  city: "Middletown",
  state: "CT",
  zip: "06457",
  map_url: "https://maps.google.com/?q=Stubborn+Beauty+Brewing+Middletown+CT",
  contact_name: "Bar Manager",
  contact_email: "hello@example.com",
  contact_phone: "860-555-0143",
  notes: "Long tables in the back room.",
};

const LITTLE_HOUSE: Venue = {
  id: "venue-2",
  name: "Little House Brewing",
  address: "3 Sherman St",
  city: "Chester",
  state: "CT",
  zip: "06412",
  map_url: "https://maps.google.com/?q=Little+House+Brewing+Chester+CT",
  contact_name: "Events",
  contact_email: "events@example.com",
  contact_phone: "860-555-0177",
  notes: "Smaller room — cap around 16.",
};

const DESCRIPTION = `You'll start a canvas, then rotate throughout the night—adding, layering, and transforming each piece along the way. No pressure, no perfection, just a fun, evolving process that ends in something completely unexpected.

Perfect if you want to relax, get a little messy, and be part of something creative without overthinking it.`;

function makeEvent(
  overrides: Partial<EventWithAvailability> & {
    id: string;
    slug: string;
    venue: Venue;
    capacity: number;
    seatsTaken: number;
  }
): EventWithAvailability {
  const spotsLeft = Math.max(overrides.capacity - overrides.seatsTaken, 0);
  return {
    title: "Canvas Collab Night",
    description: DESCRIPTION,
    image_url: null,
    venue_id: overrides.venue.id,
    starts_at: daysOut(30, 19),
    ends_at: daysOut(30, 21),
    min_to_run: 6,
    price_cents: 4500,
    whats_included: "Art supplies & setup. Instruction & facilitation.",
    what_to_bring: "Just yourself.",
    venue_payout_note: "No room fee — they keep all bar sales.",
    status: "published",
    ...overrides,
    spotsLeft,
    soldOut: spotsLeft === 0,
  } as EventWithAvailability;
}

export const DEMO_EVENTS: EventWithAvailability[] = [
  // Underbooked and close — triggers the admin "decide now" alert.
  makeEvent({
    id: "demo-1",
    slug: "canvas-collab-night-middletown-sep",
    image_url: "/images/paint-and-sip.jpg",
    venue: STUBBORN,
    capacity: 20,
    seatsTaken: 4,
    starts_at: daysOut(2, 19),
    ends_at: daysOut(2, 21),
  }),
  // Nearly gone — shows the orange "Almost full" badge.
  makeEvent({
    id: "demo-2",
    slug: "canvas-collab-night-chester",
    image_url: "/images/paint-and-sip.jpg",
    venue: LITTLE_HOUSE,
    capacity: 16,
    seatsTaken: 14,
    starts_at: daysOut(12, 18, 30),
    ends_at: daysOut(12, 20, 30),
    price_cents: 4000,
  }),
  // Sold out — event page shows the waitlist form instead of the picker.
  makeEvent({
    id: "demo-3",
    slug: "canvas-collab-night-sold-out",
    title: "Canvas Collab Night — Fall Edition",
    venue: STUBBORN,
    capacity: 18,
    seatsTaken: 18,
    starts_at: daysOut(19, 19),
    ends_at: daysOut(19, 21),
  }),
  // Healthy — the normal case.
  makeEvent({
    id: "demo-4",
    slug: "canvas-collab-night-october",
    venue: LITTLE_HOUSE,
    capacity: 16,
    seatsTaken: 3,
    starts_at: daysOut(34, 19),
    ends_at: daysOut(34, 21),
    price_cents: 5000,
  }),
];

export const DEMO_ORDERS: OrderRow[] = [
  ["Dana Whitfield", "dana.w@example.com", "860-555-0111", 2, true],
  ["Marcus Reyes", "mreyes@example.com", "860-555-0122", 1, true],
  ["Priya Raman", "priya.r@example.com", null, 4, false],
  ["Tom Ostrowski", "tomo@example.com", "203-555-0198", 2, false],
  ["Jess Calloway", "jess.c@example.com", null, 2, false],
  ["Ben Iyer", "ben.iyer@example.com", "860-555-0166", 3, false],
].map(([name, email, phone, seats, checkedIn], i) => ({
  id: `demo-order-${i}`,
  confirmation_code: `MIM-${["K7XQ2M", "P4NR9T", "B8WZ3F", "H2VD6K", "R9TY4Q", "M3XJ7B"][i]}`,
  event_id: "demo-2",
  customer_name: name as string,
  email: email as string,
  phone: phone as string | null,
  seats: seats as number,
  amount_cents: (seats as number) * 4000,
  status: "paid" as const,
  stripe_session_id: `cs_test_demo_${i}`,
  stripe_payment_intent_id: `pi_test_demo_${i}`,
  hold_expires_at: null,
  paid_at: daysOut(-3 - i, 14),
  policy_accepted_at: daysOut(-3 - i, 14),
  policy_version: "1.0",
  refund_cents: 0,
  refunded_at: null,
  checked_in_at: checkedIn ? daysOut(-1, 19) : null,
  payment_method: "stripe" as const,
  notes: null,
  created_at: daysOut(-3 - i, 14),
}));

export const DEMO_WAITLIST = [
  { id: "w1", name: "Alex Moreau", email: "alex.m@example.com", seats_wanted: 2 },
  { id: "w2", name: "Sam Okonkwo", email: "sam.o@example.com", seats_wanted: 1 },
];

export const DEMO_INQUIRIES = [
  {
    id: "inq-1",
    name: "Rachel Behn",
    email: "rachel.behn@example.com",
    phone: "860-555-0184",
    preferred_date: daysOut(45, 18).slice(0, 10),
    headcount: 14,
    message:
      "Looking to do something for my sister's 30th. About 14 of us. We'd love to be at a brewery if you have one you like working with — otherwise we have a space.",
    handled: false,
    created_at: daysOut(-2, 10),
    inquiry_type: "private" as const,
    venue_name: null,
    workshop_interest: "candle-making",
  },
  {
    id: "inq-2",
    name: "Nick Tarullo",
    email: "nick@example.com",
    phone: "860-555-0132",
    preferred_date: null,
    headcount: null,
    message:
      "Tuesdays and Wednesdays are dead for us through the winter. We can seat about 30 in the back room. Saw your night at Stubborn Beauty — what would it take to get one on our calendar?",
    handled: false,
    created_at: daysOut(-4, 16),
    inquiry_type: "venue" as const,
    venue_name: "Foxfire Taproom",
    workshop_interest: null,
  },
  {
    id: "inq-3",
    name: "Devon Park",
    email: "dpark@example.com",
    phone: null,
    preferred_date: null,
    headcount: 22,
    message: "Team offsite in the fall. Ballpark pricing for ~22 people?",
    handled: true,
    created_at: daysOut(-9, 15),
    inquiry_type: "private" as const,
    venue_name: null,
    workshop_interest: "tie-dye",
  },
];

/** The one paid order the /booked demo page renders. */
export const DEMO_ORDER = DEMO_ORDERS[0];

/**
 * Real photos we have so far. Everything else falls back to the generated
 * neon placeholder, so a half-photographed catalog still looks deliberate.
 */
export const WORKSHOP_PHOTOS: Record<string, string> = {
  "mini-terrariums": "/images/terrarium.jpg",
  "canvas-collab-night": "/images/paint-and-sip.jpg",
  "classic-canvas": "/images/paint-and-sip.jpg",
  "jewelry-bar": "/images/jewelry-bar.jpg",
  "tie-dye": "/images/tie-dye.jpg",
  "ink-tiles": "/images/ink-tiles.jpg",
  "candle-making": "/images/candle-making.jpg",
  "paint-pour": "/images/paint-pour.jpg",
  "coasters": "/images/coasters.jpg",
  "coffee-filter-flowers": "/images/coffee-filter-flowers.jpg",
  "onesie-decorating": "/images/onesie-decorating.jpg",
  "garter-making": "/images/garter-making.jpg",
  // Still unphotographed — these fall back to the generated neon placeholder:
  // glassware-painting, yeti-personalization, wreaths, door-signs,
  // vision-boards, cornhole-boards.
};

/**
 * Workshop catalog fixtures. Mirrors supabase/migrations/0002_workshops.sql —
 * shortened descriptions, since the menu page only shows the tagline.
 */
export const DEMO_WORKSHOPS = [
  ["mini-terrariums", "Build Your Own Mini Terrarium", "Build a tiny living world to take home.", "A finished mini terrarium with care instructions", ["Date night", "Beginner-friendly", "Girls' night", "Solo creative reset"], 120, 3700, 1, 24, true],
  ["canvas-collab-night", "Canvas Collab Night", "Everyone paints everyone else's canvas.", "A collaborative canvas nobody could have made alone", ["Girls' night", "Team building", "Date night", "Beginner-friendly"], 120, 4500, 6, 24, true],
  ["classic-canvas", "Classic Canvas", "One painting, step by step, at your own pace.", "A finished 11x14 canvas to take home", ["Date night", "Girls' night", "Birthday", "Beginner-friendly"], 120, 4500, 6, 30, true],
  ["ink-tiles", "Ink Tiles", "Alcohol ink on ceramic. Impossible to do badly.", "Two finished ceramic tiles, sealed and ready to display", ["Beginner-friendly", "Date night", "Team building", "Girls' night"], 90, 4000, 6, 28, true],
  ["paint-pour", "Paint Pour", "Controlled chaos. Wildly satisfying.", "A poured canvas plus the video everyone takes of it happening", ["Girls' night", "Birthday", "Beginner-friendly"], 120, 5000, 6, 20, false],
  ["glassware-painting", "Beer Mug & Wine Glass Painting", "Paint the thing you're drinking out of.", "A dishwasher-safe glass or mug you'll actually use", ["Date night", "Birthday", "Girls' night", "Beginner-friendly"], 120, 4500, 6, 26, true],
  ["yeti-personalization", "Tumbler Personalization", "Make your Yeti unmistakably yours.", "A personalized insulated tumbler", ["Team building", "Birthday", "Guys' night"], 90, 5500, 6, 24, true],
  ["candle-making", "Candle Making", "Pick your scent, pour your own.", "A poured candle in a reusable vessel", ["Girls' night", "Date night", "Baby shower", "Bachelorette"], 120, 5000, 6, 24, true],
  ["tie-dye", "Tie Dye", "Not the summer camp version.", "A dyed shirt or tote, wrapped to set overnight", ["Team building", "Birthday", "Girls' night", "Beginner-friendly"], 120, 4000, 8, 30, false],
  ["wreaths", "Wreath Making", "Seasonal, and better than the store-bought one.", "A finished wreath for your door", ["Seasonal", "Girls' night", "Birthday"], 120, 6000, 6, 22, true],
  ["door-signs", "Door Signs", "Wood, paint, and something to say.", "A painted wooden door sign", ["Seasonal", "Girls' night", "Birthday"], 120, 5500, 6, 22, true],
  ["coasters", "Coasters", "Small project, big payoff.", "A set of four finished coasters", ["Beginner-friendly", "Date night", "Team building"], 90, 3500, 6, 28, true],
  ["jewelry-bar", "Jewelry Bar", "Build it from a table of parts.", "A necklace, bracelet, or pair of earrings", ["Girls' night", "Bachelorette", "Birthday", "Beginner-friendly"], 90, 4500, 6, 30, true],
  ["vision-boards", "Vision Boards", "January energy, any month.", "A finished vision board", ["Girls' night", "Team building", "Seasonal", "Beginner-friendly"], 120, 4000, 6, 24, true],
  ["coffee-filter-flowers", "Coffee Filter Flowers", "Cheap materials, absurdly pretty results.", "A small bouquet of paper flowers", ["Baby shower", "Girls' night", "Beginner-friendly", "Seasonal"], 90, 3500, 6, 28, true],
  ["onesie-decorating", "Onesie Decorating", "The baby shower activity that isn't a game.", "Decorated onesies for the guest of honor", ["Baby shower", "Beginner-friendly"], 90, 4000, 6, 24, true],
  ["garter-making", "Garter Making", "Bachelorette, handled.", "A handmade garter, plus whatever else the group gets up to", ["Bachelorette", "Girls' night"], 90, 4500, 6, 20, true],
  ["cornhole-boards", "Cornhole Board Painting", "For the group that says they're not crafty.", "A painted cornhole set for the group", ["Guys' night", "Team building", "Birthday"], 180, 7500, 4, 16, false],
].map(([slug, name, tagline, whatYouMake, goodFor, mins, price, min, max, barFriendly], i) => ({
  id: `ws-${i}`,
  slug: slug as string,
  name: name as string,
  tagline: tagline as string,
  description: `${tagline as string}\n\nFull description lives in the database — this is preview data.`,
  what_you_make: whatYouMake as string,
  good_for: goodFor as string[],
  duration_minutes: mins as number,
  base_price_cents: price as number,
  min_group: min as number,
  max_group: max as number,
  bar_friendly: barFriendly as boolean,
  image_url: WORKSHOP_PHOTOS[slug as string] ?? null,
  active: true,
  sort_order: (i + 1) * 10,
}));
