"use client";

import { useEffect } from "react";

type Props = {
  /** Confirmation code — doubles as the GA4 transaction_id. */
  transactionId: string;
  value: number;
  itemId: string;
  itemName: string;
  quantity: number;
};

/**
 * Fires the GA4 `purchase` event once the confirmation page renders.
 *
 * The page is force-dynamic and people do refresh it (and re-open it from the
 * confirmation email), so a naive fire-on-mount would inflate revenue. We key a
 * sessionStorage flag on the confirmation code and only send once per session.
 * GA4 also de-dupes on transaction_id, but not across sessions or reliably
 * enough to lean on.
 */
export function PurchaseEvent({
  transactionId,
  value,
  itemId,
  itemName,
  quantity,
}: Props) {
  useEffect(() => {
    const key = `ga4-purchase:${transactionId}`;

    // Private-mode Safari can throw on storage access; a missed event beats a crash.
    try {
      if (sessionStorage.getItem(key)) return;
    } catch {
      return;
    }

    const send = () => {
      const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void })
        .gtag;
      if (typeof gtag !== "function") return false;

      gtag("event", "purchase", {
        transaction_id: transactionId,
        value,
        currency: "USD",
        items: [
          {
            item_id: itemId,
            item_name: itemName,
            price: quantity > 0 ? Number((value / quantity).toFixed(2)) : value,
            quantity,
          },
        ],
      });
      try {
        sessionStorage.setItem(key, "1");
      } catch {
        /* flag is best-effort; the event already went out */
      }
      return true;
    };

    /*
     * gtag.js loads with strategy="afterInteractive", so it may not be on window
     * yet when this effect runs. Poll briefly rather than pushing straight onto
     * dataLayer — an event queued ahead of the `config` call gets dropped.
     */
    if (send()) return;
    const timer = setInterval(() => {
      if (send()) clearInterval(timer);
    }, 200);
    const stop = setTimeout(() => clearInterval(timer), 5000);

    return () => {
      clearInterval(timer);
      clearTimeout(stop);
    };
  }, [transactionId, value, itemId, itemName, quantity]);

  return null;
}
