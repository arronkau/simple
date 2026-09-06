import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

/**
 * Closes an open `<details>` popover on a pointer-down outside it or on
 * Escape. Returns the ref to attach to the `<details>` element.
 */
export function useDismissibleDetails(
  open: boolean,
  setOpen: Dispatch<SetStateAction<boolean>>,
) {
  const detailsRef = useRef<HTMLDetailsElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!detailsRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, setOpen]);

  return detailsRef;
}

/**
 * A readout that opens a small panel below itself when clicked. The summary
 * is the readout as it already renders; the panel explains it. `align`
 * anchors the panel to the readout's left or right edge.
 */
export function InfoPopover({
  summary,
  label,
  className,
  align = "start",
  children,
}: {
  summary: ReactNode;
  /** Accessible name for the control; the visible summary is often just numbers. */
  label: string;
  className?: string;
  align?: "start" | "end";
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const detailsRef = useDismissibleDetails(open, setOpen);

  return (
    <details
      ref={detailsRef}
      className={className ? `info-popover ${className}` : "info-popover"}
      data-align={align}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary aria-label={label} title={label}>
        {summary}
      </summary>
      <div className="info-popover-panel">{children}</div>
    </details>
  );
}
