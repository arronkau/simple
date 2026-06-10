import { type ReactNode } from "react";
import {
  closestCenter,
  pointerWithin,
  useDraggable,
  useDroppable,
  type CollisionDetection,
} from "@dnd-kit/core";
import type { KeyboardCoordinateGetter } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import {
  ItemTypeIcon,
  type IconTone,
  type ItemTypeIconName,
} from "../components/InventoryIcons";
import {
  entityDefaultDropId,
  gapDropId,
  slotDropId,
  type DragZone,
  type RecordDragData,
} from "../model/inventoryDnd";
import { getLocationPlacementKey } from "../model/inventoryRecords";
import type { EntityId, InventoryRecord, InventoryRecordId } from "../model/types";
import {
  getInventoryRecordTypeIcon,
  getInventoryRecordTypeIconTone,
  getRecordDisplayName,
} from "../formatters";

export type ActiveDrag = { type: "record"; recordId: InventoryRecordId };

export const dragTypeScopedCollisionDetection: CollisionDetection = (args) => {
  // Keyboard dragging has no pointer coordinates. The fine-grained gap drop
  // zones are great for pointer precision but make keyboard navigation snap
  // erratically (often back onto the dragged row), so we drop them for keyboard
  // and let the move land cleanly on item/slot targets instead.
  const isKeyboard = args.pointerCoordinates === null;
  const droppableContainers = args.droppableContainers.filter((container) => {
    if (container.data.current?.type !== "record") {
      return false;
    }

    return !(isKeyboard && container.data.current?.kind === "gap");
  });
  const scopedArgs = { ...args, droppableContainers };
  const pointerCollisions = pointerWithin(scopedArgs);

  return pointerCollisions.length > 0
    ? pointerCollisions
    : closestCenter(scopedArgs);
};

export const inventoryKeyboardCoordinates: KeyboardCoordinateGetter = (
  event,
  args,
) => {
  return sortableKeyboardCoordinates(event, args);
};

export function getRecordZone(record: InventoryRecord): DragZone {
  return {
    entityId: record.entityId,
    placement: getLocationPlacementKey(record.location),
    ...("containerId" in record.location
      ? { containerId: record.location.containerId }
      : {}),
  };
}

export function DragHandle({
  attributes,
  listeners,
  setActivatorNodeRef,
  label,
  icon,
  iconTone,
  className = "drag-handle",
}: {
  attributes: Record<string, unknown>;
  listeners: Record<string, unknown> | undefined;
  setActivatorNodeRef?: (element: HTMLElement | null) => void;
  label: string;
  icon: ItemTypeIconName;
  iconTone: IconTone;
  className?: string;
}) {
  return (
    <button
      ref={setActivatorNodeRef}
      type="button"
      className={className}
      aria-label={label}
      {...attributes}
      {...listeners}
    >
      <ItemTypeIcon name={icon} tone={iconTone} />
    </button>
  );
}

export function InventoryTypeIconMarker({ record }: { record: InventoryRecord }) {
  return (
    <span className="item-type-icon-marker" aria-hidden="true">
      <ItemTypeIcon
        name={getInventoryRecordTypeIcon(record)}
        tone={getInventoryRecordTypeIconTone(record)}
      />
    </span>
  );
}

export function SortableRecordItem({
  record,
  index,
  zone,
  children,
}: {
  record: InventoryRecord;
  index: number;
  zone: DragZone;
  children: (handle: ReactNode) => ReactNode;
}) {
  const data: RecordDragData = {
    type: "record",
    kind: "item",
    recordId: record.id,
    zone,
    index,
  };
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id: record.id, data });
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };
  const handle = (
    <DragHandle
      attributes={attributes as unknown as Record<string, unknown>}
      listeners={listeners as unknown as Record<string, unknown> | undefined}
      setActivatorNodeRef={setActivatorNodeRef}
      label={`Reorder ${getRecordDisplayName(record)}`}
      icon={getInventoryRecordTypeIcon(record)}
      iconTone={getInventoryRecordTypeIconTone(record)}
    />
  );

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`record-list-item${isDragging ? " dragging" : ""}${isOver ? " drop-over" : ""}`}
      data-record-id={record.id}
    >
      {children(handle)}
    </li>
  );
}

export function DraggableRecordItem({
  record,
  zone,
  children,
}: {
  record: InventoryRecord;
  zone: DragZone;
  children: (handle: ReactNode) => ReactNode;
}) {
  const data: RecordDragData = {
    type: "record",
    kind: "item",
    recordId: record.id,
    zone,
    index: 0,
  };
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    isDragging,
  } = useDraggable({ id: record.id, data });
  const style = {
    transform: CSS.Translate.toString(transform),
  };
  const handle = (
    <DragHandle
      attributes={attributes as unknown as Record<string, unknown>}
      listeners={listeners as unknown as Record<string, unknown> | undefined}
      setActivatorNodeRef={setActivatorNodeRef}
      label={`Move ${getRecordDisplayName(record)}`}
      icon={getInventoryRecordTypeIcon(record)}
      iconTone={getInventoryRecordTypeIconTone(record)}
    />
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`record-draggable${isDragging ? " dragging" : ""}`}
    >
      {children(handle)}
    </div>
  );
}

export function GapDropZone({
  zone,
  index,
  empty = false,
}: {
  zone: DragZone;
  index: number;
  empty?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: gapDropId(zone, index),
    data: { type: "record", kind: "gap", zone, index },
  });

  if (empty) {
    return (
      <div
        ref={setNodeRef}
        className={`record-list-empty-drop-target${isOver ? " drop-over" : ""}`}
        data-drop-zone="empty-list"
      >
        <p className="empty-state compact">Empty</p>
      </div>
    );
  }

  return (
    <li
      ref={setNodeRef}
      className={`record-drop-zone${isOver ? " drop-over" : ""}`}
      aria-hidden="true"
      data-drop-zone="gap"
    />
  );
}

export function SlotDropZone({
  entityId,
  placement,
  className,
  children,
}: {
  entityId: EntityId;
  placement: ReturnType<typeof getLocationPlacementKey>;
  className: string;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: slotDropId(entityId, placement),
    data: { type: "record", kind: "slot", entityId, placement },
  });

  return (
    <div
      ref={setNodeRef}
      className={className}
      data-drop-over={isOver}
    >
      {children}
    </div>
  );
}

export function EntityDefaultDropZone({
  entityId,
  children,
}: {
  entityId: EntityId;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: entityDefaultDropId(entityId),
    data: { type: "record", kind: "entityDefault", entityId },
  });

  return (
    <div
      ref={setNodeRef}
      className={`entity-default-drop${isOver ? " drop-over" : ""}`}
    >
      {children}
    </div>
  );
}
