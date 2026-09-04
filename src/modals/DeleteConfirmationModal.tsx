import type { InventoryRecord } from "../model/types";
import { getDeleteConfirmationMessage, getRecordDisplayName } from "../formatters";
import { getVisibleInventoryRecord } from "../model/recordVisibility";
import { useViewerRole } from "../components/ViewerRole";
import type { DeleteConfirmationState } from "../view-types";

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
  const title =
    confirmation.kind === "entity" ? "Delete Entity" : "Delete Item";
  // Display boundary: the record message quotes the name and the gp value, so
  // build it from what this viewer may see. Deleting still goes by record id.
  const message =
    confirmation.kind === "entity"
      ? `Delete ${confirmation.entity.name} and all of its inventory records?`
      : getDeleteConfirmationMessage(
          getVisibleInventoryRecord(confirmation.record, viewerRole),
          inventoryRecords,
        );
  const targetName =
    confirmation.kind === "entity"
      ? confirmation.entity.name
      : getRecordDisplayName(
          getVisibleInventoryRecord(confirmation.record, viewerRole),
        );

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        aria-label={title}
        aria-modal="true"
        className="modal-panel manage-modal"
        role="dialog"
      >
        <div className="modal-header">
          <div>
            <h2>{title}</h2>
            <p>{targetName}</p>
          </div>
          <button type="button" onClick={onCancel}>
            Close
          </button>
        </div>

        <div className="modal-body">
          <section className="manage-section danger-section">
            <p>{message}</p>
          </section>
        </div>

        <div className="modal-actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button className="danger-button" type="button" onClick={onConfirm}>
            Delete
          </button>
        </div>
      </section>
    </div>
  );
}
