import { BUSINESS, siteUrl } from "./config";

/** RFC 5545 UTC stamp: 20260903T230000Z */
function stamp(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Fold long lines at 75 octets, as the spec requires. */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 74) {
    parts.push(" " + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  if (rest) parts.push(" " + rest);
  return parts.join("\r\n");
}

function escape(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/**
 * Calendar invite for a booking. Times are emitted in UTC, so the guest's own
 * calendar renders them in whatever zone they're in — which is the correct
 * behaviour even though the event is always Eastern.
 */
export function buildEventIcs(params: {
  confirmationCode: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  venueName: string;
  venueAddress: string;
  seats: number;
}): string {
  const location = `${params.venueName}, ${params.venueAddress}`;
  const description = [
    params.description,
    "",
    `${params.seats} spot${params.seats === 1 ? "" : "s"} reserved.`,
    `Confirmation: ${params.confirmationCode}`,
    "21+ — please bring valid ID.",
    "Wear something you don't mind getting messy.",
    "",
    `Questions: ${BUSINESS.email} or ${BUSINESS.phone}`,
  ].join("\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${BUSINESS.name}//Booking//EN`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${params.confirmationCode}@${BUSINESS.domain}`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(params.startsAt)}`,
    `DTEND:${stamp(params.endsAt)}`,
    fold(`SUMMARY:${escape(params.title)}`),
    fold(`DESCRIPTION:${escape(description)}`),
    fold(`LOCATION:${escape(location)}`),
    fold(`URL:${siteUrl()}/booked/${params.confirmationCode}`),
    "STATUS:CONFIRMED",
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    fold(`DESCRIPTION:${escape(params.title)} starts in 2 hours`),
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.join("\r\n");
}
