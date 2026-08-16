import Link from "next/link";
import { CheckInScanner } from "@/components/CheckInScanner";

export const metadata = { title: "Check in", robots: { index: false } };

export default function CheckInPage() {
  return (
    <div className="mx-auto max-w-lg px-5 py-10">
      <Link href="/admin" className="text-sm text-clay hover:underline">
        ← Dashboard
      </Link>
      <h1 className="mt-3 text-2xl font-bold">Check in</h1>
      <p className="mt-1 text-sm text-ink/60">
        Scan a guest&apos;s door code, or type it in if the scanner&apos;s dead. One code
        per seat — a second scan of the same code won&apos;t double-count.
      </p>
      <div className="mt-6">
        <CheckInScanner />
      </div>
    </div>
  );
}
