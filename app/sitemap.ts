import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { siteUrl } from "@/lib/config";
import { isDemoMode, DEMO_EVENTS, DEMO_WORKSHOPS } from "@/lib/demo";

// Without this, Next pre-renders the sitemap once at build time using
// whatever NEXT_PUBLIC_SITE_URL happens to be set locally (localhost) and
// bakes that in forever — the Workers runtime's real value never gets used.
export const dynamic = "force-dynamic";

/**
 * Served at /sitemap.xml automatically — this is a Next.js file convention,
 * not a route we wired up by hand.
 *
 * Deliberately excludes /admin/* (private), /booked/[code] (per-order, not
 * meant to be discovered), and draft/cancelled events — only what a stranger
 * should actually land on from search.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/workshops`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/venues`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/private-events`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/faq`, changeFrequency: "monthly", priority: 0.4 },
  ];

  const [workshopSlugs, events] = isDemoMode()
    ? [
        DEMO_WORKSHOPS.map((w) => w.slug),
        DEMO_EVENTS.map((e) => ({ slug: e.slug, updated_at: null as string | null })),
      ]
    : await Promise.all([
        db()
          .from("workshops")
          .select("slug")
          .eq("active", true)
          .then(({ data }) => (data ?? []).map((w) => w.slug as string)),
        db()
          .from("events")
          .select("slug, updated_at")
          .eq("status", "published")
          .then(({ data }) => (data ?? []) as { slug: string; updated_at: string | null }[]),
      ]);

  const workshopRoutes: MetadataRoute.Sitemap = workshopSlugs.map((slug) => ({
    url: `${base}/workshops/${slug}`,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  const eventRoutes: MetadataRoute.Sitemap = events.map((e) => ({
    url: `${base}/events/${e.slug}`,
    lastModified: e.updated_at ? new Date(e.updated_at) : undefined,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  return [...staticRoutes, ...workshopRoutes, ...eventRoutes];
}
