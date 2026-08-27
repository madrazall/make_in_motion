"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

/**
 * Reachable by both the "admin" and "content" roles — see middleware.ts.
 * Nothing here touches guests, revenue, or events beyond an optional
 * read-only link, which is exactly why it's safe to hand this off.
 */

export async function createContentPost(formData: FormData) {
  const record = {
    platform: String(formData.get("platform") ?? "instagram"),
    status: String(formData.get("status") ?? "idea"),
    scheduled_date: String(formData.get("scheduled_date") ?? ""),
    caption: String(formData.get("caption") ?? "").trim(),
    image_url: String(formData.get("image_url") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
    event_id: String(formData.get("event_id") ?? "").trim() || null,
  };

  if (!record.scheduled_date) throw new Error("A date is required.");

  const { error } = await db().from("content_posts").insert(record);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/content");
  redirect(`/admin/content?month=${record.scheduled_date.slice(0, 7)}`);
}

export async function updateContentPost(postId: string, formData: FormData) {
  const record = {
    platform: String(formData.get("platform") ?? "instagram"),
    status: String(formData.get("status") ?? "idea"),
    scheduled_date: String(formData.get("scheduled_date") ?? ""),
    caption: String(formData.get("caption") ?? "").trim(),
    image_url: String(formData.get("image_url") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
    event_id: String(formData.get("event_id") ?? "").trim() || null,
  };

  if (!record.scheduled_date) throw new Error("A date is required.");

  const { error } = await db().from("content_posts").update(record).eq("id", postId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/content");
  redirect(`/admin/content?month=${record.scheduled_date.slice(0, 7)}`);
}

export async function deleteContentPost(postId: string, month: string) {
  const { error } = await db().from("content_posts").delete().eq("id", postId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/content");
  redirect(`/admin/content?month=${month}`);
}
