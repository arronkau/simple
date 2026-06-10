import { useEffect, useRef, useState } from "react";
import {
  ItemStatusIcon,
  type IconTone,
  type ItemStatusIconName,
} from "../components/InventoryIcons";
import type { EncumbranceWarning } from "../model/encumbrance";
import type { ValidationIssue } from "../model/validation";
import { formatWarningState } from "../formatters";

export function WarningDetailsButton({
  validationIssues,
  warnings,
}: {
  validationIssues: ValidationIssue[];
  warnings: EncumbranceWarning[];
}) {
  const warningCount = validationIssues.length + warnings.length;
  const detailsRef = useRef<HTMLDetailsElement | null>(null);
  const [open, setOpen] = useState(false);

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
  }, [open]);

  if (warningCount === 0) {
    return null;
  }

  const messages = [...validationIssues, ...warnings].map(
    (warning) => warning.message,
  );
  const severity = getWarningDisplaySeverity(validationIssues, warnings);
  const warningIcon = getWarningDetailsIcon(validationIssues, warnings);

  return (
    <details
      ref={detailsRef}
      className="warning-details"
      data-severity={severity}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary
        title={messages.join("\n")}
        aria-label={`${formatWarningState(warnings, validationIssues)}: ${messages.join(
          " ",
        )}`}
      >
        <ItemStatusIcon name={warningIcon.name} tone={warningIcon.tone} />
      </summary>
      <div className="warning-details-panel">
        <ul>
          {messages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      </div>
    </details>
  );
}

function getWarningDetailsIcon(
  validationIssues: ValidationIssue[],
  warnings: EncumbranceWarning[],
): { name: ItemStatusIconName; tone: IconTone } {
  if (warnings.some((warning) => warning.code === "entityOverloaded")) {
    return { name: "overloaded", tone: "critical" };
  }

  if (warnings.some((warning) => warning.code === "containerOverCapacity")) {
    return { name: "overCapacity", tone: "critical" };
  }

  if (
    warnings.some(
      (warning) => warning.code === "handsRequiredContainerNotHeld",
    )
  ) {
    return { name: "containerNotHeld", tone: "critical" };
  }

  if (
    validationIssues.some((issue) => issue.code === "missingBackpack") ||
    warnings.some((warning) => warning.code === "missingBackpack")
  ) {
    return { name: "missingStowedContainer", tone: "warning" };
  }

  return getWarningDisplaySeverity(validationIssues, warnings) === "error"
    ? { name: "overloaded", tone: "critical" }
    : { name: "missingStowedContainer", tone: "warning" };
}

function getWarningDisplaySeverity(
  validationIssues: ValidationIssue[],
  warnings: EncumbranceWarning[],
): "error" | "warning" {
  return validationIssues.some((issue) => issue.severity === "error") ||
    warnings.some((warning) =>
      [
        "containerOverCapacity",
        "handsRequiredContainerNotHeld",
        "entityOverloaded",
      ].includes(warning.code),
    )
    ? "error"
    : "warning";
}
