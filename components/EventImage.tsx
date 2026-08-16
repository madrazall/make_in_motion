/**
 * Event artwork, with a generated placeholder when there's no photo yet.
 *
 * The placeholder is a deterministic two-tone wash derived from the title, so
 * a grid of events without photos still looks intentional rather than broken.
 * Swap in real photos as they're taken — nothing else has to change.
 */

// Neon tube colours against dark brick — the flyer, reduced to two stops.
const PALETTES: [string, string][] = [
  ["#ff2e88", "#5b1a8c"], // hot pink into violet
  ["#22e0ff", "#123a8c"], // cyan into deep blue
  ["#a855f7", "#ff2e88"], // violet into pink
  ["#22e0ff", "#ff2e88"], // full spectrum, both tubes
  ["#ff6b2e", "#a8145f"], // amber into magenta
];

function paletteFor(seed: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return PALETTES[hash % PALETTES.length];
}

export function EventImage({
  src,
  title,
  className = "",
  priority = false,
}: {
  src: string | null;
  title: string;
  className?: string;
  priority?: boolean;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={title}
        loading={priority ? "eager" : "lazy"}
        className={`object-cover w-full h-full ${className}`}
      />
    );
  }

  const [from, to] = paletteFor(title);

  return (
    <div
      className={`relative flex h-full w-full items-end overflow-hidden p-5 ${className}`}
      style={{
        background: `radial-gradient(ellipse 90% 80% at 15% 10%, ${from}55, transparent 65%),
                     radial-gradient(ellipse 90% 80% at 85% 90%, ${to}66, transparent 65%),
                     linear-gradient(150deg, #0d0b18 0%, #1a1430 100%)`,
      }}
      role="img"
      aria-label={title}
    >
      {/* Brick courses, faint — the wall behind the neon. */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.9) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.9) 1px, transparent 1px)",
          backgroundSize: "70px 26px",
        }}
      />
      {/* A lit tube down the left edge. */}
      <div
        className="pointer-events-none absolute left-4 top-5 bottom-5 w-[3px] rounded-full"
        style={{ background: from, boxShadow: `0 0 10px ${from}, 0 0 26px ${from}` }}
      />
      <span
        className="relative pl-5 font-display text-2xl uppercase leading-[0.95] text-white"
        style={{ textShadow: `0 0 10px ${from}cc, 0 0 34px ${from}77` }}
      >
        {title}
      </span>
    </div>
  );
}
