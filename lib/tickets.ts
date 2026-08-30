import { db } from "./db";
import type { CheckInResult, TicketRow } from "./types";

/**
 * Per-seat check-in codes. Tickets are bearer instruments: no names anywhere.
 * Whoever holds the code gets that seat, which is why transfers need no
 * paperwork and four people from one order can arrive separately.
 */

/** Mints one ticket per seat on a paid order. Safe to call more than once. */
export async function createTicketsForOrder(orderId: string): Promise<TicketRow[]> {
  const { data, error } = await db().rpc("create_tickets_for_order", {
    p_order_id: orderId,
  });
  if (error) throw new Error(`create_tickets_for_order failed: ${error.message}`);
  return (data ?? []) as TicketRow[];
}

/** Atomically claims a scanned code. Never throws on "already used" — that's a normal door outcome. */
export async function checkInTicket(code: string): Promise<CheckInResult> {
  const { data, error } = await db().rpc("check_in_ticket", { p_code: code });
  if (error) throw new Error(`check_in_ticket failed: ${error.message}`);
  return data as CheckInResult;
}

export async function getTicketsForOrder(orderId: string): Promise<TicketRow[]> {
  const { data, error } = await db()
    .from("tickets")
    .select("*")
    .eq("order_id", orderId)
    .order("seat_number");
  if (error) throw new Error(error.message);
  return (data ?? []) as TicketRow[];
}

/** Ticket check-in counts for every order on an event, keyed by order_id. */
export async function getCheckInCountsByOrder(
  orderIds: string[]
): Promise<Map<string, { total: number; checkedIn: number }>> {
  const counts = new Map<string, { total: number; checkedIn: number }>();
  if (orderIds.length === 0) return counts;

  const { data, error } = await db()
    .from("tickets")
    .select("order_id, checked_in_at")
    .in("order_id", orderIds);
  if (error) throw new Error(error.message);

  for (const row of (data ?? []) as { order_id: string; checked_in_at: string | null }[]) {
    const entry = counts.get(row.order_id) ?? { total: 0, checkedIn: 0 };
    entry.total += 1;
    if (row.checked_in_at) entry.checkedIn += 1;
    counts.set(row.order_id, entry);
  }
  return counts;
}
