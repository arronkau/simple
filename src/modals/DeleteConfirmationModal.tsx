import type { InventoryRecord, PartyRole } from "../model/types";
import { formatGpValue, getRecordDisplayName } from "../formatters";
import {
  getCoinCount,
  getCoinGpValue,
  getDirectChildRecords,
} from "../model/calculations";
import { getVisibleInventoryRecord } from "../model/recordVisibility";
import { useViewerRole } from "../components/ViewerRole";
import type { DeleteConfirmationState } from "../view-types";
import { Modal } from "../ui/Modal";

export function DeleteConfirmationModal({
  confirmation,
  inventoryRecords,
  onCancel,
  onConfirm,
}: {
  confirmation: DeleteConfirmationState;
  inventoryRecords: InventoryRecord[];
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const viewerRole = useViewerRole();
  const target = getDeleteTarget(confirmation, inventoryRecords, viewerRole);

  return (
    <Modal title={target.title} onClose={onCancel}>
      <div className="modal-body">
        <section className="manage-section danger-section">
          <p>Delete “{target.name}”?</p>
          {target.consequence ? <p>{target.consequence}</p> : null}
        </section>
      </div>

      <div className="modal-footer">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="danger-button" type="button" onClick={onConfirm}>
          Delete
        </button>
      </div>
    </Modal>
  );
}

/**
 * Title, quoted name, and one consequence sentence — the same shape for an
 * entity and for a record.
 *
 * Display boundary: the confirmation quotes the name and any gp value, so it is
 * built from what this viewer may see. Deleting still goes by record id.
 */
function getDeleteTarget(
  confirmation: DeleteConfirmationState,
  allRecords: InventoryRecord[],
  viewerRole: PartyRole | null,
): { title: string; name: string; consequence?: string } {
  if (confirmation.kind === "entity") {
    return {
      title: "Delete entity",
      name: confirmation.entity.name,
      consequence: "All of its inventory records are deleted too.",
    };
  }

  const record = getVisibleInventoryRecord(confirmation.record, viewerRole);

  return {
    title: "Delete item",
    name: getRecordDisplayName(record),
    consequence: getRecordDeleteConsequence(record, allRecords),
  };
}

/** One sentence on what deleting this record costs, or why it is blocked. */
function getRecordDeleteConsequence(
  record: InventoryRecord,
  allRecords: InventoryRecord[],
): string | undefined {
  if (record.recordType === "coins") {
    return getCoinCount(record.coins) > 0
      ? `Worth ${formatGpValue(getCoinGpValue(record.coins))} gp.`
      : undefined;
  }

  if (record.recordType === "treasure") {
    return record.treasure.gpValue > 0
      ? `Worth ${formatGpValue(record.treasure.gpValue)} gp.`
      : undefined;
  }

  if (record.container) {
    if (record.location.kind === "stowedRoot") {
      return "This may make stowed inventory invalid.";
    }

    if (getDirectChildRecords(record.id, allRecords).length > 0) {
      return "This is blocked until the contents are moved.";
    }
  }

  return undefined;
}
