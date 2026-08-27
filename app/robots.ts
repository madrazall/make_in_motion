import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/config";

// Same reason as sitemap.ts — avoid baking in a build-time localhost URL.
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/booked", "/api"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
