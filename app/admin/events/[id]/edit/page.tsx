import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { isDemoMode } from "@/lib/demo";
import { getEventById } from "@/lib/availability";
import { listWorkshops } from "@/lib/workshops";
import { EventForm } from "@/components/admin/EventForm";
import { updateEvent } from "../../../actions";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await getEventById(id);
  if (!event) notFound();

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
      <Link href={`/admin/events/${event.id}`} className="text-sm text-clay hover:underline">
        ← Back to event
      </Link>
      <h1 className="mt-3 font-display text-3xl uppercase">Edit event</h1>
      <p className="mt-1.5 text-sm text-ink/60">
        Changes apply to this event only. Its current publication status stays the same.
      </p>

      <EventForm
        event={event}
        action={updateEvent.bind(null, event.id)}
        venues={(venues ?? []) as { id: string; name: string; city: string }[]}
        workshops={workshops}
      />
    </div>
  );
}
