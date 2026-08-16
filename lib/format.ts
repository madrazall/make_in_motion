import { TIMEZONE } from "./config";

/**
 * Everything stored is UTC. Everything displayed is Eastern.
 * These helpers are the only place that conversion happens.
 * Intl handles daylight saving, which matters for March and November events.
 */

export function formatDate(iso: string | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(iso));
}

export function formatDateShort(iso: string | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

export function formatTime(iso: string | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
  })
    .format(new Date(iso))
    .replace(" AM", "am")
    .replace(" PM", "pm");
}

export function formatTimeRange(startIso: string, endIso: string): string {
  return `${formatTime(startIso)}–${formatTime(endIso)}`;
}

export function formatDateTime(iso: string | Date): string {
  return `${formatDate(iso)} at ${formatTime(iso)}`;
}

export function formatMoney(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars)
    ? `$${dollars}`
    : `$${dollars.toFixed(2)}`;
}

/** e.g. "in 12 days" / "tomorrow" — for admin lists. */
export function relativeDays(iso: string, now = new Date()): string {
  const diffMs = new Date(iso).getTime() - now.getTime();
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (days < 0) return `${Math.abs(days)} days ago`;
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}
