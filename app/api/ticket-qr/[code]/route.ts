import { NextRequest } from "next/server";
import QRCode from "qrcode";

export const runtime = "nodejs";

/**
 * QR codes for the confirmation email, served as a real image over https.
 *
 * They used to be inlined as data: URIs. Apple Mail renders those; Gmail and
 * Outlook strip them, so most guests saw a broken image where their door code
 * should have been. CID attachments don't help either — Gmail blocks those
 * too. A hosted URL is the only method every client renders.
 *
 * The code is validated against the door-code alphabet before anything is
 * drawn, so this cannot be used as a free "QR code for arbitrary text"
 * generator sitting on our domain — that would be a gift to phishers.
 *
 * No auth: the code IS the credential, and it already travels in the clear
 * inside the email. Serving a picture of one the sender already has adds no
 * exposure. Nothing here confirms whether a code is real.
 */

// Same alphabet as generate_ticket_code() — no 0/O/1/I/L.
const DOOR_CODE = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const clean = code.replace(/\.png$/i, "").toUpperCase();

  if (!DOOR_CODE.test(clean)) {
    return new Response("Not found", { status: 404 });
  }

  const dataUrl = await QRCode.toDataURL(clean, { margin: 1, width: 220 });
  const png = Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");

  return new Response(png, {
    headers: {
      "Content-Type": "image/png",
      // A given code always draws the same image, so cache it hard.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
