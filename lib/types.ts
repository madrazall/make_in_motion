export type EventStatus = "draft" | "published" | "completed" | "cancelled";

export type OrderStatus =
  | "pending"
  | "paid"
  | "refunded"
  | "partially_refunded"
  | "expired"
  | "cancelled";

export interface Venue {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  map_url: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
}

export interface EventRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  image_url: string | null;
  venue_id: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  min_to_run: number;
  price_cents: number;
  whats_included: string;
  what_to_bring: string;
  venue_payout_note: string | null;
  status: EventStatus;
}

export interface EventWithVenue extends EventRow {
  venue: Venue;
}

/** An event plus its live availability. Never trust a stored sold-out flag. */
export interface EventWithAvailability extends EventWithVenue {
  seatsTaken: number;
  spotsLeft: number;
  soldOut: boolean;
}

export type PaymentMethod = "stripe" | "cash" | "venmo" | "cashapp" | "comp" | "other";

export interface OrderRow {
  id: string;
  confirmation_code: string;
  event_id: string;
  customer_name: string;
  email: string;
  phone: string | null;
  seats: number;
  amount_cents: number;
  status: OrderStatus;
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  hold_expires_at: string | null;
  paid_at: string | null;
  policy_accepted_at: string | null;
  policy_version: string | null;
  refund_cents: number;
  refunded_at: string | null;
  checked_in_at: string | null;
  payment_method: PaymentMethod;
  notes: string | null;
  created_at: string;
}

/** Shape returned by the create_manual_order() Postgres function. */
export type ManualOrderResult =
  | {
      ok: true;
      order_id: string;
      confirmation_code: string;
      spots_left: number;
      has_email: boolean;
    }
  | {
      ok: false;
      reason:
        | "invalid_quantity"
        | "invalid_amount"
        | "event_not_found"
        | "event_cancelled"
        | "sold_out"
        | "not_enough_spots";
      spots_left?: number;
    };

export interface TicketRow {
  id: string;
  order_id: string;
  seat_number: number;
  code: string;
  checked_in_at: string | null;
  created_at: string;
}

/** Shape returned by the check_in_ticket() Postgres function. */
export type CheckInResult =
  | {
      ok: true;
      guest_name: string;
      seat_number: number;
      seats_total: number;
      event_id: string;
    }
  | {
      ok: false;
      reason: "not_found" | "order_cancelled" | "already_used";
      guest_name?: string;
      seat_number?: number;
      seats_total?: number;
      checked_in_at?: string;
    };

/** Shape returned by the reserve_seats() Postgres function. */
export type ReserveResult =
  | {
      ok: true;
      order_id: string;
      confirmation_code: string;
      amount_cents: number;
      spots_left: number;
    }
  | {
      ok: false;
      reason:
        | "invalid_quantity"
        | "event_not_found"
        | "event_not_on_sale"
        | "event_started"
        | "sold_out"
        | "not_enough_spots";
      spots_left?: number;
    };
