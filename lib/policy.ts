/**
 * Versioned refund policy.
 *
 * NEVER edit a published version in place. Add a new one and bump
 * CURRENT_POLICY_VERSION. Orders store the version the customer accepted, and
 * six months from now you need to know exactly which wording that was —
 * especially if you're answering a chargeback.
 */

export const CURRENT_POLICY_VERSION = "1.0";

export interface RefundTier {
  /** Inclusive lower bound, in hours before event start. */
  minHoursBefore: number;
  /** Percentage of the ticket returned. */
  refundPercent: number;
  label: string;
  reason: string;
}

/**
 * Ordered most-generous first. Computed in HOURS, never days — day arithmetic
 * introduces off-by-one bugs around midnight and daylight saving.
 *
 * 7 days = 168h, 3 days = 72h. 72h exactly falls in the 50% tier, which matches
 * the written policy ("3–6 days" vs "less than 72 hours").
 */
export const REFUND_TIERS: RefundTier[] = [
  {
    minHoursBefore: 168,
    refundPercent: 100,
    label: "7+ days before",
    reason: "Full refund to your original payment method, no questions asked.",
  },
  {
    minHoursBefore: 72,
    refundPercent: 50,
    label: "3–6 days before",
    reason:
      "50% refund. Materials have already been ordered and prepped for your seat.",
  },
  {
    minHoursBefore: 0,
    refundPercent: 0,
    label: "Less than 72 hours",
    reason:
      "No refund. Your spot and supplies are committed, and we cannot fill the seat on short notice.",
  },
];

export interface RefundQuote {
  tier: RefundTier;
  hoursUntilEvent: number;
  refundCents: number;
}

/**
 * What this order is owed if the CUSTOMER cancels right now.
 *
 * Note: this does not apply when WE cancel. Our cancellations are always a full
 * refund or a free transfer, customer's choice.
 */
export function quoteRefund(
  amountCents: number,
  eventStartsAt: Date,
  now: Date = new Date()
): RefundQuote {
  const hoursUntilEvent =
    (eventStartsAt.getTime() - now.getTime()) / (1000 * 60 * 60);

  const tier =
    REFUND_TIERS.find((t) => hoursUntilEvent >= t.minHoursBefore) ??
    REFUND_TIERS[REFUND_TIERS.length - 1];

  return {
    tier,
    hoursUntilEvent,
    // Round down: never refund a fraction of a cent in the customer's favour
    // by accident, and never exceed what they paid.
    refundCents: Math.min(
      amountCents,
      Math.floor((amountCents * tier.refundPercent) / 100)
    ),
  };
}

/** The status an order should land in after a customer-initiated refund. */
export function statusAfterRefund(
  refundCents: number,
  amountCents: number
): "refunded" | "partially_refunded" | "paid" {
  if (refundCents <= 0) return "paid";
  if (refundCents >= amountCents) return "refunded";
  return "partially_refunded";
}

export const POLICY_TEXT = {
  version: CURRENT_POLICY_VERSION,
  headline: "Refund & Cancellation Policy",
  sections: [
    {
      heading: "Standard cancellations",
      body: [
        "7+ days before the event: Full refund to your original payment method, no questions asked.",
        "3–6 days before the event: 50% refund. Materials have already been ordered and prepped for your seat.",
        "Less than 72 hours before the event: No refund. Your spot and supplies are committed, and we cannot fill the seat on short notice.",
      ],
    },
    {
      heading: "Transfers",
      body: [
        "Can't make it? You may transfer your ticket to a friend at any time before the event starts. Just email or text us the new name so we can update the guest list — no fee.",
      ],
    },
    {
      heading: "No-shows",
      body: [
        "If you don't show up and haven't transferred your spot, the ticket is forfeited with no refund or credit.",
      ],
    },
    {
      heading: "Our cancellations",
      body: [
        "If we cancel due to low enrollment, instructor illness, or venue issues, you get a full refund or a free transfer to a future session — your choice.",
        "If the venue cancels on us (weather, emergency, etc.), we will notify you ASAP and offer a full refund or reschedule credit.",
      ],
    },
    {
      heading: "Late arrivals",
      body: [
        "We start on time so everyone finishes together. If you're more than 15 minutes late, we may not be able to catch you up, and no partial refund will be issued.",
      ],
    },
    {
      heading: "Damaged or unsatisfactory projects",
      body: [
        "We guide you step-by-step, but art is handmade and imperfect by nature. We do not offer refunds for projects you don't love, but we will absolutely help you fix or adjust anything during the session.",
      ],
    },
  ],
} as const;
