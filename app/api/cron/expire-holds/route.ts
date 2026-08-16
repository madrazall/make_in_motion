import { NextRequest, NextResponse } from "next/server";
import { expireHolds } from "@/lib/availability";

export const runtime = "nodejs";

/**
 * Backup sweep for expired seat holds. Runs every 5 minutes (wrangler.jsonc).
 *
 * Stripe's checkout.session.expired webhook is the primary path — this exists
 * for the case where a webhook never arrives. Idempotent, so a duplicate or
 * missed run costs nothing.
 *
 * Cloudflare does NOT retry a failed scheduled run, which is fine: the next one
 * is five minutes away and does the same work.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided =
    req.headers.get("authorization")?.replace("Bearer ", "") ??
    req.nextUrl.searchParams.get("secret");

  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const released = await expireHolds();
  if (released > 0) {
    console.log(`[cron] released ${released} expired hold(s)`);
  }

  return NextResponse.json({ ok: true, released });
}
