/**
 * Shared load/capacity widgets in the gear page idiom. One representation
 * everywhere: ■ pips for per-item slot burden, the thin capacity track with
 * a mono used/max readout, and the "N free" badge.
 */

export type LoadTone = "ok" | "warn" | "crit";

export function capacityTone(used: number, max: number): LoadTone {
  if (used > max) {
    return "crit";
  }

  return used / max >= 0.85 ? "warn" : "ok";
}

export function SlotPips({ slots }: { slots: number }) {
  if (slots <= 0) {
    return <span className="islots faint">·</span>;
  }

  if (slots <= 3) {
    return (
      <span className="islots">
        <b>{"■".repeat(slots)}</b>
      </span>
    );
  }

  return (
    <span className="islots">
      ■<b>×{slots}</b>
    </span>
  );
}

export function CapBar({
  used,
  max,
  tone,
}: {
  used: number;
  max: number;
  tone: LoadTone;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((100 * used) / max)) : 0;

  return (
    <span className={`cap ${tone === "ok" ? "" : tone}`}>
      <span className="track">
        <i style={{ width: `${pct}%` }} />
      </span>
      <span className="capnum">
        {used}/{max}
      </span>
    </span>
  );
}

export function FreeBadge({ free, tone }: { free: number; tone: LoadTone }) {
  return (
    <span className={`free ${tone === "ok" ? "" : tone}`}>
      {free >= 0 ? `${free} free` : `${-free} over`}
    </span>
  );
}
