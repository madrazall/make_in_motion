import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { MAX_SEATS_PER_ORDER } from "@/lib/config";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.eventId) {
    return NextResponse.json({ error: "Missing event." }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const seats = Math.min(Math.max(Number(body.seats) || 1, 1), MAX_SEATS_PER_ORDER);

  if (name.length < 2) {
    return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email." }, { status: 400 });
  }

  // Re-joining just updates the existing row rather than erroring.
  const { error } = await db()
    .from("waitlist")
    .upsert(
      { event_id: body.eventId, name, email, seats_wanted: seats },
      { onConflict: "event_id,email" }
    );

  if (error) {
    console.error("[waitlist] insert failed", error);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
