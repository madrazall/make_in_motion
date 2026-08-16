"use client";

import { useState } from "react";

/**
 * One form, two audiences.
 *
 * "private" — a guest booking a group. Wants a date and a headcount.
 * "venue"   — a bar or restaurant considering hosting. Wants to know what it
 *             costs them, and which night they'd try it on.
 */
export function InquiryForm({
  variant = "private",
  workshops = [],
}: {
  variant?: "private" | "venue";
  workshops?: { slug: string; name: string }[];
}) {
  const isVenue = variant === "venue";

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    venueName: "",
    preferredDate: "",
    headcount: "",
    workshopInterest: "",
    message: "",
  });
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (done) {
    return (
      <div className="rounded-xl bg-sage/10 p-6">
        <p className="font-bold text-sage">Got it.</p>
        <p className="mt-1.5 text-[15px] text-ink/80">
          {isVenue
            ? "We'll be in touch within a day or two with dates and how the split works. If it's easier to just talk, call or text."
            : "We'll get back to you within a day or two with options and pricing. If it's time-sensitive, just call or text."}
        </p>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/inquiry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, inquiryType: variant }),
    });
    if (res.ok) setDone(true);
    else setError((await res.json()).error ?? "Something went wrong.");
    setBusy(false);
  }

  const input =
    "w-full rounded-lg border border-white/15 bg-surface px-3 py-2.5 text-[16px] " +
    "focus:border-clay focus:outline-none focus:ring-2 focus:ring-clay/20";

  const set =
    (k: keyof typeof form) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >
    ) =>
      setForm({ ...form, [k]: e.target.value });

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" required>
          <input required value={form.name} onChange={set("name")} className={input} />
        </Field>
        <Field label="Email" required>
          <input
            required
            type="email"
            value={form.email}
            onChange={set("email")}
            className={input}
          />
        </Field>

        {isVenue && (
          <Field label="Venue name" required>
            <input
              required
              value={form.venueName}
              onChange={set("venueName")}
              className={input}
            />
          </Field>
        )}

        <Field label="Phone" hint="optional">
          <input type="tel" value={form.phone} onChange={set("phone")} className={input} />
        </Field>

        {!isVenue && (
          <Field label="Date you have in mind" hint="optional">
            <input
              type="date"
              value={form.preferredDate}
              onChange={set("preferredDate")}
              className={input}
            />
          </Field>
        )}
      </div>

      {!isVenue && (
        <Field label="Roughly how many people?" hint="optional">
          <input
            type="number"
            min={1}
            value={form.headcount}
            onChange={set("headcount")}
            className={input}
          />
        </Field>
      )}

      {workshops.length > 0 && (
        <Field
          label={isVenue ? "Any workshop in particular?" : "Which workshop?"}
          hint="optional"
        >
          <select
            value={form.workshopInterest}
            onChange={set("workshopInterest")}
            className={input}
          >
            <option value="">
              {isVenue ? "Not sure — recommend something" : "Open to suggestions"}
            </option>
            {workshops.map((w) => (
              <option key={w.slug} value={w.slug}>
                {w.name}
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field label={isVenue ? "Tell us about your space" : "What's the occasion?"}>
        <textarea
          rows={4}
          value={form.message}
          onChange={set("message")}
          placeholder={
            isVenue
              ? "Roughly how many people can you seat? Which nights are slow for you? Anything we should know about the room?"
              : "Birthday, team night, something else. Venue in mind? Anything we should know?"
          }
          className={input}
        />
      </Field>

      {error && <p className="text-sm text-clay">{error}</p>}

      <button
        disabled={busy}
        className="rounded-lg bg-clay px-6 py-3 font-bold uppercase tracking-wide text-white shadow-neon-pink
                   disabled:opacity-40 hover:bg-clay/90 transition-colors"
      >
        {busy ? "Sending…" : isVenue ? "Start the conversation" : "Send inquiry"}
      </button>
    </form>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold mb-1.5">
        {label}
        {hint && <span className="font-normal text-ink/50"> ({hint})</span>}
        {required && <span className="sr-only"> required</span>}
      </span>
      {children}
    </label>
  );
}
