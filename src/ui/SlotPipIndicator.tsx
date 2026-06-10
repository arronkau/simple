import { type ReactNode } from "react";
import { formatSlots } from "../formatters";

export function SlotPipIndicator({ slots }: { slots: number }) {
  const description = formatSlots(slots);

  return (
    <span
      aria-label={description}
      className="slot-pip-indicator"
      title={description}
    >
      {getSlotPipContent(slots)}
    </span>
  );
}

function getSlotPipContent(slots: number): ReactNode {
  if (slots <= 0) {
    return "○";
  }

  if (slots === 1) {
    return "●";
  }

  if (slots === 2) {
    return "●●";
  }

  if (slots === 3) {
    return "●●●";
  }

  return (
    <>
      ●×<span className="slot-pip-multiplier">{slots}</span>
    </>
  );
}
