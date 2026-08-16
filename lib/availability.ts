import { db } from "./db";
import { HOLD_MINUTES, MAX_SEATS_PER_ORDER } from "./config";
import { isDemoMode, DEMO_EVENTS } from "./demo";
import type {
  EventWithAvailability,
  EventWithVenue,
  ManualOrderResult,
  PaymentMethod,
  ReserveResult,
} from "./types";

/**
 * ALL capacity logic lives in this file.
 *
 * Do not count seats anywhere else — not in a page, not in a component, not in
 * an API route. The moment this logic exists in two places they will disagree,
 * and the way you find out is a brewery with more people than chairs.
 */

const EVENT_SELECT = `
  id, slug, title, description, image_url, venue_id,
  starts_at, ends_at, capacity, min_to_run, price_cents,
  whats_included, what_to_bring, venue_payout_note, status,
  venue:venues (
    id, name, address, city, state, zip, map_url,
    contact_name, contact_email, contact_phone, notes
  )
`;

/** Attach live availability to an event. */
async function withAvailability(
  event: EventWithVenue
): Promise<EventWithAvailability> {
  const { data, error } = await db()
    .from("event_availability")
    .select("seats_taken, spots_left, sold_out")
    .eq("event_id", event.id)
    .single();

  if (error) throw new Error(`availability lookup failed: ${error.message}`);

  return {
    ...event,
    seatsTaken: data.seats_taken,
    spotsLeft: data.spots_left,
    soldOut: data.sold_out,
  };
}

/** Published, not yet started, soonest first. What the homepage shows. */
export async function listUpcomingEvents(): Promise<EventWithAvailability[]> {
  if (isDemoMode()) {
    return [...DEMO_EVENTS].sort(
      (a, b) => +new Date(a.starts_at) - +new Date(b.starts_at)
    );
  }

  const { data, error } = await db()
    .from("events")
    .select(EVENT_SELECT)
    .eq("status", "published")
    .gt("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true });

  if (error) throw new Error(`listUpcomingEvents failed: ${error.message}`);

  return Promise.all(
    (data as unknown as EventWithVenue[]).map(withAvailability)
  );
}

export async function getEventBySlug(
  slug: string
): Promise<EventWithAvailability | null> {
  if (isDemoMode()) {
    return DEMO_EVENTS.find((e) => e.slug === slug) ?? null;
  }

  const { data, error } = await db()
    .from("events")
    .select(EVENT_SELECT)
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error(`getEventBySlug failed: ${error.message}`);
  if (!data) return null;

  return withAvailability(data as unknown as EventWithVenue);
}

export async function getEventById(
  id: string
): Promise<EventWithAvailability | null> {
  if (isDemoMode()) {
    return DEMO_EVENTS.find((e) => e.id === id) ?? null;
  }

  const { data, error } = await db()
    .from("events")
    .select(EVENT_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`getEventById failed: ${error.message}`);
  if (!data) return null;

  return withAvailability(data as unknown as EventWithVenue);
}

/** How many a single customer may buy right now. */
export function maxPurchasable(spotsLeft: number): number {
  return Math.max(0, Math.min(spotsLeft, MAX_SEATS_PER_ORDER));
}

/**
 * Atomically hold seats.
 *
 * Delegates entirely to the reserve_seats() Postgres function, which takes a
 * row lock on the event and re-counts inside it. One HTTP call in, one answer
 * out — no transaction is held open from the application, which is what makes
 * this safe on Workers.
 *
 * The price is recomputed server-side inside that function. Whatever the
 * browser claims the total is gets ignored.
 */
export async function reserveSeats(params: {
  eventId: string;
  seats: number;
  customerName: string;
  email: string;
  phone?: string | null;
  policyVersion: string;
}): Promise<ReserveResult> {
  const { data, error } = await db().rpc("reserve_seats", {
    p_event_id: params.eventId,
    p_seats: params.seats,
    p_customer_name: params.customerName,
    p_email: params.email,
    p_phone: params.phone ?? null,
    p_policy_version: params.policyVersion,
    p_hold_minutes: HOLD_MINUTES,
  });

  if (error) {
    // errcode MIM01 is the oversell trigger. It should be unreachable — if it
    // ever appears in logs, something bypassed reserve_seats().
    if (error.message?.includes("OVERSOLD")) {
      console.error("[CRITICAL] oversell guard fired", {
        eventId: params.eventId,
        seats: params.seats,
        error: error.message,
      });
      return { ok: false, reason: "sold_out" };
    }
    throw new Error(`reserveSeats failed: ${error.message}`);
  }

  return data as ReserveResult;
}

/**
 * Door sales and the Stripe-outage fallback: an admin recording a payment
 * that already happened (cash, Venmo, comp) rather than one still in flight.
 *
 * Takes the exact same row lock and recount as reserveSeats() — see
 * create_manual_order() in supabase/migrations/0007_manual_orders.sql for why
 * a second entry point doesn't mean a second capacity check.
 */
export async function createManualOrder(params: {
  eventId: string;
  seats: number;
  customerName: string;
  email?: string | null;
  phone?: string | null;
  amountCents: number;
  paymentMethod: PaymentMethod;
  policyVersion: string;
  notes?: string | null;
}): Promise<ManualOrderResult> {
  const { data, error } = await db().rpc("create_manual_order", {
    p_event_id: params.eventId,
    p_seats: params.seats,
    p_customer_name: params.customerName,
    p_email: params.email ?? null,
    p_phone: params.phone ?? null,
    p_amount_cents: params.amountCents,
    p_payment_method: params.paymentMethod,
    p_policy_version: params.policyVersion,
    p_notes: params.notes ?? null,
  });

  if (error) {
    if (error.message?.includes("OVERSOLD")) {
      console.error("[CRITICAL] oversell guard fired on a manual order", {
        eventId: params.eventId,
        seats: params.seats,
        error: error.message,
      });
      return { ok: false, reason: "sold_out" };
    }
    throw new Error(`createManualOrder failed: ${error.message}`);
  }

  return data as ManualOrderResult;
}

/** Copy for a rejected manual order. Shown to the admin, so plain and specific is fine. */
export function manualOrderErrorMessage(
  reason: Exclude<ManualOrderResult, { ok: true }>["reason"],
  spotsLeft?: number
): string {
  switch (reason) {
    case "sold_out":
      return "This event is already sold out — there's no seat left to sell.";
    case "not_enough_spots":
      return `Only ${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left. Try a smaller number.`;
    case "event_cancelled":
      return "This event was cancelled.";
    case "event_not_found":
      return "Couldn't find that event.";
    case "invalid_quantity":
      return `Choose between 1 and ${MAX_SEATS_PER_ORDER} spots.`;
    case "invalid_amount":
      return "Enter a valid amount.";
    default:
      return "Something went wrong. Please try again.";
  }
}

/** Backup for the checkout.session.expired webhook. Safe to run repeatedly. */
export async function expireHolds(): Promise<number> {
  const { data, error } = await db().rpc("expire_holds");
  if (error) throw new Error(`expireHolds failed: ${error.message}`);
  return (data as number) ?? 0;
}

/** Human-readable availability for a badge. */
export function availabilityLabel(event: {
  spotsLeft: number;
  capacity: number;
}): { text: string; tone: "ok" | "low" | "gone" } {
  if (event.spotsLeft <= 0) return { text: "Sold out", tone: "gone" };
  if (event.spotsLeft <= 3)
    return {
      text: `Only ${event.spotsLeft} spot${event.spotsLeft === 1 ? "" : "s"} left`,
      tone: "low",
    };
  return { text: `${event.spotsLeft} spots left`, tone: "ok" };
}

/** Copy for a rejected reservation. Shown to a real person, so no jargon. */
export function reserveErrorMessage(
  reason: Exclude<ReserveResult, { ok: true }>["reason"],
  spotsLeft?: number
): string {
  switch (reason) {
    case "sold_out":
      return "This event just sold out. Join the waitlist and we'll email you if a spot opens up.";
    case "not_enough_spots":
      return `Only ${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left — someone grabbed the rest while you were checking out. Try a smaller number?`;
    case "event_started":
      return "This event has already started.";
    case "event_not_on_sale":
      return "This event isn't on sale right now.";
    case "event_not_found":
      return "We couldn't find that event.";
    case "invalid_quantity":
      return `Please choose between 1 and ${MAX_SEATS_PER_ORDER} spots.`;
    default:
      return "Something went wrong. Please try again.";
  }
}
