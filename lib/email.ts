import { Resend } from "resend";
import QRCode from "qrcode";
import { requireEnv, BUSINESS, siteUrl } from "./config";
import { formatDate, formatTimeRange, formatMoney } from "./format";
import { buildEventIcs } from "./ics";
import { POLICY_TEXT } from "./policy";
import type { EventWithVenue, OrderRow, TicketRow } from "./types";

/**
 * All outbound mail.
 *
 * The FROM address MUST be on a verified domain. Sending as @gmail.com fails
 * DMARC and lands in spam — and since the confirmation email IS the ticket,
 * that quietly breaks the entire product. Reply-to points at the Gmail so
 * replies still land somewhere it gets read. See PLAN-v2.md §21.
 */

let cached: Resend | null = null;
function resend(): Resend {
  if (!cached) cached = new Resend(requireEnv("RESEND_API_KEY"));
  return cached;
}

const from = () => process.env.EMAIL_FROM ?? `${BUSINESS.name} <tickets@${BUSINESS.domain}>`;
const replyTo = () => process.env.EMAIL_REPLY_TO ?? BUSINESS.email;

// --------------------------------------------------------------------------
// Shared chrome
// --------------------------------------------------------------------------

function shell(bodyHtml: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#faf7f2;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1a1a1a;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
    <div style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#c4643c;font-weight:700;">
      ${BUSINESS.name}
    </div>
    ${bodyHtml}
    <hr style="border:none;border-top:1px solid #e5ded4;margin:32px 0 16px;">
    <p style="font-size:12px;line-height:1.6;color:#7a7266;margin:0;">
      Questions? Reply to this email, or reach us at
      <a href="mailto:${BUSINESS.contactEmail}" style="color:#c4643c;">${BUSINESS.contactEmail}</a>
      or <a href="${BUSINESS.phoneHref}" style="color:#c4643c;">${BUSINESS.phone}</a>.
    </p>
  </div>
</body></html>`;
}

function detailRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 16px 6px 0;color:#7a7266;font-size:14px;vertical-align:top;white-space:nowrap;">${label}</td>
    <td style="padding:6px 0;font-size:14px;font-weight:600;">${value}</td>
  </tr>`;
}

function policyHtml(): string {
  return POLICY_TEXT.sections
    .map(
      (s) => `<p style="margin:12px 0 4px;font-size:13px;font-weight:700;">${s.heading}</p>` +
        s.body
          .map(
            (b) =>
              `<p style="margin:0 0 6px;font-size:13px;line-height:1.6;color:#4a4540;">${b}</p>`
          )
          .join("")
    )
    .join("");
}

// --------------------------------------------------------------------------
// Door codes — one QR per seat, so check-in never depends on a name
// --------------------------------------------------------------------------

/**
 * A data-URI PNG per ticket. If QR rendering ever fails, the door still has
 * the plain code to type by hand — see the fallback in ticketsHtml() below.
 */
async function ticketQrDataUrls(tickets: TicketRow[]): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  await Promise.all(
    tickets.map(async (t) => {
      try {
        urls.set(t.id, await QRCode.toDataURL(t.code, { margin: 1, width: 220 }));
      } catch (err) {
        console.error(`[email] QR generation failed for ticket ${t.code}`, err);
      }
    })
  );
  return urls;
}

function ticketsHtml(tickets: TicketRow[], qrUrls: Map<string, string>): string {
  if (tickets.length === 0) return "";

  const cards = tickets
    .map((t) => {
      const qr = qrUrls.get(t.id);
      const img = qr
        ? `<img src="${qr}" width="140" height="140" alt="Ticket QR code" style="display:block;border-radius:8px;">`
        : "";
      return `<div style="display:inline-block;text-align:center;padding:12px;margin:4px;background:#fff;border:1px solid #e5ded4;border-radius:12px;">
        ${img}
        <div style="margin-top:6px;font-size:11px;color:#7a7266;">Seat ${t.seat_number} of ${tickets.length}</div>
        <div style="font-family:ui-monospace,monospace;font-size:13px;font-weight:600;letter-spacing:.03em;">Ticket number: ${t.code}</div>
      </div>`;
    })
    .join("");

  return `
    <p style="margin:24px 0 8px;font-size:15px;font-weight:700;">Your door codes</p>
    <p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:#4a4540;">
      One code per seat — show this screen (or the printed code) at check-in. Each code
      scans once, so if your group is splitting up, screenshot one per person.
    </p>
    <div style="text-align:center;">${cards}</div>`;
}

// --------------------------------------------------------------------------
// Confirmation — this email IS the ticket
// --------------------------------------------------------------------------

export async function sendConfirmationEmail(
  order: OrderRow,
  event: EventWithVenue,
  tickets: TicketRow[] = []
): Promise<void> {
  const qrUrls = await ticketQrDataUrls(tickets);
  const when = `${formatDate(event.starts_at)}, ${formatTimeRange(event.starts_at, event.ends_at)}`;
  const mapLink = event.venue.map_url
    ? `<a href="${event.venue.map_url}" style="color:#c4643c;">Get directions</a>`
    : "";

  const html = shell(`
    <h1 style="font-size:26px;line-height:1.25;margin:16px 0 4px;">You're in.</h1>
    <p style="font-size:16px;color:#4a4540;margin:0 0 24px;">
      ${order.seats} spot${order.seats === 1 ? "" : "s"} reserved for ${event.title}.
    </p>

    <div style="background:#fff;border:1px solid #e5ded4;border-radius:12px;padding:20px;">
      <table style="border-collapse:collapse;width:100%;">
        ${detailRow("Confirmation", `<span style="font-family:ui-monospace,monospace;font-size:16px;">${order.confirmation_code}</span>`)}
        ${detailRow("What", event.title)}
        ${detailRow("When", when)}
        ${detailRow("Where", `${event.venue.name}<br><span style="font-weight:400;color:#4a4540;">${event.venue.address}, ${event.venue.city}, ${event.venue.state} ${event.venue.zip}</span><br>${mapLink}`)}
        ${detailRow("Spots", String(order.seats))}
        ${detailRow("Paid", formatMoney(order.amount_cents))}
      </table>
    </div>

    ${ticketsHtml(tickets, qrUrls)}

    <p style="margin:24px 0 8px;font-size:15px;font-weight:700;">Before you come</p>
    <ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.7;color:#4a4540;">
      <li><strong>21+ only.</strong> These events are hosted at breweries and eateries that require all guests to be 21 or older. Please bring valid ID.</li>
      <li><strong>Wear something you don't mind getting paint on.</strong> We use washable acrylics, but accidents are part of it.</li>
      <li><strong>We start on time</strong> so everyone finishes together. If you're more than 15 minutes late we may not be able to catch you up.</li>
      <li><strong>Just bring yourself.</strong> We bring all the supplies and setup.</li>
    </ul>

    <p style="margin:24px 0 8px;font-size:15px;font-weight:700;">Can't make it?</p>
    <p style="margin:0;font-size:14px;line-height:1.7;color:#4a4540;">
      You can transfer your ticket to a friend any time before the event starts — just email or
      text us the new name and we'll update the guest list. No fee.
    </p>

    <p style="margin:24px 0 8px;font-size:15px;font-weight:700;">Photos</p>
    <p style="margin:0;font-size:14px;line-height:1.7;color:#4a4540;">
      We sometimes photograph our events to share on social media and promote future ones.
      If you'd rather not appear in photos, just tell your host when you arrive — no explanation needed.
    </p>

    <div style="margin:28px 0 0;padding:16px;background:#f3ede4;border-radius:12px;">
      <p style="margin:0 0 4px;font-size:14px;font-weight:700;">${POLICY_TEXT.headline}</p>
      ${policyHtml()}
      <p style="margin:12px 0 0;font-size:11px;color:#8a8278;">
        You accepted version ${order.policy_version ?? POLICY_TEXT.version} of this policy at checkout.
      </p>
    </div>

    <p style="margin:24px 0 0;font-size:14px;">
      <a href="${siteUrl()}/booked/${order.confirmation_code}"
         style="color:#c4643c;font-weight:600;">View your booking</a>
    </p>
  `);

  const ics = buildEventIcs({
    confirmationCode: order.confirmation_code,
    title: event.title,
    description: event.description,
    startsAt: event.starts_at,
    endsAt: event.ends_at,
    venueName: event.venue.name,
    venueAddress: `${event.venue.address}, ${event.venue.city}, ${event.venue.state} ${event.venue.zip}`,
    seats: order.seats,
  });

  await resend().emails.send({
    from: from(),
    to: order.email,
    replyTo: replyTo(),
    subject: `You're in — ${event.title}, ${formatDate(event.starts_at)}`,
    html,
    attachments: [
      {
        filename: "event.ics",
        content: Buffer.from(ics).toString("base64"),
      },
    ],
  });
}

// --------------------------------------------------------------------------
// T-3 day reminder — cuts no-shows
// --------------------------------------------------------------------------

export async function sendReminderEmail(
  order: OrderRow,
  event: EventWithVenue
): Promise<void> {
  const html = shell(`
    <h1 style="font-size:24px;margin:16px 0 4px;">See you ${formatDate(event.starts_at)}.</h1>
    <p style="font-size:16px;color:#4a4540;margin:0 0 20px;">
      ${event.title} · ${formatTimeRange(event.starts_at, event.ends_at)}<br>
      ${event.venue.name}, ${event.venue.address}, ${event.venue.city}
    </p>
    <ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.7;color:#4a4540;">
      <li>Bring valid ID — 21+.</li>
      <li>Wear something you don't mind getting paint on.</li>
      <li>We start on time. More than 15 minutes late and we may not be able to catch you up.</li>
    </ul>
    <p style="margin:20px 0 0;font-size:14px;line-height:1.7;color:#4a4540;">
      Can't make it after all? You can still transfer your spot to a friend — just reply with
      their name. Confirmation <strong>${order.confirmation_code}</strong>.
    </p>
  `);

  await resend().emails.send({
    from: from(),
    to: order.email,
    replyTo: replyTo(),
    subject: `Coming up: ${event.title} on ${formatDate(event.starts_at)}`,
    html,
  });
}

// --------------------------------------------------------------------------
// Venue headcount — T-1 day
// --------------------------------------------------------------------------

export async function sendVenueHeadcountEmail(params: {
  to: string;
  venueName: string;
  event: EventWithVenue;
  headcount: number;
}): Promise<void> {
  const html = shell(`
    <h1 style="font-size:22px;margin:16px 0 4px;">Headcount for tomorrow</h1>
    <p style="font-size:16px;color:#4a4540;margin:0 0 16px;">
      Hi ${params.venueName} — quick confirmation for
      <strong>${params.event.title}</strong>,
      ${formatDate(params.event.starts_at)},
      ${formatTimeRange(params.event.starts_at, params.event.ends_at)}.
    </p>
    <div style="background:#fff;border:1px solid #e5ded4;border-radius:12px;padding:20px;text-align:center;">
      <div style="font-size:40px;font-weight:700;line-height:1;">${params.headcount}</div>
      <div style="font-size:13px;color:#7a7266;margin-top:4px;">guests expected</div>
    </div>
    <p style="margin:20px 0 0;font-size:14px;line-height:1.7;color:#4a4540;">
      We bring all art supplies and handle setup and teardown. All we need is tables and
      seating for ${params.headcount}, and normal food and drink service. See you tomorrow.
    </p>
  `);

  await resend().emails.send({
    from: from(),
    to: params.to,
    replyTo: replyTo(),
    subject: `${params.headcount} guests tomorrow — ${params.event.title}`,
    html,
  });
}

// --------------------------------------------------------------------------
// A spot opened up
// --------------------------------------------------------------------------

export async function sendWaitlistOpeningEmail(params: {
  to: string;
  name: string;
  event: EventWithVenue;
  spotsLeft: number;
}): Promise<void> {
  const html = shell(`
    <h1 style="font-size:24px;margin:16px 0 4px;">A spot opened up.</h1>
    <p style="font-size:16px;color:#4a4540;margin:0 0 20px;">
      ${params.name}, there ${params.spotsLeft === 1 ? "is 1 spot" : `are ${params.spotsLeft} spots`}
      available for <strong>${params.event.title}</strong> on
      ${formatDate(params.event.starts_at)}.
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#4a4540;">
      These go quickly, and we can't hold it for you.
    </p>
    <a href="${siteUrl()}/events/${params.event.slug}"
       style="display:inline-block;background:#c4643c;color:#fff;text-decoration:none;
              padding:12px 24px;border-radius:8px;font-weight:600;font-size:15px;">
      Grab your spot
    </a>
  `);

  await resend().emails.send({
    from: from(),
    to: params.to,
    replyTo: replyTo(),
    subject: `A spot opened up — ${params.event.title}`,
    html,
  });
}

// --------------------------------------------------------------------------
// New event announcement — manual, admin-triggered. Never automatic.
// --------------------------------------------------------------------------

export async function sendNewEventAnnouncementEmail(params: {
  to: string;
  event: EventWithVenue;
}): Promise<void> {
  const { event } = params;
  const unsubscribeUrl = `${siteUrl()}/api/unsubscribe?email=${encodeURIComponent(params.to)}`;

  const html = shell(`
    <h1 style="font-size:24px;margin:16px 0 4px;">A new night just went up.</h1>
    <p style="font-size:16px;color:#4a4540;margin:0 0 20px;">
      <strong>${event.title}</strong> — ${formatDate(event.starts_at)},
      ${formatTimeRange(event.starts_at, event.ends_at)}<br>
      ${event.venue.name}, ${event.venue.city}
    </p>
    <a href="${siteUrl()}/events/${event.slug}"
       style="display:inline-block;background:#c4643c;color:#fff;text-decoration:none;
              padding:12px 24px;border-radius:8px;font-weight:600;font-size:15px;">
      Grab a spot
    </a>
    <p style="margin:24px 0 0;font-size:14px;line-height:1.7;color:#4a4540;">
      These tend to sell out — first come, first served.
    </p>
  `);

  await resend().emails.send({
    from: from(),
    to: params.to,
    replyTo: replyTo(),
    subject: `New event — ${event.title}, ${formatDate(event.starts_at)}`,
    html: html.replace(
      "</body></html>",
      `<p style="font-size:11px;color:#9a9288;margin:20px 0 0;">
         <a href="${unsubscribeUrl}" style="color:#9a9288;">Unsubscribe from event announcements</a>
       </p></body></html>`
    ),
  });
}

// --------------------------------------------------------------------------
// Internal: new private event inquiry
// --------------------------------------------------------------------------

export async function sendInquiryNotification(params: {
  name: string;
  email: string;
  phone?: string | null;
  preferredDate?: string | null;
  headcount?: number | null;
  message?: string | null;
  inquiryType?: "private" | "venue";
  venueName?: string | null;
  workshopInterest?: string | null;
}): Promise<void> {
  const isVenue = params.inquiryType === "venue";
  const heading = isVenue
    ? "New VENUE inquiry — someone wants to host"
    : "New private event inquiry";

  const html = shell(`
    <h1 style="font-size:22px;margin:16px 0 12px;">${heading}</h1>
    <table style="border-collapse:collapse;width:100%;">
      ${detailRow("Name", params.name)}
      ${isVenue ? detailRow("Venue", params.venueName || "—") : ""}
      ${detailRow("Email", `<a href="mailto:${params.email}">${params.email}</a>`)}
      ${detailRow("Phone", params.phone || "—")}
      ${!isVenue ? detailRow("Date", params.preferredDate || "—") : ""}
      ${!isVenue ? detailRow("Headcount", params.headcount ? String(params.headcount) : "—") : ""}
      ${detailRow("Workshop", params.workshopInterest || "No preference")}
    </table>
    <p style="margin:16px 0 0;font-size:14px;line-height:1.7;white-space:pre-wrap;">${params.message || ""}</p>
  `);

  await resend().emails.send({
    from: from(),
    to: BUSINESS.email,
    replyTo: params.email,
    subject: isVenue
      ? `Venue inquiry — ${params.venueName || params.name}`
      : `Private event inquiry — ${params.name}`,
    html,
  });
}
