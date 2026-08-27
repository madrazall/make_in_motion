import { NextRequest, NextResponse } from "next/server";
import { getEventById, reserveSeats, reserveErrorMessage } from "@/lib/availability";
import { createCheckoutSession } from "@/lib/stripe";
import { db } from "@/lib/db";
import { CURRENT_POLICY_VERSION } from "@/lib/policy";
import { MAX_SEATS_PER_ORDER } from "@/lib/config";
import { formatDate, formatTimeRange } from "@/lib/format";

export const runtime = "nodejs";

/**
 * Hold seats, then hand off to Stripe.
 *
 * Order of operations matters: we take the database hold FIRST, and only create
 * the Stripe session once seats are actually secured. Doing it the other way
 * round would let two people reach Stripe for the same last seat.
 */
export async function POST(req: NextRequest) {
  let body: {
    eventId?: string;
    seats?: number;
    name?: string;
    email?: string;
    phone?: string;
    policyAccepted?: boolean;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const seats = Number(body.seats);
  const name = (body.name ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const phone = (body.phone ?? "").trim();

  // ---- validation ---------------------------------------------------------
  if (!body.eventId) {
    return NextResponse.json({ error: "Missing event." }, { status: 400 });
  }
  if (!Number.isInteger(seats) || seats < 1 || seats > MAX_SEATS_PER_ORDER) {
    return NextResponse.json(
      { error: `Please choose between 1 and ${MAX_SEATS_PER_ORDER} spots.` },
      { status: 400 }
    );
  }
  if (name.length < 2) {
    return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email address — this is where your ticket goes." },
      { status: 400 }
    );
  }
  if (phone.length < 7) {
    return NextResponse.json(
      { error: "Please enter a phone number so we can reach you about your booking." },
      { status: 400 }
    );
  }
  // The consent checkbox. Also recorded on the order by reserve_seats().
  if (body.policyAccepted !== true) {
    return NextResponse.json(
      { error: "Please confirm you understand the refund and cancellation policy." },
      { status: 400 }
    );
  }

  const event = await getEventById(body.eventId);
  if (!event) {
    return NextResponse.json({ error: "We couldn't find that event." }, { status: 404 });
  }

  // ---- hold the seats -----------------------------------------------------
  // Price is recomputed inside reserve_seats() from the event record. Nothing
  // the browser sent about money is trusted.
  const reservation = await reserveSeats({
    eventId: event.id,
    seats,
    customerName: name,
    email,
    phone,
    policyVersion: CURRENT_POLICY_VERSION,
  });

  if (!reservation.ok) {
    return NextResponse.json(
      {
        error: reserveErrorMessage(reservation.reason, reservation.spots_left),
        reason: reservation.reason,
        spotsLeft: reservation.spots_left ?? 0,
      },
      { status: 409 }
    );
  }

  // ---- hand off to Stripe -------------------------------------------------
  try {
    const session = await createCheckoutSession({
      orderId: reservation.order_id,
      confirmationCode: reservation.confirmation_code,
      eventId: event.id,
      eventTitle: event.title,
      eventWhen: `${formatDate(event.starts_at)}, ${formatTimeRange(event.starts_at, event.ends_at)}`,
      venueName: event.venue.name,
      seats,
      unitAmountCents: event.price_cents,
      customerEmail: email,
    });

    await db()
      .from("orders")
      .update({ stripe_session_id: session.id })
      .eq("id", reservation.order_id);

    return NextResponse.json({ url: session.url });
  } catch (err) {
    // Stripe failed after we took the hold. Release it immediately rather than
    // making someone wait 30 minutes for a seat nobody is buying.
    console.error("[checkout] stripe session failed, releasing hold", err);
    await db()
      .from("orders")
      .update({ status: "expired" })
      .eq("id", reservation.order_id)
      .eq("status", "pending");

    return NextResponse.json(
      { error: "We couldn't reach our payment processor. Please try again in a moment." },
      { status: 502 }
    );
  }
}
