import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEventById } from "@/lib/availability";
import { getCheckInCountsByOrder } from "@/lib/tickets";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import type { OrderRow } from "@/lib/types";

export const runtime = "nodejs";

function csvCell(value: string | number | null): string {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Roster export. Download it before you leave the house — venue wifi is
 * unreliable and check-in needs to work on paper as a fallback.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // The middleware matcher only covers /admin/*, so this route checks its own auth.
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if ((await verifySessionToken(token)) !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const event = await getEventById(id);
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data } = await db()
    .from("orders")
    .select("*")
    .eq("event_id", id)
    .in("status", ["paid", "partially_refunded"])
    .order("customer_name");

  const orders = (data ?? []) as OrderRow[];
  const checkInCounts = await getCheckInCountsByOrder(orders.map((o) => o.id));

  const rows = [
    ["Name", "Spots", "Email", "Phone", "Code", "Paid via", "Booked", "Marked in", "Tickets scanned"],
    ...orders.map((o) => {
      const counts = checkInCounts.get(o.id);
      return [
        csvCell(o.customer_name),
        csvCell(o.seats),
        csvCell(o.email),
        csvCell(o.phone),
        csvCell(o.confirmation_code),
        csvCell(o.payment_method),
        csvCell(o.paid_at ? formatDate(o.paid_at) : ""),
        csvCell(o.checked_in_at ? "yes" : ""),
        csvCell(counts ? `${counts.checkedIn}/${counts.total}` : ""),
      ];
    }),
    [],
    ["TOTAL GUESTS", csvCell(orders.reduce((n, o) => n + o.seats, 0))],
  ];

  const csv = rows.map((r) => r.join(",")).join("\r\n");
  const filename = `${event.slug}-roster.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
