"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/format";
import {
  BUSINESS,
  MAX_SEATS_PER_ORDER,
  PAYMENT_HANDLES,
  venmoUrl,
  cashAppUrl,
  instagramUrl,
} from "@/lib/config";

/**
 * Booking without card checkout: pay by Venmo or CashApp, then email to get on
 * the list.
 *
 * The failure mode this is designed around: someone pays and never sends the
 * email, leaving money from a username with no name and no ticket count
 * attached. Two defences —
 *
 *   1. the payment note carries the name and quantity, so the money itself is
 *      self-identifying even if step two never happens
 *   2. the email is a prefilled mailto with everything already written, so
 *      step two costs one tap and a name
 */
export function ManualBooking({
  eventTitle,
  eventWhen,
  priceCents,
  maxSeats,
}: {
  eventTitle: string;
  eventWhen: string;
  priceCents: number;
  maxSeats: number;
}) {
  const [seats, setSeats] = useState(1);
  const total = priceCents * seats;

  const subject = `Sign me up — ${eventTitle}, ${eventWhen}`;
  const body = [
    `Event: ${eventTitle}`,
    `Date: ${eventWhen}`,
    `Spots: ${seats}`,
    ``,
    `Name: `,
    `Venmo / CashApp handle: `,
    `Amount sent: ${formatMoney(total)}`,
    ``,
    `(I've sent payment — please confirm I'm on the list.)`,
  ].join("\n");

  const mailto =
    `mailto:${BUSINESS.email}` +
    `?subject=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`;

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="seats" className="mb-1.5 block text-sm font-semibold">
          How many spots?
        </label>
        <select
          id="seats"
          value={seats}
          onChange={(e) => setSeats(Number(e.target.value))}
          className="field"
        >
          {Array.from({ length: Math.min(maxSeats, MAX_SEATS_PER_ORDER) },
            (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? "spot" : "spots"} — {formatMoney(priceCents * n)}
            </option>
          ))}
        </select>
      </div>

      {/* ------------------------------------------------------------ step 1 */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-baseline gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-clay text-xs font-bold text-paper">
            1
          </span>
          <p className="font-bold">
            Send {formatMoney(total)}
          </p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <a
            href={venmoUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border-2 border-sage/60 px-3 py-2.5 text-center text-sm font-bold
                       uppercase tracking-wide text-sage transition-all hover:bg-sage hover:text-paper"
          >
            Venmo
          </a>
          <a
            href={cashAppUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border-2 border-sage/60 px-3 py-2.5 text-center text-sm font-bold
                       uppercase tracking-wide text-sage transition-all hover:bg-sage hover:text-paper"
          >
            CashApp
          </a>
        </div>

        <p className="mt-2.5 text-xs text-ink/55">
          @{PAYMENT_HANDLES.venmo} · ${PAYMENT_HANDLES.cashapp}
        </p>

        <p className="mt-3 rounded-lg bg-clay/10 px-3 py-2 text-[13px] leading-relaxed text-ink/85">
          <strong className="text-clay">Put your name and “{seats} spot
          {seats === 1 ? "" : "s"}” in the payment note.</strong>{" "}
          It&apos;s how we match your money to you.
        </p>
      </div>

      {/* ------------------------------------------------------------ step 2 */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-baseline gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-clay text-xs font-bold text-paper">
            2
          </span>
          <p className="font-bold">Email us to get on the list</p>
        </div>

        <p className="mt-2 text-[13px] leading-relaxed text-ink/70">
          Tap below — it fills in the event, the date and the number of spots.
          Add your name and your payment handle, and send.
        </p>

        <a href={mailto} className="btn-primary mt-3 block text-center text-[15px]">
          Email to claim {seats} spot{seats === 1 ? "" : "s"}
        </a>

        {/* Most of this audience arrives from Instagram and would rather DM. */}
        <a
          href={instagramUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 block rounded-lg border-2 border-sage/50 px-4 py-2.5 text-center
                     text-sm font-bold uppercase tracking-wide text-sage transition-all
                     hover:bg-sage hover:text-paper"
        >
          Or DM @{PAYMENT_HANDLES.instagram}
        </a>

        <p className="mt-2.5 text-center text-xs text-ink/50">
          Either works —{" "}
          <a href={`mailto:${BUSINESS.email}`} className="text-clay underline underline-offset-2">
            {BUSINESS.email}
          </a>
        </p>
      </div>

      <p className="text-center text-xs leading-relaxed text-ink/55">
        We reply to every email to confirm your spot — usually the same day.
        Nothing is reserved until you hear back from us.{" "}
        <a href="/faq#refunds" className="text-clay underline underline-offset-2">
          Refund policy
        </a>
      </p>
    </div>
  );
}
