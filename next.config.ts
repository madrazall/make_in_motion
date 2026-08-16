import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // R2 public bucket for event photos. Swap the hostname once the bucket exists.
    remotePatterns: [
      { protocol: "https", hostname: "**.r2.dev" },
      { protocol: "https", hostname: "images.makeinmotion.com" },
    ],
  },
};

export default nextConfig;

// Enables getCloudflareContext() during `next dev` so local dev sees Workers bindings.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
