import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { formatDate } from "@/lib/format";

export const runtime = "nodejs";

function csvCell(value: string | number | null): string {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if ((await verifySessionToken(token)) !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data } = await db()
    .from("subscribers")
    .select("email, source, created_at")
    .order("created_at", { ascending: false });

  const rows = [
    ["Email", "Source", "Signed up"],
    ...(data ?? []).map((s) => [
      csvCell(s.email),
      csvCell(s.source),
      csvCell(formatDate(s.created_at)),
    ]),
  ];

  const csv = rows.map((r) => r.join(",")).join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="subscribers.csv"`,
    },
  });
}
