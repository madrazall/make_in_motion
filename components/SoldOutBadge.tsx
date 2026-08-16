import { availabilityLabel } from "@/lib/availability";

export function AvailabilityBadge({
  spotsLeft,
  capacity,
}: {
  spotsLeft: number;
  capacity: number;
}) {
  const { text, tone } = availabilityLabel({ spotsLeft, capacity });

  const styles = {
    ok: "bg-sage/15 text-sage",
    low: "bg-clay/15 text-clay",
    gone: "bg-white/10 text-ink/50",
  }[tone];

  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${styles}`}
    >
      {text}
    </span>
  );
}
