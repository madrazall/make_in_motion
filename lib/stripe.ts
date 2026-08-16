import Stripe from "stripe";
import { requireEnv, HOLD_MINUTES, BUSINESS, siteUrl } from "./config";

let cached: Stripe | null = null;

export function stripe(): Stripe {
  if (cached) return cached;
  cached = new Stripe(requireEnv("STRIPE_SECRET_KEY"), {
    // Workers have no Node http agent; the fetch client is required here.
    httpClient: Stripe.createFetchHttpClient(),
    apiVersion: "2025-02-24.acacia" as Stripe.LatestApiVersion,
  });
  return cached;
}

/**
 * Create the hosted Checkout session for an already-held order.
 *
 * The session expiry is pinned to the same 30 minutes as the database hold, so
 * the two systems never disagree about whether a seat is still being bought.
 */
export async function createCheckoutSession(params: {
  orderId: string;
  confirmationCode: string;
  eventId: string;
  eventTitle: string;
  eventWhen: string;
  venueName: string;
  seats: number;
  unitAmountCents: number;
  customerEmail: string;
}): Promise<Stripe.Checkout.Session> {
  const expiresAt = Math.floor(Date.now() / 1000) + HOLD_MINUTES * 60;

  return stripe().checkout.sessions.create(
    {
      mode: "payment",
      customer_email: params.customerEmail,
      expires_at: expiresAt,
      line_items: [
        {
          quantity: params.seats,
          price_data: {
            currency: "usd",
            unit_amount: params.unitAmountCents,
            product_data: {
              name: params.eventTitle,
              description: `${params.eventWhen} · ${params.venueName} · 21+`,
            },
          },
        },
      ],
      // Everything the webhook needs, so it never has to guess.
      metadata: {
        order_id: params.orderId,
        event_id: params.eventId,
        confirmation_code: params.confirmationCode,
      },
      payment_intent_data: {
        metadata: {
          order_id: params.orderId,
          confirmation_code: params.confirmationCode,
        },
        description: `${params.eventTitle} — ${params.seats} spot(s) — ${params.confirmationCode}`,
      },
      success_url: `${siteUrl()}/booked/${params.confirmationCode}`,
      cancel_url: `${siteUrl()}/events?cancelled=1`,
      // Lets you issue a credit code by hand when YOU cancel an event.
      allow_promotion_codes: true,
    },
    {
      // If the browser double-submits, Stripe returns the same session rather
      // than charging twice.
      idempotencyKey: `checkout:${params.orderId}`,
    }
  );
}

/**
 * Verify a webhook signature.
 *
 * Must use the async variant and the raw body text — Workers have no synchronous
 * crypto. An unverified webhook means anyone who finds the URL can mark orders
 * as paid.
 */
export async function constructWebhookEvent(
  rawBody: string,
  signature: string
): Promise<Stripe.Event> {
  return stripe().webhooks.constructEventAsync(
    rawBody,
    signature,
    requireEnv("STRIPE_WEBHOOK_SECRET"),
    undefined,
    Stripe.createSubtleCryptoProvider()
  );
}

/**
 * Refund an order. Stripe does NOT return its processing fee on refunds —
 * a 50% refund on a $45 ticket still costs you the original $1.61.
 */
export async function refundPayment(params: {
  paymentIntentId: string;
  amountCents: number;
  reason: string;
  confirmationCode: string;
}): Promise<Stripe.Refund> {
  return stripe().refunds.create(
    {
      payment_intent: params.paymentIntentId,
      amount: params.amountCents,
      metadata: {
        reason: params.reason,
        confirmation_code: params.confirmationCode,
        issued_by: BUSINESS.name,
      },
    },
    { idempotencyKey: `refund:${params.confirmationCode}:${params.amountCents}` }
  );
}
