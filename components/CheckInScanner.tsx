"use client";

import { useEffect, useRef, useState } from "react";
import type { CheckInResult } from "@/lib/types";

type ScanLogEntry =
  | (CheckInResult & { code: string; at: number })
  | { ok: false; reason: "network_error"; code: string; at: number };

/**
 * A cheap USB/BT QR scanner is a keyboard in disguise: it "types" the decoded
 * text into whatever has focus, then sends Enter. So the whole UI is just a
 * form that never loses focus and a log of what came through.
 */
export function CheckInScanner() {
  const [code, setCode] = useState("");
  const [log, setLog] = useState<ScanLogEntry[]>([]);
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const scanned = code.trim();
    if (!scanned || pending) return;

    setCode("");
    setPending(true);
    try {
      const res = await fetch("/api/admin/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: scanned }),
      });
      const result = (await res.json()) as CheckInResult;
      const entry = { ...result, code: scanned, at: Date.now() } as ScanLogEntry;
      setLog((l) => [entry, ...l].slice(0, 25));
    } catch {
      const entry: ScanLogEntry = {
        ok: false,
        reason: "network_error",
        code: scanned,
        at: Date.now(),
      };
      setLog((l) => [entry, ...l].slice(0, 25));
    } finally {
      setPending(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div>
      <form onSubmit={submit}>
        <input
          ref={inputRef}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onBlur={() => inputRef.current?.focus()}
          placeholder="Scan or type a code, then Enter"
          autoComplete="off"
          className="w-full rounded-xl border-2 border-white/15 bg-surface px-4 py-4 text-center
                     text-2xl font-mono uppercase tracking-[0.15em] focus:border-clay
                     focus:outline-none focus:ring-2 focus:ring-clay/20"
        />
      </form>

      <div className="mt-6 space-y-2">
        {log.map((entry, i) => (
          <ScanRow key={`${entry.at}-${i}`} entry={entry} />
        ))}
        {log.length === 0 && (
          <p className="text-center text-sm text-ink/50">Waiting for the first scan.</p>
        )}
      </div>
    </div>
  );
}

function ScanRow({ entry }: { entry: ScanLogEntry }) {
  if (entry.ok) {
    return (
      <div className="rounded-xl border border-sage/30 bg-sage/10 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="font-bold text-sage">✓ {entry.guest_name}</span>
          <span className="font-mono text-xs text-ink/50">{entry.code}</span>
        </div>
        <div className="mt-0.5 text-xs text-ink/60">
          Seat {entry.seat_number} of {entry.seats_total}
        </div>
      </div>
    );
  }

  const message =
    entry.reason === "already_used"
      ? `Already scanned — ${entry.guest_name}, seat ${entry.seat_number} of ${entry.seats_total}`
      : entry.reason === "order_cancelled"
        ? `Refunded/cancelled order — ${entry.guest_name ?? "unknown"}`
        : entry.reason === "network_error"
          ? "Connection dropped — try again"
          : "Code not recognized";

  return (
    <div className="rounded-xl border border-clay/30 bg-clay/10 px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="font-bold text-clay">✗ {message}</span>
        <span className="font-mono text-xs text-ink/50">{entry.code}</span>
      </div>
    </div>
  );
}
