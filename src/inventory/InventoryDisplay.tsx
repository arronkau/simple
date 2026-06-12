import { ItemStatusIcon } from "../components/InventoryIcons";
import { getInventoryRowDisplay } from "../model/inventoryRowDisplay";
import type { InventoryRowStatus } from "../model/inventoryRowDisplay";
import { getRecordSlotBurden } from "../model/calculations";
import type { InventoryRecord } from "../model/types";
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
}: {
  record: InventoryRecord;
  allRecords: InventoryRecord[];
  extraStatusIcons?: InventoryRowStatus[];
  onOpenRecord?: (record: InventoryRecord) => void;
}) {
  const display = getInventoryRowDisplay(record, allRecords);
  const statusIcons = getUniqueInventoryRowStatuses([
    ...display.statusIcons,
    ...(extraStatusIcons ?? []),
  ]);

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
