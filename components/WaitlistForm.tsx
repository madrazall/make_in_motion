"use client";

import { useState } from "react";

export function WaitlistForm({ eventId }: { eventId: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [seats, setSeats] = useState(1);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (done) {
    return (
      <div className="rounded-lg bg-sage/10 p-4 text-sm text-sage">
        <strong className="font-semibold">You're on the list.</strong> We'll email you
        the moment a spot opens up. Refunds and transfers happen more often than
        you'd think.
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, name, email, seats }),
    });
    if (res.ok) setDone(true);
    else setError((await res.json()).error ?? "Something went wrong.");
    setBusy(false);
  }

  const inputClass =
    "w-full rounded-lg border border-white/15 bg-surface px-3 py-2.5 text-[16px] " +
    "focus:border-clay focus:outline-none focus:ring-2 focus:ring-clay/20";

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm text-ink/70">
        This one's full. Add your name and we'll email you if a spot frees up.
      </p>
      <input
        required
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className={inputClass}
      />
      <input
        required
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={inputClass}
      />
      <select
        value={seats}
        onChange={(e) => setSeats(Number(e.target.value))}
        className={inputClass}
      >
        {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
          <option key={n} value={n}>
            {n} {n === 1 ? "spot" : "spots"} wanted
          </option>
        ))}
      </select>
      {error && <p className="text-sm text-clay">{error}</p>}
      <button
        disabled={busy}
        className="w-full rounded-lg border-2 border-clay px-5 py-3 font-semibold
                   text-clay disabled:opacity-40 hover:bg-clay hover:text-white transition-colors"
      >
        {busy ? "Adding you…" : "Join the waitlist"}
      </button>
    </form>
  );
}
