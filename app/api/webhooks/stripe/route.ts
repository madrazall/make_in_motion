import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { constructWebhookEvent } from "@/lib/stripe";
import { db } from "@/lib/db";
import { getEventById } from "@/lib/availability";
import { sendConfirmationEmail } from "@/lib/email";
import { createTicketsForOrder } from "@/lib/tickets";
import type { OrderRow } from "@/lib/types";

export const runtime = "nodejs";

/**
 * The source of truth for whether an order is paid.
 *
 * NOT the browser redirect. Someone who pays and immediately closes the tab
 * must still get their ticket, and someone who reaches /booked/CODE by guessing
 * must not.
 *
 * Stripe retries on failure and can deliver the same event more than once, so
 * every handler here is idempotent.
 */
export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  // Must be the raw body text — parsing it first breaks signature verification.
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = await constructWebhookEvent(rawBody, signature);
  } catch (err) {
    // An unverified webhook means anyone who finds this URL can mark orders paid.
    console.error("[webhook] signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case "checkout.session.expired":
        await handleExpired(event.data.object as Stripe.Checkout.Session);
        break;

      case "charge.refunded":
        await handleRefunded(event.data.object as Stripe.Charge);
        break;

      default:
        // Everything else is noise. Acknowledge so Stripe stops retrying.
        break;
    }
  } catch (err) {
    console.error(`[webhook] handler failed for ${event.type}`, err);
    // 500 tells Stripe to retry. Safe because handlers are idempotent.
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// ---------------------------------------------------------------------------

async function handleCompleted(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.order_id;
  if (!orderId) {
    console.error("[webhook] completed session with no order_id", session.id);
    return;
  }

  // Idempotency: only a pending order transitions to paid. A duplicate delivery
  // matches zero rows and sends no second email.
  const { data: updated, error } = await db()
    .from("orders")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      hold_expires_at: null,
      stripe_payment_intent_id:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id ?? null,
    })
    .eq("id", orderId)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();

  if (error) throw new Error(`order update failed: ${error.message}`);

  if (!updated) {
    console.log(`[webhook] order ${orderId} already processed, skipping`);
    return;
  }

  const order = updated as OrderRow;
  const eventRow = await getEventById(order.event_id);
  if (!eventRow) {
    console.error(`[webhook] order ${orderId} references missing event`);
    return;
  }

  // One scannable code per seat — the door doesn't need names. Must exist
  // before the email goes out, since the email is what carries the QR codes.
  const tickets = await createTicketsForOrder(order.id);

  // The email is the ticket. If it fails we still keep the payment recorded —
  // it can be resent by hand from the admin roster.
  try {
    await sendConfirmationEmail(order, eventRow, tickets);
  } catch (err) {
    console.error(`[webhook] confirmation email failed for ${order.confirmation_code}`, err);
  }
}

async function handleExpired(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.order_id;
  if (!orderId) return;

  // Frees the seats the moment Stripe gives up, rather than waiting for the
  // 5-minute cron sweep.
  const { error } = await db()
    .from("orders")
    .update({ status: "expired" })
    .eq("id", orderId)
    .eq("status", "pending");

  if (error) throw new Error(`expire failed: ${error.message}`);
}

async function handleRefunded(charge: Stripe.Charge) {
  const paymentIntentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id;
  if (!paymentIntentId) return;

  const { data: order } = await db()
    .from("orders")
    .select("id, amount_cents")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle();

  if (!order) return;

  const refunded = charge.amount_refunded;
  // A full refund puts the seat back on sale. A partial one (the 50% tier) does
  // not — they cancelled inside 72 hours and the seat stays committed.
  const status = refunded >= order.amount_cents ? "refunded" : "partially_refunded";

  await db()
    .from("orders")
    .update({
      status,
      refund_cents: refunded,
      refunded_at: new Date().toISOString(),
    })
    .eq("id", order.id);
}
