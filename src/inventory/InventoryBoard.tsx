import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  resolveRecordDropWithInventory,
  type RecordDragData,
  type RecordDropData,
} from "../model/inventoryDnd";
import { getRecordById } from "../model/inventoryDisplay";
import type { AppState } from "../model/appState";
import type { Entity, InventoryRecord, InventoryRecordId } from "../model/types";
import {
  useAppStore,
  type InventoryMutationResult,
} from "../store/useAppStore";
import {
  dragTypeScopedCollisionDetection,
  inventoryKeyboardCoordinates,
  EntityDefaultDropZone,
  type ActiveDrag,
} from "../inventory-dnd/InventoryDnd";
import { InventoryDisplay, InventoryRowSummary } from "./InventoryDisplay";
import { EntitySummary } from "../entity/EntityStatus";

export type EntityRowCallbacks = {
  onDeleteRecord: (record: InventoryRecord) => void;
  onEditEntity: (entity: Entity) => void;
  onEditRecord: (record: InventoryRecord) => void;
  onIdentifyRecord: (recordId: InventoryRecordId) => InventoryMutationResult;
  onSpendCoins: (record: InventoryRecord) => void;
  onStartAddRecord: (entity: Entity) => void;
  onToggleContainerCollapsed: (recordId: InventoryRecordId) => void;
};

export function InventoryEntityBoard({
  appState,
  collapsedContainerIds,
  sortedEntities,
  onDeleteRecord,
  onEditEntity,
  onEditRecord,
  onIdentifyRecord,
  onSpendCoins,
  onStartAddRecord,
  onToggleContainerCollapsed,
}: {
  appState: AppState;
  collapsedContainerIds: Set<InventoryRecordId>;
  sortedEntities: Entity[];
} & EntityRowCallbacks) {
  const moveInventoryRecord = useAppStore((state) => state.moveInventoryRecord);
  const swapInventoryRecords = useAppStore(
    (state) => state.swapInventoryRecords,
  );
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | undefined>();
  const [dragMessage, setDragMessage] = useState<string | undefined>();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: inventoryKeyboardCoordinates }),
  );

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current as RecordDragData | undefined;

    if (!data || data.type !== "record") {
      return;
    }

    setActiveDrag({ type: "record", recordId: data.recordId });
    setDragMessage(undefined);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDrag(undefined);

    const activeData = event.active.data.current as RecordDragData | undefined;
    const overData = event.over?.data.current as RecordDropData | undefined;

    if (!activeData || activeData.type !== "record") {
      return;
    }

    const resolution = resolveRecordDropWithInventory(
      activeData,
      overData?.type === "record" ? (overData as RecordDropData) : undefined,
      appState.inventoryRecords,
    );

    if (!resolution) {
      return;
    }

    if (resolution.kind === "move") {
      const result = moveInventoryRecord(resolution.recordId, resolution.location);

      if (!result.ok) {
        setDragMessage(result.message);
      }

      return;
    }

    if (resolution.kind === "twoHandSwap") {
      const displacedResult = moveInventoryRecord(
        resolution.displacedRecordId,
        resolution.displacedLocation,
      );

      if (!displacedResult.ok) {
        setDragMessage(displacedResult.message);
        return;
      }

      const twoHandedResult = moveInventoryRecord(
        resolution.twoHandedRecordId,
        resolution.twoHandedLocation,
      );

      if (!twoHandedResult.ok) {
        setDragMessage(twoHandedResult.message);
      }

      return;
    }

    const swapResult = swapInventoryRecords(
      resolution.recordIdA,
      resolution.recordIdB,
    );

    if (!swapResult.ok) {
      const fallbackResult = moveInventoryRecord(
        resolution.fallback.recordId,
        resolution.fallback.location,
      );

      if (!fallbackResult.ok) {
        setDragMessage(fallbackResult.message);
      }
    }
  }

  const activeRecord =
    activeDrag?.type === "record"
      ? getRecordById(activeDrag.recordId, appState.inventoryRecords)
      : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={dragTypeScopedCollisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDrag(undefined)}
    >
      <ul
        className="entity-list inventory-entity-grid"
        aria-label="Inventory entities"
      >
        {sortedEntities.map((entity) => (
          <EntityInventoryRow
            appState={appState}
            collapsedContainerIds={collapsedContainerIds}
            entity={entity}
            key={entity.id}
            onDeleteRecord={onDeleteRecord}
            onEditEntity={onEditEntity}
            onEditRecord={onEditRecord}
            onIdentifyRecord={onIdentifyRecord}
            onSpendCoins={onSpendCoins}
            onStartAddRecord={onStartAddRecord}
            onToggleContainerCollapsed={onToggleContainerCollapsed}
          />
        ))}
      </ul>

      <DragOverlay>
        {activeRecord ? (
          <div className="record-row drag-overlay-card">
            <InventoryRowSummary
              record={activeRecord}
              allRecords={appState.inventoryRecords}
            />
          </div>
        ) : null}
      </DragOverlay>

      <div className="drag-live-region" role="status" aria-live="polite">
        {dragMessage ?? ""}
      </div>
    </DndContext>
  );
}

function EntityInventoryRow({
  appState,
  collapsedContainerIds,
  entity,
  onDeleteRecord,
  onEditEntity,
  onEditRecord,
  onIdentifyRecord,
  onSpendCoins,
  onStartAddRecord,
  onToggleContainerCollapsed,
}: {
  appState: AppState;
  collapsedContainerIds: Set<InventoryRecordId>;
  entity: Entity;
} & EntityRowCallbacks) {
  return (
    <li
      className="entity-row"
      data-inactive={!entity.active}
    >
      <EntityDefaultDropZone entityId={entity.id}>
        <EntitySummary
          appState={appState}
          entity={entity}
          onEditEntity={onEditEntity}
        />
      </EntityDefaultDropZone>

      <InventoryDisplay
        entity={entity}
        appState={appState}
        collapsedContainerIds={collapsedContainerIds}
        onDeleteRecord={onDeleteRecord}
        onEditRecord={onEditRecord}
        onIdentifyRecord={onIdentifyRecord}
        onSpendCoins={onSpendCoins}
        onStartAddRecord={onStartAddRecord}
        onToggleContainerCollapsed={onToggleContainerCollapsed}
      />
    </li>
  );
}
