import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { checkInTicket } from "@/lib/tickets";

export const runtime = "nodejs";

/**
 * The door. A cheap USB/BT QR scanner types the decoded code + Enter into
 * whatever field has focus — this route is the other end of that keystroke.
 */
export async function POST(req: NextRequest) {
  // The middleware matcher only covers /admin/*, so this route checks its own auth.
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if ((await verifySessionToken(token)) !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { code } = (await req.json()) as { code?: string };
  if (!code || !code.trim()) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  const result = await checkInTicket(code);
  return NextResponse.json(result);
}
