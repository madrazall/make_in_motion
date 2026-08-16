import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendInquiryNotification } from "@/lib/email";

export const runtime = "nodejs";

/** Private / group event requests. Deliberately not a checkout flow. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();

  if (name.length < 2) {
    return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email." }, { status: 400 });
  }

  const inquiryType = body.inquiryType === "venue" ? "venue" : "private";

  const record = {
    name,
    email,
    phone: (body.phone ?? "").trim() || null,
    preferred_date: body.preferredDate || null,
    headcount: body.headcount ? Number(body.headcount) : null,
    message: (body.message ?? "").trim() || null,
    inquiry_type: inquiryType,
    venue_name: (body.venueName ?? "").trim() || null,
    workshop_interest: (body.workshopInterest ?? "").trim() || null,
  };

  const { error } = await db().from("private_inquiries").insert(record);
  if (error) {
    console.error("[inquiry] insert failed", error);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }

  // Saved first, emailed second — a mail failure must not lose the lead.
  try {
    await sendInquiryNotification({
      name,
      email,
      phone: record.phone,
      preferredDate: record.preferred_date,
      headcount: record.headcount,
      message: record.message,
      inquiryType,
      venueName: record.venue_name,
      workshopInterest: record.workshop_interest,
    });
  } catch (err) {
    console.error("[inquiry] notification email failed", err);
  }

  return NextResponse.json({ ok: true });
}
