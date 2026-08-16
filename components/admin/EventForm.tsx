"use client";

import { useState } from "react";
import Link from "next/link";
import { createEvent } from "@/app/admin/actions";
import { DEFAULT_MIN_TO_RUN } from "@/lib/config";
import type { Workshop } from "@/lib/workshops";

/**
 * Create an event by picking a workshop and a date.
 *
 * The point: choosing a workshop fills in the title, description, price,
 * capacity and inclusions from the catalogue, and setting the start time works
 * out the end time from that workshop's duration. Everything stays editable —
 * it's a starting point, not a lock.
 *
 * A repeat booking should take four fields and about twenty seconds.
 */
export function EventForm({
  venues,
  workshops,
}: {
  venues: { id: string; name: string; city: string }[];
  workshops: Workshop[];
}) {
  const [workshopId, setWorkshopId] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    capacity: 20,
    min_to_run: DEFAULT_MIN_TO_RUN,
    price: 45,
    whats_included: "Art supplies & setup. Instruction & facilitation.",
    what_to_bring: "Just yourself.",
    image_url: "",
    starts_at: "",
    ends_at: "",
  });

  const chosen = workshops.find((w) => w.id === workshopId);

  function pickWorkshop(id: string) {
    setWorkshopId(id);
    const w = workshops.find((x) => x.id === id);
    if (!w) return;

    setForm((f) => ({
      ...f,
      title: w.name,
      description: w.description,
      capacity: w.max_group,
      min_to_run: Math.min(w.min_group, w.max_group),
      price: w.base_price_cents / 100,
      whats_included: w.what_you_make
        ? "Art supplies & setup. Instruction & facilitation."
        : f.whats_included,
      image_url: w.image_url ?? "",
      ends_at: f.starts_at ? addMinutes(f.starts_at, w.duration_minutes) : f.ends_at,
    }));
  }

  function pickStart(value: string) {
    setForm((f) => ({
      ...f,
      starts_at: value,
      // Only auto-fill the end time; never overwrite one you've set by hand.
      ends_at:
        chosen && value ? addMinutes(value, chosen.duration_minutes) : f.ends_at,
    }));
  }

  const noVenues = venues.length === 0;

  return (
    <form action={createEvent} className="mt-6 space-y-5">
      <input type="hidden" name="workshop_id" value={workshopId} />

      {/* --------------------------------------------------------- workshop */}
      <div className="rounded-xl border border-sage/25 bg-sage/[0.06] p-4">
        <Field label="Start with a workshop" hint="fills everything below in">
          <select
            value={workshopId}
            onChange={(e) => pickWorkshop(e.target.value)}
            className="field"
          >
            <option value="">Choose one…</option>
            {workshops.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} — ${w.base_price_cents / 100}, {w.duration_minutes} min
              </option>
            ))}
          </select>
        </Field>
        {chosen && (
          <p className="mt-2 text-xs text-sage">
            Filled in from the catalogue. Change anything you like below — it only
            affects this one event.
          </p>
        )}
      </div>

      {/* ------------------------------------------------------------ venue */}
      {noVenues ? (
        <div className="rounded-xl border-2 border-clay/30 bg-clay/5 p-4 text-sm">
          <strong className="text-clay">No venues yet.</strong>{" "}
          <Link href="/admin/venues" className="text-clay underline underline-offset-2">
            Add your first venue
          </Link>{" "}
          — takes a minute, then come back here.
        </div>
      ) : (
        <Field label="Venue">
          <select name="venue_id" required className="field">
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} — {v.city}
              </option>
            ))}
          </select>
          <Link
            href="/admin/venues"
            className="mt-1.5 inline-block text-xs text-clay underline underline-offset-2"
          >
            + add a new venue
          </Link>
        </Field>
      )}

      {/* ------------------------------------------------------------- when */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Starts" hint="Eastern">
          <input
            type="datetime-local"
            name="starts_at"
            required
            value={form.starts_at}
            onChange={(e) => pickStart(e.target.value)}
            className="field"
          />
        </Field>
        <Field label="Ends" hint={chosen ? "set automatically" : "Eastern"}>
          <input
            type="datetime-local"
            name="ends_at"
            required
            value={form.ends_at}
            onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
            className="field"
          />
        </Field>
      </div>

      {/* ------------------------------------------------------- the numbers */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Capacity">
          <input
            type="number" name="capacity" min={1} required
            value={form.capacity}
            onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
            className="field"
          />
        </Field>
        <Field label="Min to run">
          <input
            type="number" name="min_to_run" min={0} required
            value={form.min_to_run}
            onChange={(e) => setForm({ ...form, min_to_run: Number(e.target.value) })}
            className="field"
          />
        </Field>
        <Field label="Price" hint="per person">
          <input
            type="number" name="price" min={0} step="0.01" required
            value={form.price}
            onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
            className="field"
          />
        </Field>
      </div>

      <p className="-mt-2 text-xs leading-relaxed text-ink/50">
        Whatever you put in <strong>Price</strong> is what guests are charged for this
        event — nothing else to set up, no Stripe changes. Capacity is enforced
        automatically; the event stops selling the moment it fills.
      </p>

      {/* ------------------------------------------------------------- words */}
      <Field label="Title">
        <input
          name="title" required
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="field"
        />
      </Field>

      <Field label="Description" hint="blank line between paragraphs">
        <textarea
          name="description" rows={6}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="field"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="We bring">
          <input
            name="whats_included"
            value={form.whats_included}
            onChange={(e) => setForm({ ...form, whats_included: e.target.value })}
            className="field"
          />
        </Field>
        <Field label="You bring">
          <input
            name="what_to_bring"
            value={form.what_to_bring}
            onChange={(e) => setForm({ ...form, what_to_bring: e.target.value })}
            className="field"
          />
        </Field>
      </div>

      <Field label="Image" hint="blank = neon placeholder">
        <input
          name="image_url"
          value={form.image_url}
          onChange={(e) => setForm({ ...form, image_url: e.target.value })}
          placeholder="/images/candle-making.jpg"
          className="field"
        />
      </Field>

      <Field label="Venue arrangement" hint="private, just for you">
        <input
          name="venue_payout_note"
          placeholder="e.g. no room fee, they keep bar sales"
          className="field"
        />
      </Field>

      <label className="flex items-center gap-2.5">
        <input type="checkbox" name="publish" className="h-4 w-4 accent-clay" />
        <span className="text-sm font-semibold">
          Publish immediately — puts it on the public calendar
        </span>
      </label>

      <button
        disabled={noVenues}
        className="rounded-lg bg-sage px-6 py-3 font-bold uppercase tracking-wide text-paper
                   shadow-neon-cyan transition-all hover:bg-sage/85 disabled:opacity-30"
      >
        Create event
      </button>
    </form>
  );
}

/** "2026-09-14T19:00" + 120 → "2026-09-14T21:00" */
function addMinutes(local: string, minutes: number): string {
  const d = new Date(`${local}:00`);
  if (Number.isNaN(d.getTime())) return "";
  d.setMinutes(d.getMinutes() + minutes);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">
        {label}
        {hint && <span className="font-normal text-ink/50"> ({hint})</span>}
      </span>
      {children}
    </label>
  );
}
