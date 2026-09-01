import { Resend } from "resend";
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
const replyTo = () => process.env.EMAIL_REPLY_TO ?? BUSINESS.contactEmail;

// --------------------------------------------------------------------------
// Shared chrome
// --------------------------------------------------------------------------

/**
 * Every outbound email is wrapped in this.
 *
 * Dark masthead, light body. The site is midnight throughout, but a fully dark
 * email is a gamble — Outlook desktop drops gradients and Android Gmail will
 * sometimes force-invert the whole thing. So the brand lives in the header,
 * the accent rule and the buttons, and the part people actually have to read
 * sits on white where every client renders it the same way.
 *
 * Tables, not flexbox: Outlook renders through Word's engine and does not do
 * modern layout. Anton and Montserrat will not load in most clients either —
 * the fallbacks carry it, which is why the treatment (uppercase, tracking,
 * weight) does the work rather than the face.
 */
function shell(bodyHtml: string): string {
  const sans = "Montserrat,'Helvetica Neue',Helvetica,Arial,sans-serif";
  const display = "Anton,'Arial Narrow',Impact,Haettenschweiler,sans-serif";

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
</head>
<body style="margin:0;padding:0;background:#E9E6F0;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#E9E6F0;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;background:#FFFFFF;">

          <tr>
            <td style="background:#08070F;padding:24px 32px;">
              <span style="font-family:${display};font-size:26px;letter-spacing:.05em;text-transform:uppercase;color:#F4F1FA;">Make in <span style="color:#FF2E88;">Motion</span></span>
            </td>
          </tr>
          <tr>
            <td style="background:#22E0FF;height:4px;line-height:4px;font-size:0;">&nbsp;</td>
          </tr>

          <tr>
            <td style="padding:32px;font-family:${sans};font-size:16px;line-height:1.65;color:#2C2838;">
              ${bodyHtml}
            </td>
          </tr>

          <tr>
            <td style="background:#08070F;padding:24px 32px;font-family:${sans};font-size:12px;line-height:1.7;color:#9C97AC;">
              Questions? Reply to this email, or reach us at
              <a href="mailto:${BUSINESS.contactEmail}" style="color:#22E0FF;text-decoration:none;">${BUSINESS.contactEmail}</a>
              or <a href="${BUSINESS.phoneHref}" style="color:#22E0FF;text-decoration:none;">${BUSINESS.phone}</a>.
              <br><br>
              <span style="color:#6F6A80;">${BUSINESS.name} · ${BUSINESS.domain}</span>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** The one call to action in an email. Midnight on pink — never white on pink. */
function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 0;">
    <tr>
      <td style="background:#FF2E88;">
        <a href="${href}" style="display:inline-block;padding:14px 26px;font-family:Montserrat,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#08070F;text-decoration:none;">${label}</a>
      </td>
    </tr>
  </table>`;
}

/** Eyebrow label. Cyan is illegible on white, so labels use the deep teal. */
function eyebrow(text: string): string {
  return `<p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:#0E7C93;">${text}</p>`;
}

function detailRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:9px 18px 9px 0;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#0E7C93;vertical-align:top;white-space:nowrap;">${label}</td>
    <td style="padding:9px 0;font-size:15px;font-weight:600;color:#171522;">${value}</td>
  </tr>`;
}

function policyHtml(): string {
  return POLICY_TEXT.sections
    .map(
      (s) => `<p style="margin:12px 0 4px;font-size:13px;font-weight:700;">${s.heading}</p>` +
        s.body
          .map(
            (b) =>
              `<p style="margin:0 0 6px;font-size:13px;line-height:1.6;color:#3A3548;">${b}</p>`
          )
          .join("")
    )
    .join("");
}

// --------------------------------------------------------------------------
// Door codes — one QR per seat, so check-in never depends on a name
// --------------------------------------------------------------------------

/**
 * One hosted QR URL per ticket.
 *
 * These used to be inlined as data: URIs. Apple Mail renders those, but Gmail
 * and Outlook strip them — so most guests opened the email to a broken image
 * where their door code should have been. CID attachments fail in Gmail too.
 * A plain https image is the only form every client will draw, which is why
 * this points at /api/ticket-qr/<code>.png instead of embedding bytes.
 *
 * If the image is blocked or fails to load, ticketsHtml() still prints the
 * code as text underneath, so check-in never depends on the picture.
 */
function ticketQrUrls(tickets: TicketRow[]): Map<string, string> {
  const urls = new Map<string, string>();
  for (const t of tickets) {
    urls.set(t.id, `${siteUrl()}/api/ticket-qr/${encodeURIComponent(t.code)}.png`);
  }
  return urls;
}

function ticketsHtml(tickets: TicketRow[], qrUrls: Map<string, string>): string {
  if (tickets.length === 0) return "";

  const cards = tickets
    .map((t) => {
      const qr = qrUrls.get(t.id);
      const img = qr
        ? `<img src="${qr}" width="132" height="132" alt="QR code for check-in code ${t.code}" style="display:block;border:0;">`
        : "";
      return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 12px;border:2px solid #08070F;">
        <tr>
          <td width="152" style="padding:10px;background:#FFFFFF;vertical-align:middle;">${img}</td>
          <td style="padding:14px 16px;vertical-align:middle;font-family:Montserrat,'Helvetica Neue',Helvetica,Arial,sans-serif;">
            <div style="font-size:10px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:#0E7C93;">Seat ${t.seat_number} of ${tickets.length}</div>
            <div style="margin-top:8px;font-size:10px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:#6B6577;">Check-in code</div>
            <div style="margin-top:2px;font-family:ui-monospace,'SFMono-Regular',Menlo,Consolas,monospace;font-size:22px;font-weight:700;letter-spacing:.08em;color:#171522;">${t.code}</div>
            <div style="margin-top:8px;font-size:11px;color:#8B8598;">Ticket ${t.ticket_number}</div>
          </td>
        </tr>
      </table>`;
    })
    .join("");

  return `
    <p style="margin:28px 0 6px;font-family:Anton,'Arial Narrow',Impact,Haettenschweiler,sans-serif;font-size:22px;letter-spacing:.02em;text-transform:uppercase;color:#171522;">Your door codes</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#6B6577;">
      One code per seat. Show it at check-in — the code is what gets scanned, so the
      picture is only there to make it quick. Each one works once, so if your group is
      arriving separately, send everyone their own.
    </p>
    ${cards}`;
}

// --------------------------------------------------------------------------
// Internal: a booking just came in
// --------------------------------------------------------------------------

/**
 * One-line heads-up sent on every confirmed booking, from both the Stripe
 * webhook and admin manual orders (anywhere sendConfirmationEmail is called).
 * Best-effort — a failure here must never take down the customer's ticket
 * email, which is why the caller swallows its own errors.
 */
async function sendSaleNotification(
  order: OrderRow,
  event: EventWithVenue
): Promise<void> {
  const html = shell(`
    <h1 style="font-size:22px;margin:16px 0 12px;">New sale</h1>
    <table style="border-collapse:collapse;width:100%;">
      ${detailRow("Workshop", event.title)}
      ${detailRow("Date", formatDate(event.starts_at))}
      ${detailRow("Amount paid", formatMoney(order.amount_cents))}
      ${detailRow("Confirmation", order.confirmation_code)}
    </table>
  `);

  await resend().emails.send({
    from: from(),
    to: "madrazodarcy@gmail.com",
    replyTo: BUSINESS.bookingEmail,
    subject: `New sale — ${event.title}, ${formatMoney(order.amount_cents)}`,
    html,
  });
}

// --------------------------------------------------------------------------
// Confirmation — this email IS the ticket
// --------------------------------------------------------------------------

export async function sendConfirmationEmail(
  order: OrderRow,
  event: EventWithVenue,
  tickets: TicketRow[] = []
): Promise<void> {
  const qrUrls = ticketQrUrls(tickets);
  const when = `${formatDate(event.starts_at)}, ${formatTimeRange(event.starts_at, event.ends_at)}`;
  const mapLink = event.venue.map_url
    ? `<a href="${event.venue.map_url}" style="color:#FF2E88;">Get directions</a>`
    : "";

  const html = shell(`
    <h1 style="font-family:Anton,'Arial Narrow',Impact,Haettenschweiler,sans-serif;font-size:42px;line-height:1;letter-spacing:.01em;text-transform:uppercase;margin:0 0 10px;color:#171522;">You're in.</h1>
    <p style="font-size:16px;color:#3A3548;margin:0 0 24px;">
      ${order.seats} spot${order.seats === 1 ? "" : "s"} reserved for ${event.title}.
    </p>

    <div style="background:#fff;border:1px solid #E3DFEA;border-radius:12px;padding:20px;">
      <table style="border-collapse:collapse;width:100%;">
        ${detailRow("Confirmation", `<span style="font-family:ui-monospace,monospace;font-size:16px;">${order.confirmation_code}</span>`)}
        ${detailRow("What", event.title)}
        ${detailRow("When", when)}
        ${detailRow("Where", `${event.venue.name}<br><span style="font-weight:400;color:#3A3548;">${event.venue.address}, ${event.venue.city}, ${event.venue.state} ${event.venue.zip}</span><br>${mapLink}`)}
        ${detailRow("Spots", String(order.seats))}
        ${detailRow("Paid", formatMoney(order.amount_cents))}
      </table>
    </div>

    ${ticketsHtml(tickets, qrUrls)}

    <p style="margin:28px 0 8px;font-family:Anton,'Arial Narrow',Impact,Haettenschweiler,sans-serif;font-size:20px;letter-spacing:.02em;text-transform:uppercase;color:#171522;">Before you come</p>
    <ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.7;color:#3A3548;">
      <li><strong>Your ticket includes a drink chip.</strong> Use it at the bar — beer, cocktail, or a mocktail if you're not drinking.</li>
      <li><strong>Age policy is set by ${event.venue.name}.</strong> Check with them if you're unsure, and bring valid ID just in case.</li>
      <li><strong>Wear something you don't mind getting messy.</strong> Depending on the project that's paint, dye, ink, wax or soil. We bring aprons, but accidents are part of it.</li>
      <li><strong>We start on time</strong> so everyone finishes together. If you're more than 15 minutes late we may not be able to catch you up.</li>
      <li><strong>Just bring yourself.</strong> We bring all the supplies and setup.</li>
    </ul>

    <p style="margin:28px 0 8px;font-family:Anton,'Arial Narrow',Impact,Haettenschweiler,sans-serif;font-size:20px;letter-spacing:.02em;text-transform:uppercase;color:#171522;">Can't make it?</p>
    <p style="margin:0;font-size:14px;line-height:1.7;color:#3A3548;">
      You can transfer your ticket to a friend any time before the event starts — just send them
      the ticket. Whoever brings it gets in. No fee, and nothing you need to tell us.
    </p>

    <p style="margin:28px 0 8px;font-family:Anton,'Arial Narrow',Impact,Haettenschweiler,sans-serif;font-size:20px;letter-spacing:.02em;text-transform:uppercase;color:#171522;">Photos</p>
    <p style="margin:0;font-size:14px;line-height:1.7;color:#3A3548;">
      We sometimes photograph our events to share on social media and promote future ones.
      If you'd rather not appear in photos, just tell your host when you arrive — no explanation needed.
    </p>

    <div style="margin:28px 0 0;padding:16px;background:#F4F1FA;border-radius:12px;">
      <p style="margin:0 0 4px;font-size:14px;font-weight:700;">${POLICY_TEXT.headline}</p>
      ${policyHtml()}
      <p style="margin:12px 0 0;font-size:11px;color:#8B8598;">
        You accepted version ${order.policy_version ?? POLICY_TEXT.version} of this policy at checkout.
      </p>
    </div>

    ${button(`${siteUrl()}/booked/${order.confirmation_code}`, "View your booking")}
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

  try {
    await sendSaleNotification(order, event);
  } catch (err) {
    console.error(`[email] sale notification failed for ${order.confirmation_code}`, err);
  }
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
    <p style="font-size:16px;color:#3A3548;margin:0 0 20px;">
      ${event.title} · ${formatTimeRange(event.starts_at, event.ends_at)}<br>
      ${event.venue.name}, ${event.venue.address}, ${event.venue.city}
    </p>
    <ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.7;color:#3A3548;">
      <li>Age policy is set by ${event.venue.name} — bring valid ID just in case.</li>
      <li>Wear something you don't mind getting messy.</li>
      <li>We start on time. More than 15 minutes late and we may not be able to catch you up.</li>
    </ul>
    <p style="margin:20px 0 0;font-size:14px;line-height:1.7;color:#3A3548;">
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
    <p style="font-size:16px;color:#3A3548;margin:0 0 16px;">
      Hi ${params.venueName} — quick confirmation for
      <strong>${params.event.title}</strong>,
      ${formatDate(params.event.starts_at)},
      ${formatTimeRange(params.event.starts_at, params.event.ends_at)}.
    </p>
    <div style="background:#fff;border:1px solid #E3DFEA;border-radius:12px;padding:20px;text-align:center;">
      <div style="font-size:40px;font-weight:700;line-height:1;">${params.headcount}</div>
      <div style="font-size:13px;color:#6B6577;margin-top:4px;">guests expected</div>
    </div>
    <p style="margin:20px 0 0;font-size:14px;line-height:1.7;color:#3A3548;">
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
    <p style="font-size:16px;color:#3A3548;margin:0 0 20px;">
      ${params.name}, there ${params.spotsLeft === 1 ? "is 1 spot" : `are ${params.spotsLeft} spots`}
      available for <strong>${params.event.title}</strong> on
      ${formatDate(params.event.starts_at)}.
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#3A3548;">
      These go quickly, and we can't hold it for you.
    </p>
    <a href="${siteUrl()}/events/${params.event.slug}"
       style="display:inline-block;background:#FF2E88;color:#fff;text-decoration:none;
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
    <p style="font-size:16px;color:#3A3548;margin:0 0 20px;">
      <strong>${event.title}</strong> — ${formatDate(event.starts_at)},
      ${formatTimeRange(event.starts_at, event.ends_at)}<br>
      ${event.venue.name}, ${event.venue.city}
    </p>
    <a href="${siteUrl()}/events/${event.slug}"
       style="display:inline-block;background:#FF2E88;color:#fff;text-decoration:none;
              padding:12px 24px;border-radius:8px;font-weight:600;font-size:15px;">
      Grab a spot
    </a>
    <p style="margin:24px 0 0;font-size:14px;line-height:1.7;color:#3A3548;">
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
