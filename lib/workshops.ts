import { db } from "./db";
import { isDemoMode, DEMO_WORKSHOPS } from "./demo";

/**
 * The catalog.
 *
 * A workshop is the ACTIVITY. An event is one instance of it at a venue on a
 * date. The menu page lists everything offered; only some are on sale at any
 * given moment.
 */

export interface Workshop {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  what_you_make: string;
  good_for: string[];
  duration_minutes: number;
  base_price_cents: number;
  min_group: number;
  max_group: number;
  bar_friendly: boolean;
  image_url: string | null;
  active: boolean;
  sort_order: number;
}

export async function listWorkshops(): Promise<Workshop[]> {
  if (isDemoMode()) return DEMO_WORKSHOPS;

  const { data, error } = await db()
    .from("workshops")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(`listWorkshops failed: ${error.message}`);
  return (data ?? []) as Workshop[];
}

export async function getWorkshopBySlug(slug: string): Promise<Workshop | null> {
  if (isDemoMode()) return DEMO_WORKSHOPS.find((w) => w.slug === slug) ?? null;

  const { data, error } = await db()
    .from("workshops")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error(`getWorkshopBySlug failed: ${error.message}`);
  return (data as Workshop) ?? null;
}

/** Every occasion tag in use, for the menu filter. */
export function collectOccasions(workshops: Workshop[]): string[] {
  const seen = new Set<string>();
  for (const w of workshops) for (const tag of w.good_for) seen.add(tag);
  return [...seen].sort();
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours} hours` : `${hours.toFixed(1)} hours`;
}
