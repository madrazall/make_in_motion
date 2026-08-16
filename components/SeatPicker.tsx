"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/format";

/**
 * The booking form.
 *
 * Two things this deliberately does NOT do:
 *  - send a price (the server recomputes it from the event record)
 *  - enable the pay button before the policy checkbox is ticked
 */
export function SeatPicker({
  eventId,
  priceCents,
  maxSeats,
}: {
  eventId: string;
  priceCents: number;
  maxSeats: number;
}) {
  const [seats, setSeats] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const total = priceCents * seats;
  const canSubmit = accepted && !submitting && name.trim() && email.trim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          seats,
          name,
          email,
          phone,
          policyAccepted: accepted,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        // Someone took seats while this form was open — reflect reality.
        if (typeof data.spotsLeft === "number" && data.spotsLeft > 0) {
          setSeats(Math.min(seats, data.spotsLeft));
        }
        setSubmitting(false);
        return;
      }

      window.location.href = data.url;
    } catch {
      setError("We couldn't reach the server. Please check your connection and try again.");
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-white/15 bg-surface px-3 py-2.5 text-[16px] " +
    "focus:border-clay focus:outline-none focus:ring-2 focus:ring-clay/20";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="seats" className="block text-sm font-semibold mb-1.5">
          How many spots?
        </label>
        <select
          id="seats"
          value={seats}
          onChange={(e) => setSeats(Number(e.target.value))}
          className={inputClass}
        >
          {Array.from({ length: maxSeats }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? "spot" : "spots"} — {formatMoney(priceCents * n)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="name" className="block text-sm font-semibold mb-1.5">
          Your name
        </label>
        <input
          id="name"
          required
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-semibold mb-1.5">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
        <p className="mt-1 text-xs text-ink/55">
          Your confirmation goes here — this is your ticket.
        </p>
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm font-semibold mb-1.5">
          Phone <span className="font-normal text-ink/50">(optional)</span>
        </label>
        <input
          id="phone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className={inputClass}
        />
      </div>

      <label className="flex gap-3 items-start cursor-pointer rounded-lg bg-white/[0.03] p-3">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-clay"
        />
        <span className="text-sm leading-relaxed">
          I understand the{" "}
          <a
            href="/faq#refunds"
            target="_blank"
            rel="noopener noreferrer"
            className="text-clay underline underline-offset-2"
          >
            refund and cancellation policy
          </a>
          .
        </span>
      </label>

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-clay/10 px-3 py-2.5 text-sm text-clay"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded-lg bg-clay px-5 py-3.5 text-white font-bold uppercase tracking-wide shadow-neon-pink
                   disabled:opacity-40 disabled:cursor-not-allowed hover:bg-clay/90
                   transition-colors"
      >
        {submitting ? "Taking you to checkout…" : `Reserve & pay — ${formatMoney(total)}`}
      </button>

      <p className="text-center text-xs text-ink/50">
        Secure checkout by Stripe. Your spot is held for 30 minutes.
      </p>
    </form>
  );
}
