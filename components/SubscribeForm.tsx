"use client";

import { useState } from "react";

/**
 * For the majority of visitors who are browsing at work and won't buy today.
 * This list is worth more than the software. Plan §16 item 9.
 */
export function SubscribeForm({ source = "homepage" }: { source?: string }) {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  if (done) {
    return (
      <p className="text-sm font-medium text-sage">
        Got it — we'll keep you posted.
      </p>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, source }),
    });
    if (res.ok) setDone(true);
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2">
      <input
        required
        type="email"
        placeholder="you@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="flex-1 rounded-lg border border-white/15 bg-surface px-3 py-2.5 text-[16px]
                   focus:border-clay focus:outline-none focus:ring-2 focus:ring-clay/20"
      />
      <button
        disabled={busy}
        className="whitespace-nowrap rounded-lg bg-sage px-5 py-2.5 font-bold uppercase
                   tracking-wide text-paper shadow-neon-cyan transition-all
                   hover:bg-sage/85 disabled:opacity-40 disabled:shadow-none"
      >
        {busy ? "…" : "Notify me"}
      </button>
      <p className="w-full text-xs leading-relaxed text-ink/45 sm:mt-1">
        Occasional emails about new events and things going on — no spam,
        unsubscribe anytime.
      </p>
    </form>
  );
}
