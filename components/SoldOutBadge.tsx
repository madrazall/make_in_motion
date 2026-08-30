import { availabilityLabel } from "@/lib/availability";

export function AvailabilityBadge({
  spotsLeft,
  capacity,
  className = "",
}: {
  spotsLeft: number;
  capacity: number;
  /** Spacing lives here rather than on a wrapper, so nothing is left behind
   *  when the badge renders null. */
  className?: string;
}) {
  const label = availabilityLabel({ spotsLeft, capacity });

  // Nothing to say about an event with room in it.
  if (!label) return null;

  const { text, tone } = label;
  const styles = {
    low: "bg-clay/15 text-clay",
    gone: "bg-white/10 text-ink/50",
  }[tone];

  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${styles} ${className}`}
    >
      {text}
    </span>
  );
}
