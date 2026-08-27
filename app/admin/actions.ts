"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { DEFAULT_MIN_TO_RUN, TIMEZONE } from "@/lib/config";
import { createManualOrder, getEventById, manualOrderErrorMessage } from "@/lib/availability";
import { createTicketsForOrder } from "@/lib/tickets";
import { sendConfirmationEmail, sendNewEventAnnouncementEmail } from "@/lib/email";
import { CURRENT_POLICY_VERSION } from "@/lib/policy";
import type { PaymentMethod } from "@/lib/types";

/**
 * Admin mutations. Everything here is already behind middleware auth.
 */

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

/**
 * The admin types local Eastern time into a datetime-local input. Convert to
 * UTC for storage by asking Intl what the offset is on that specific date —
 * this is what makes March and November events land correctly.
 */
function easternToUtcIso(local: string): string {
  const naive = new Date(`${local}:00Z`);
  const asEastern = new Date(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
      .format(naive)
      .replace(/(\d+)\/(\d+)\/(\d+), (\d+):(\d+):(\d+)/, "$3-$1-$2T$4:$5:$6Z")
  );
  const offsetMs = asEastern.getTime() - naive.getTime();
  return new Date(naive.getTime() - offsetMs).toISOString();
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base;
  let n = 2;
  // Same tutorial at four venues means four events wanting the same slug.
  while (true) {
    const { data } = await db()
      .from("events")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!data) return slug;
    slug = `${base}-${n++}`;
  }
}

/** Add a venue without touching SQL. */
export async function createVenue(formData: FormData) {
  const record = {
    name: String(formData.get("name") ?? "").trim(),
    address: String(formData.get("address") ?? "").trim(),
    city: String(formData.get("city") ?? "").trim(),
    state: String(formData.get("state") ?? "CT").trim(),
    zip: String(formData.get("zip") ?? "").trim(),
    contact_name: String(formData.get("contact_name") ?? "").trim() || null,
    contact_email: String(formData.get("contact_email") ?? "").trim() || null,
    contact_phone: String(formData.get("contact_phone") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
    // Built from the address so you never have to paste a Google Maps link.
    map_url:
      "https://maps.google.com/?q=" +
      encodeURIComponent(
        [
          formData.get("name"),
          formData.get("address"),
          formData.get("city"),
          formData.get("state"),
        ]
          .filter(Boolean)
          .join(" ")
      ),
  };

  if (!record.name || !record.address || !record.city || !record.zip) {
    throw new Error("Venue needs at least a name, address, city and zip.");
  }

  const { error } = await db().from("venues").insert(record);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/venues");
  revalidatePath("/admin/events/new");
  redirect("/admin/venues?added=1");
}

export async function createEvent(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const startsLocal = String(formData.get("starts_at") ?? "");
  const endsLocal = String(formData.get("ends_at") ?? "");
  const workshopId = String(formData.get("workshop_id") ?? "").trim();

  const record = {
    slug: await uniqueSlug(slugify(title)),
    title,
    description: String(formData.get("description") ?? "").trim(),
    venue_id: String(formData.get("venue_id") ?? ""),
    // Links the event back to the catalogue entry it came from.
    workshop_id: workshopId || null,
    starts_at: easternToUtcIso(startsLocal),
    ends_at: easternToUtcIso(endsLocal),
    capacity: Number(formData.get("capacity") ?? 20),
    min_to_run: Number(formData.get("min_to_run") ?? DEFAULT_MIN_TO_RUN),
    price_cents: Math.round(Number(formData.get("price") ?? 45) * 100),
    whats_included: String(formData.get("whats_included") ?? "").trim(),
    what_to_bring: String(formData.get("what_to_bring") ?? "").trim(),
    venue_payout_note: String(formData.get("venue_payout_note") ?? "").trim() || null,
    image_url: String(formData.get("image_url") ?? "").trim() || null,
    status: formData.get("publish") === "on" ? "published" : "draft",
  };

  const { data, error } = await db()
    .from("events")
    .insert(record)
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/admin");
  revalidatePath("/");
  redirect(`/admin/events/${data.id}`);
}

export async function updateEvent(eventId: string, formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const startsLocal = String(formData.get("starts_at") ?? "");
  const endsLocal = String(formData.get("ends_at") ?? "");
  const workshopId = String(formData.get("workshop_id") ?? "").trim();

  const record = {
    title,
    description: String(formData.get("description") ?? "").trim(),
    venue_id: String(formData.get("venue_id") ?? ""),
    workshop_id: workshopId || null,
    starts_at: easternToUtcIso(startsLocal),
    ends_at: easternToUtcIso(endsLocal),
    capacity: Number(formData.get("capacity") ?? 20),
    min_to_run: Number(formData.get("min_to_run") ?? DEFAULT_MIN_TO_RUN),
    price_cents: Math.round(Number(formData.get("price") ?? 45) * 100),
    whats_included: String(formData.get("whats_included") ?? "").trim(),
    what_to_bring: String(formData.get("what_to_bring") ?? "").trim(),
    venue_payout_note: String(formData.get("venue_payout_note") ?? "").trim() || null,
    image_url: String(formData.get("image_url") ?? "").trim() || null,
  };

  const { error } = await db().from("events").update(record).eq("id", eventId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin");
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath("/");
  redirect(`/admin/events/${eventId}`);
}

/**
 * Duplicate an event onto a new date. This is why there's no recurring-event
 * engine — you run the same tutorial at different venues, and cloning covers
 * it for a fraction of the complexity.
 */
export async function cloneEvent(eventId: string) {
  const { data: source, error } = await db()
    .from("events")
    .select("*")
    .eq("id", eventId)
    .single();

  if (error) throw new Error(error.message);

  const weekLater = (iso: string) =>
    new Date(new Date(iso).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { id, created_at, updated_at, slug, ...rest } = source;
  void id;
  void created_at;
  void updated_at;

  const { data: created, error: insertError } = await db()
    .from("events")
    .insert({
      ...rest,
      slug: await uniqueSlug(slug.replace(/-\d+$/, "")),
      starts_at: weekLater(source.starts_at),
      ends_at: weekLater(source.ends_at),
      status: "draft", // never clone straight to published
    })
    .select("id")
    .single();

  if (insertError) throw new Error(insertError.message);

  revalidatePath("/admin");
  redirect(`/admin/events/${created.id}`);
}

/**
 * For genuine mistakes — wrong venue, duplicate, wrong date entirely.
 *
 * Events with orders can't be deleted at the database level (orders.event_id
 * is ON DELETE RESTRICT, deliberately — nothing should silently orphan a
 * payment record). So this removes the event's orders first. Stripe still has
 * the actual charge either way; what's lost is the ability to look that order
 * up here. The confirmation prompt for that case lives client-side, right
 * before this ever gets called — see DeleteEventButton.
 *
 * If you just want to stop selling an event that already has real signups,
 * use "Cancel event" instead — it keeps every order on record.
 */
export async function deleteEvent(eventId: string) {
  const { error: ordersError } = await db().from("orders").delete().eq("event_id", eventId);
  if (ordersError) throw new Error(ordersError.message);

  const { error } = await db().from("events").delete().eq("id", eventId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin");
  redirect("/admin");
}

export async function setEventStatus(eventId: string, status: string) {
  const { error } = await db().from("events").update({ status }).eq("id", eventId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath("/");
}

/** Transfers arrive by text. This is how they get onto the guest list. */
export async function renameGuest(orderId: string, newName: string) {
  const { error } = await db()
    .from("orders")
    .update({ customer_name: newName.trim() })
    .eq("id", orderId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

/**
 * Door sales and the Stripe-outage fallback. Records a payment that already
 * happened — cash in hand, a Venmo notification the admin already saw — as a
 * paid order, right through the same capacity lock as the online checkout.
 */
export async function createManualOrderAction(eventId: string, formData: FormData) {
  const seats = Number(formData.get("seats") ?? 1);
  const amountCents = Math.round(Number(formData.get("amount") ?? 0) * 100);
  const paymentMethod = String(formData.get("payment_method") ?? "cash") as PaymentMethod;
  const customerName = String(formData.get("customer_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const checkInNow = formData.get("check_in_now") === "on";

  if (!customerName) throw new Error("Name is required.");
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error("A valid email is required.");
  }
  if (phone.length < 7) throw new Error("A valid phone number is required.");

  const result = await createManualOrder({
    eventId,
    seats,
    customerName,
    email,
    phone,
    amountCents,
    paymentMethod,
    policyVersion: CURRENT_POLICY_VERSION,
    notes: notes || null,
  });

  if (!result.ok) {
    throw new Error(manualOrderErrorMessage(result.reason, result.spots_left));
  }

  const tickets = await createTicketsForOrder(result.order_id);

  if (checkInNow) {
    await db()
      .from("tickets")
      .update({ checked_in_at: new Date().toISOString() })
      .eq("order_id", result.order_id);
  }

  // A door sale with a real email still gets the same door codes everyone
  // else gets — handy if they leave and come back, or split up the group.
  if (result.has_email) {
    const [{ data: orderRow }, eventRow] = await Promise.all([
      db().from("orders").select("*").eq("id", result.order_id).single(),
      getEventById(eventId),
    ]);
    if (orderRow && eventRow) {
      try {
        await sendConfirmationEmail(orderRow, eventRow, tickets);
      } catch (err) {
        console.error(`[manual order] confirmation email failed for ${result.confirmation_code}`, err);
      }
    }
  }

  revalidatePath(`/admin/events/${eventId}`);
}

/**
 * Manual, admin-triggered only — deliberately not wired to setEventStatus.
 * Click it when you actually want the list to hear about this event, not
 * every time an event gets published or edited.
 */
export async function notifySubscribers(eventId: string) {
  const event = await getEventById(eventId);
  if (!event) throw new Error("Event not found.");

  const [{ data: subscribers }, { data: alreadyNotified }] = await Promise.all([
    db().from("subscribers").select("id, email"),
    db().from("subscriber_notifications").select("subscriber_id").eq("event_id", eventId),
  ]);

  const notifiedIds = new Set((alreadyNotified ?? []).map((r) => r.subscriber_id));
  const targets = (subscribers ?? []).filter((s) => !notifiedIds.has(s.id));

  let sent = 0;
  for (const sub of targets) {
    try {
      await sendNewEventAnnouncementEmail({ to: sub.email, event });
      await db().from("subscriber_notifications").insert({ subscriber_id: sub.id, event_id: eventId });
      sent++;
    } catch (err) {
      // One bad address shouldn't stop the rest of the list. Not marked as
      // notified, so a retry (clicking the button again) will pick it back up.
      console.error(`[notifySubscribers] failed for ${sub.email}`, err);
    }
  }

  revalidatePath(`/admin/events/${eventId}`);
  redirect(`/admin/events/${eventId}?notified=${sent}`);
}

export async function toggleCheckIn(orderId: string, checkedIn: boolean) {
  const { error } = await db()
    .from("orders")
    .update({ checked_in_at: checkedIn ? new Date().toISOString() : null })
    .eq("id", orderId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}
