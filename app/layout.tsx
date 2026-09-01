import type { Metadata, Viewport } from "next";
import Link from "next/link";
import Script from "next/script";
import "./globals.css";
import {
  BUSINESS,
  siteUrl,
  instagramUrl,
  PAYMENT_HANDLES,
  GA_MEASUREMENT_ID,
} from "@/lib/config";
import { isDemoMode } from "@/lib/demo";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: `${BUSINESS.name} — pop-up art nights in Connecticut`,
    template: `%s · ${BUSINESS.name}`,
  },
  description:
    "A pop-up creative experience that turns your space into an interactive art night. Breweries, bars, and event spaces across Connecticut. Age policy varies by venue.",
  openGraph: { siteName: BUSINESS.name, type: "website" },
};

// Next 15 wants themeColor here rather than in metadata.
export const viewport: Viewport = {
  themeColor: "#08070f",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/*
          Loaded via <link> rather than next/font so the build never depends on
          reaching Google at compile time. Swap to next/font/google later if you
          want them self-hosted.
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Anton&family=Yellowtail&family=Montserrat:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen flex flex-col">
        {/* Skipped in demo/preview mode so local browsing never pollutes real traffic data. */}
        {!isDemoMode() && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_MEASUREMENT_ID}');
              `}
            </Script>
          </>
        )}

        {isDemoMode() && (
          <div className="border-b border-white/10 bg-black/60 px-5 py-2 text-center text-xs text-ink/70">
            <strong className="font-semibold text-sage">Preview mode</strong> — sample
            data, no database. Payments and forms are inactive.{" "}
            <Link href="/admin" className="underline hover:text-clay">
              View admin
            </Link>
          </div>
        )}

        <header className="sticky top-0 z-40 border-b border-white/10 bg-paper/80 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-5">
            <Link href="/" className="group flex items-center gap-2.5">
              <span className="tube h-7 text-sage" aria-hidden />
              <span className="font-display text-lg uppercase leading-none text-ink transition-colors group-hover:text-clay">
                Make in <span className="neon-pink">Motion</span>
              </span>
            </Link>

            <nav className="flex items-center gap-4 text-[13px] font-semibold uppercase tracking-wider sm:gap-6">
              <Link href="/" className="text-ink/70 transition-colors hover:text-sage">
                Events
              </Link>
              <Link href="/workshops" className="text-ink/70 transition-colors hover:text-sage">
                Workshops
              </Link>
              <Link
                href="/private-events"
                className="hidden text-ink/70 transition-colors hover:text-sage sm:inline"
              >
                Private
              </Link>
              <Link
                href="/venues"
                className="hidden text-ink/70 transition-colors hover:text-sage sm:inline"
              >
                Venues
              </Link>
              <Link href="/faq" className="text-ink/70 transition-colors hover:text-sage">
                FAQ
              </Link>
            </nav>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="mt-24 border-t border-white/10">
          <div className="mx-auto max-w-5xl px-5 py-10">
            <div className="flex flex-col gap-4 text-sm text-ink/55 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-display text-base uppercase text-ink/80">
                Let&apos;s make it a <span className="neon-cyan">date</span>
              </p>
              <p className="flex flex-wrap items-center gap-4">
                <a
                  href={instagramUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-sage hover:text-clay"
                >
                  Instagram @{PAYMENT_HANDLES.instagram}
                </a>
                <a href={`mailto:${BUSINESS.contactEmail}`} className="hover:text-clay">
                  {BUSINESS.contactEmail}
                </a>
                <a href={BUSINESS.phoneHref} className="hover:text-clay">
                  {BUSINESS.phone}
                </a>
              </p>
            </div>
            <p className="mt-6 text-xs text-ink/35">
              © {new Date().getFullYear()} {BUSINESS.name}. Age policy varies by venue.
              Ideal for breweries, bars &amp; event spaces.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
