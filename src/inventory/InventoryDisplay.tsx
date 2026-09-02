import { ItemStatusIcon } from "../components/InventoryIcons";
import { getInventoryRowDisplay } from "../model/inventoryRowDisplay";
import type { InventoryRowStatus } from "../model/inventoryRowDisplay";
import { getRecordSlotBurden } from "../model/calculations";
import type { InventoryRecord } from "../model/types";
import { isLightSourceRecord, isLitRecord } from "../model/lightSources";
import {
  getInventoryRowStatusIcon,
  getInventoryRowStatusTitle,
  getInventoryRowStatusTone,
  getUniqueInventoryRowStatuses,
} from "../formatters";
import { SlotPips } from "../components/GearMeters";

/** One inventory line in the shared idiom: serif name (clickable when an
 * editor is wired), status glyphs, muted secondary text, and either slot
 * pips or a capacity readout on the right. */
export function InventoryRowSummary({
  record,
  allRecords,
  extraStatusIcons,
  onOpenRecord,
  onToggleLight,
}: {
  record: InventoryRecord;
  allRecords: InventoryRecord[];
  extraStatusIcons?: InventoryRowStatus[];
  onOpenRecord?: (record: InventoryRecord) => void;
  /** When given, light sources get a flame toggle beside the name. */
  onToggleLight?: (record: InventoryRecord) => void;
}) {
  const display = getInventoryRowDisplay(record, allRecords);
  const showLightToggle = Boolean(onToggleLight) && isLightSourceRecord(record);
  const statusIcons = getUniqueInventoryRowStatuses([
    ...display.statusIcons,
    ...(extraStatusIcons ?? []),
  ]).filter((status) => !(showLightToggle && status === "lit"));
  const lit = isLitRecord(record);

  return (
    <div className="record-summary">
      <div className="record-summary-main">
        {onOpenRecord ? (
          <button
            className="record-title-button"
            type="button"
            onClick={() => onOpenRecord(record)}
          >
            {display.primaryText}
          </button>
        ) : (
          <strong>{display.primaryText}</strong>
        )}
        {showLightToggle && onToggleLight ? (
          <button
            aria-label={lit ? `Put out ${display.primaryText}` : `Light ${display.primaryText}`}
            aria-pressed={lit}
            className="light-toggle"
            data-lit={lit}
            title={lit ? "Put out" : "Light"}
            type="button"
            onClick={() => onToggleLight(record)}
          >
            <ItemStatusIcon name="lit" tone={lit ? "lit" : "muted"} />
          </button>
        ) : null}
        {statusIcons.map((status) => (
          <span
            className="record-status-icon"
            key={status}
            title={getInventoryRowStatusTitle(status)}
          >
            <ItemStatusIcon
              name={getInventoryRowStatusIcon(status)}
              tone={getInventoryRowStatusTone(status)}
            />
          </span>
        ))}
        {display.secondaryText ? (
          <span className="record-secondary">· {display.secondaryText}</span>
        ) : null}
      </div>
      {display.rightKind === "burden" ? (
        <SlotPips slots={getRecordSlotBurden(record)} />
      ) : (
        <span className="record-right-meta">{display.rightText}</span>
      )}
    </div>
  );
}
