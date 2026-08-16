import Link from "next/link";
import { db } from "@/lib/db";
import { isDemoMode } from "@/lib/demo";
import { listWorkshops } from "@/lib/workshops";
import { EventForm } from "@/components/admin/EventForm";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

export default async function NewEventPage() {
  const [{ data: venues }, workshops] = await Promise.all([
    isDemoMode()
      ? Promise.resolve({
          data: [
            { id: "venue-1", name: "Stubborn Beauty Brewing", city: "Middletown" },
            { id: "venue-2", name: "Little House Brewing", city: "Chester" },
          ],
        })
      : db().from("venues").select("id, name, city").order("name"),
    listWorkshops(),
  ]);

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <Link href="/admin" className="text-sm text-clay hover:underline">
        ← Dashboard
      </Link>
      <h1 className="mt-3 font-display text-3xl uppercase">New event</h1>
      <p className="mt-1.5 text-sm text-ink/60">
        Pick a workshop, pick a venue, pick a date. Everything else fills itself in.
      </p>

      <EventForm
        venues={(venues ?? []) as { id: string; name: string; city: string }[]}
        workshops={workshops}
      />
    </div>
  );
}
