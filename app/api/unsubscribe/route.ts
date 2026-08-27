import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/**
 * One-click unsubscribe from event announcement emails. Deliberately no
 * token — worst case someone unsubscribes an email address they already
 * know, which isn't a meaningful risk for a low-stakes marketing list, and
 * a token would mean storing one per subscriber for a link most people
 * click once.
 */
export async function GET(req: NextRequest) {
  const email = (req.nextUrl.searchParams.get("email") ?? "").trim().toLowerCase();

  if (email) {
    await db().from("subscribers").delete().eq("email", email);
  }

  return new NextResponse(
    `<!doctype html>
<html><body style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;
  max-width:480px;margin:80px auto;padding:0 24px;color:#1a1a1a;text-align:center;">
  <h1 style="font-size:22px;">You're unsubscribed.</h1>
  <p style="color:#4a4540;">You won't get any more event announcement emails from Make In Motion.</p>
</body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
