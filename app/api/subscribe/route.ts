import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Email capture for visitors who aren't ready to buy.
 * Most first-time visitors are browsing at work. Plan §16 item 9.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = (body?.email ?? "").trim().toLowerCase();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email." }, { status: 400 });
  }

  const { error } = await db()
    .from("subscribers")
    .upsert(
      { email, source: (body?.source ?? "homepage").slice(0, 40) },
      { onConflict: "email" }
    );

  if (error) {
    console.error("[subscribe] failed", error);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
