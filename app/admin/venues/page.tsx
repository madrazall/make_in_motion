import Link from "next/link";
import { db } from "@/lib/db";
import { isDemoMode } from "@/lib/demo";
import { createVenue } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

interface VenueRow {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  contact_name: string | null;
  contact_email: string | null;
  notes: string | null;
}

export default async function VenuesAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ added?: string }>;
}) {
  const { added } = await searchParams;

  const { data } = isDemoMode()
    ? {
        data: [
          {
            id: "venue-1",
            name: "Stubborn Beauty Brewing",
            address: "180 Johnson St",
            city: "Middletown",
            state: "CT",
            zip: "06457",
            contact_name: "Bar Manager",
            contact_email: "hello@example.com",
            notes: "Long tables in the back room.",
          },
        ],
      }
    : await db().from("venues").select("*").order("name");

  const venues = (data ?? []) as VenueRow[];

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <Link href="/admin" className="text-sm text-clay hover:underline">
        ← Dashboard
      </Link>
      <h1 className="mt-3 font-display text-3xl uppercase">Venues</h1>
      <p className="mt-1.5 text-sm text-ink/60">
        Add a place once, then reuse it for every event you run there.
      </p>

      {added && (
        <p className="mt-5 rounded-xl bg-sage/10 px-4 py-3 text-sm font-semibold text-sage">
          Venue added.{" "}
          <Link href="/admin/events/new" className="underline underline-offset-2">
            Create an event there →
          </Link>
        </p>
      )}

      {/* ------------------------------------------------------------- list */}
      {venues.length > 0 && (
        <div className="mt-8 space-y-3">
          {venues.map((v) => (
            <div
              key={v.id}
              className="rounded-xl border border-white/10 bg-surface/80 p-4 text-sm"
            >
              <p className="font-bold">{v.name}</p>
              <p className="text-ink/70">
                {v.address}, {v.city}, {v.state} {v.zip}
              </p>
              {(v.contact_name || v.contact_email) && (
                <p className="mt-1 text-ink/55">
                  {v.contact_name}
                  {v.contact_name && v.contact_email && " · "}
                  {v.contact_email}
                </p>
              )}
              {v.notes && <p className="mt-1.5 text-ink/55">{v.notes}</p>}
            </div>
          ))}
        </div>
      )}

      {/* -------------------------------------------------------------- add */}
      <h2 className="mt-10 font-display text-xl uppercase">Add a venue</h2>
      <form action={createVenue} className="mt-4 space-y-4">
        <Field label="Venue name" required>
          <input name="name" required placeholder="Stubborn Beauty Brewing" className="field" />
        </Field>

        <Field label="Street address" required>
          <input name="address" required placeholder="180 Johnson St" className="field" />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="City" required>
            <input name="city" required placeholder="Middletown" className="field" />
          </Field>
          <Field label="State">
            <input name="state" defaultValue="CT" className="field" />
          </Field>
          <Field label="Zip" required>
            <input name="zip" required placeholder="06457" className="field" />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Contact name" hint="optional">
            <input name="contact_name" placeholder="Bar manager" className="field" />
          </Field>
          <Field label="Contact email" hint="optional">
            <input type="email" name="contact_email" className="field" />
          </Field>
          <Field label="Contact phone" hint="optional">
            <input type="tel" name="contact_phone" className="field" />
          </Field>
        </div>

        <Field label="Notes" hint="private — just for you">
          <input
            name="notes"
            placeholder="Where the outlets are, how many the back room seats, parking…"
            className="field"
          />
        </Field>

        <p className="text-xs text-ink/50">
          The Google Maps link builds itself from the address — nothing to paste.
        </p>

        <button className="rounded-lg bg-sage px-6 py-3 font-bold uppercase tracking-wide text-paper shadow-neon-cyan transition-all hover:bg-sage/85">
          Add venue
        </button>
      </form>
    </div>
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
      <span className="mb-1.5 block text-sm font-semibold">
        {label}
        {hint && <span className="font-normal text-ink/50"> ({hint})</span>}
        {required && <span className="sr-only"> required</span>}
      </span>
      {children}
    </label>
  );
}
