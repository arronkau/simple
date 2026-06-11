import {
  createContext,
  Fragment,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { getSortedEntities } from "../model/entities";
import {
  getCharacterEncumbrance,
  getContentsCapacity,
  type CharacterEncumbranceResult,
} from "../model/encumbrance";
import {
  getContainerSlotUsage,
  getRecordSlotBurden,
  isArmorClassActiveRecord,
} from "../model/calculations";
import {
  getContainerContents,
  getInventorySections,
  getOwnedRecords,
  getRecordById,
  type CharacterInventorySections,
} from "../model/inventoryDisplay";
import { getInventoryRowDisplay } from "../model/inventoryRowDisplay";
import { isCharacterLikeEntity } from "../model/validation";
import {
  sortInventoryRecordsBySortOrder,
  type InventoryRecordLocationInput,
} from "../model/inventoryRecords";
import { getRecordHandsRequired } from "../model/types";
import type { AppState } from "../model/appState";
import { getEntityInventoryStatus } from "../entity/EntityStatus";
import { WarningDetailsButton } from "../ui/WarningDetailsButton";
import { ItemStatusIcon } from "../components/InventoryIcons";
import type {
  Entity,
  EntityId,
  InventoryRecord,
  InventoryRecordId,
  PartyRole,
} from "../model/types";
import {
  useAppStore,
  type InventoryMutationResult,
} from "../store/useAppStore";
import {
  containerDropId,
  contentsDropId,
  dropTargetToLocationInput,
  gapDropId,
  handDropId,
  looseDropId,
  recordDraggableId,
  zoneKeyForTarget,
  type GearDragData,
  type GearDropData,
  type GearDropTarget,
  type GearGapData,
  type GearOverData,
} from "./gearDnd";
import { projectMove, type MoveProjection } from "./gearProjection";
import {
  findDefaultFloorEntity,
  resolveFloorEntity,
  useFloorUiStore,
} from "./floorUiStore";

// ---------------------------------------------------------------------------
// Callbacks the gear board needs to drive the shared record/entity modals.
// ---------------------------------------------------------------------------

export type GearActions = {
  currentUserPartyRole?: PartyRole | null;
  onStartCreateEntity: () => void;
  onStartAddRecord: (entity: Entity) => void;
  onEditEntity: (entity: Entity) => void;
  onEditRecord: (record: InventoryRecord) => void;
  onIdentifyRecord: (recordId: InventoryRecordId) => InventoryMutationResult;
  onSpendCoins: (record: InventoryRecord) => void;
  /** Open the take-all/take-some coin transfer modal for a dragged coin pile. */
  onRequestCoinTransfer: (
    record: InventoryRecord,
    destinationEntityId: EntityId,
  ) => void;
};

const GearActionsContext = createContext<GearActions | null>(null);

function useGearActions(): GearActions {
  const actions = useContext(GearActionsContext);

  if (!actions) {
    throw new Error("GearActionsContext is missing");
  }

  return actions;
}

// Drag state shared with each zone so it can render its own ring + pill.
type GearDragState = {
  activeRecordId: InventoryRecordId | null;
  overId: string | null;
  projection: MoveProjection | null;
  justMovedId: InventoryRecordId | null;
};

const GearDragContext = createContext<GearDragState>({
  activeRecordId: null,
  overId: null,
  projection: null,
  justMovedId: null,
});

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function PartyGearPage(actions: GearActions) {
  const appState = useAppStore((state) => state.appState);
  const partyId = useAppStore((state) => state.partyId);
  const moveInventoryRecord = useAppStore((state) => state.moveInventoryRecord);
  const moveInventoryRecords = useAppStore(
    (state) => state.moveInventoryRecords,
  );
  const createEntity = useAppStore((state) => state.createEntity);
  const floorByParty = useFloorUiStore((state) => state.floorByParty);
  const setFloorEntityId = useFloorUiStore((state) => state.setFloorEntityId);

  const records = appState.inventoryRecords;
  const entities = appState.entities;
  const sortedEntities = useMemo(() => getSortedEntities(entities), [entities]);
  const floorEntity = resolveFloorEntity(partyId, floorByParty, entities);

  const boardEntities = sortedEntities.filter(
    (entity) => entity.active && entity.id !== floorEntity?.id,
  );

  // When the Floor was found by the cross-client name fallback (no local
  // mapping yet), record its id so the designation survives a later rename.
  useEffect(() => {
    if (floorEntity && floorByParty[partyId] !== floorEntity.id) {
      setFloorEntityId(partyId, floorEntity.id);
    }
  }, [floorEntity, floorByParty, partyId, setFloorEntityId]);

  const [dragState, setDragState] = useState<GearDragState>({
    activeRecordId: null,
    overId: null,
    projection: null,
    justMovedId: null,
  });
  const [dragMessage, setDragMessage] = useState<string | undefined>();
  const justMovedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor),
  );

  function resetDrag(justMovedId: InventoryRecordId | null = null) {
    setDragState({
      activeRecordId: null,
      overId: null,
      projection: null,
      justMovedId,
    });
  }

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current as GearDragData | undefined;

    if (!data || data.type !== "gear-record") {
      return;
    }

    setDragMessage(undefined);
    setDragState({
      activeRecordId: data.recordId,
      overId: null,
      projection: null,
      justMovedId: null,
    });
  }

  function isCoinDropOnCharacter(
    recordId: InventoryRecordId,
    targetEntityId: EntityId,
  ): boolean {
    const record = getRecordById(recordId, records);
    const targetEntity = entities.find((entity) => entity.id === targetEntityId);

    return (
      record?.recordType === "coins" &&
      targetEntity !== undefined &&
      isCharacterLikeEntity(targetEntity)
    );
  }

  function handleDragOver(event: DragOverEvent) {
    const activeData = event.active.data.current as GearDragData | undefined;
    const overData = event.over?.data.current as GearOverData | undefined;
    const overId = event.over ? String(event.over.id) : null;

    // Only zone drops show the projection pill; reorder gaps just show a line.
    if (!activeData || !overData || overData.type !== "gear-zone" || !overId) {
      setDragState((state) => ({ ...state, overId: null, projection: null }));
      return;
    }

    const projection = isCoinDropOnCharacter(
      activeData.recordId,
      overData.target.entityId,
    )
      ? { text: "→ purse", invalid: false }
      : projectMove(records, activeData.recordId, overData.target, entities);

    setDragState((state) => ({ ...state, overId, projection }));
  }

  function flashMoved(recordId: InventoryRecordId) {
    setDragMessage(undefined);
    resetDrag(recordId);

    if (justMovedTimer.current) {
      clearTimeout(justMovedTimer.current);
    }

    justMovedTimer.current = setTimeout(() => {
      setDragState((state) =>
        state.justMovedId === recordId
          ? { ...state, justMovedId: null }
          : state,
      );
    }, 800);
  }

  function applyMove(
    recordId: InventoryRecordId,
    target: GearDropTarget,
    targetIndex: number | undefined,
  ) {
    if (isCoinDropOnCharacter(recordId, target.entityId)) {
      const record = getRecordById(recordId, records);

      if (record) {
        actions.onRequestCoinTransfer(record, target.entityId);
      }

      resetDrag();
      return;
    }

    const record = getRecordById(recordId, records);

    // Dropping onto a hand manages hand occupancy like the original design: a
    // two-handed record takes both hands (displacing held items to worn), and a
    // one-hander displaces a two-hander that was occupying both hands.
    if (record && isHandPlacement(target.placement)) {
      const sequence = buildHandDropSequence(
        record,
        target.placement,
        target.entityId,
        records,
      );
      // One batched mutation → a single re-render, so the displaced hands don't
      // flicker through intermediate states.
      const handResult = moveInventoryRecords(sequence);

      if (!handResult.ok) {
        setDragMessage(handResult.message);
        resetDrag();
        return;
      }

      flashMoved(recordId);
      return;
    }

    const location = dropTargetToLocationInput(target);
    const result = moveInventoryRecord(
      recordId,
      targetIndex === undefined ? location : { ...location, targetIndex },
    );

    if (!result.ok) {
      setDragMessage(result.message);
      resetDrag();
      return;
    }

    flashMoved(recordId);
  }

  function handleDragEnd(event: DragEndEvent) {
    const activeData = event.active.data.current as GearDragData | undefined;
    const overData = event.over?.data.current as GearOverData | undefined;

    if (!activeData || !overData) {
      resetDrag();
      return;
    }

    if (overData.type === "gear-gap") {
      let targetIndex = overData.index;

      // Same-list reorder: the gap index counts the dragged row, so adjust.
      if (
        activeData.zoneKey === overData.zoneKey &&
        activeData.index !== undefined
      ) {
        if (overData.index > activeData.index) {
          targetIndex -= 1;
        }

        if (targetIndex === activeData.index) {
          resetDrag();
          return;
        }
      }

      applyMove(activeData.recordId, overData.target, targetIndex);
      return;
    }

    applyMove(activeData.recordId, overData.target, undefined);
  }

  function handleCreateFloor() {
    // Adopt an existing shared Floor rather than creating a duplicate.
    const existing = findDefaultFloorEntity(entities);

    if (existing) {
      setFloorEntityId(partyId, existing.id);
      return;
    }

    const floorId = createEntity({ name: "Floor", entityType: "storage" });

    if (floorId) {
      setFloorEntityId(partyId, floorId);
    } else {
      setDragMessage("Only the GM can create the Floor.");
    }
  }

  const activeRecord = dragState.activeRecordId
    ? getRecordById(dragState.activeRecordId, records)
    : undefined;

  return (
    <GearActionsContext.Provider value={actions}>
      <GearDragContext.Provider value={dragState}>
        <DndContext
          sensors={sensors}
          collisionDetection={gearCollisionDetection}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={() => resetDrag()}
        >
          <div
            className={`gear-page${dragState.activeRecordId ? " dragging" : ""}`}
          >
            <div className="gear-subbar">
              <div className="gear-legend">
                <span className="leg">
                  Drag a row — across cards too
                </span>
                <span className="leg">
                  <span className="dot lit" /> lit
                </span>
                <span className="leg">
                  <span className="gl unid">?</span> unidentified
                </span>
                <span className="leg">
                  <span className="gl">✦</span> magic
                </span>
              </div>
              <button
                type="button"
                className="ghost-btn"
                onClick={actions.onStartCreateEntity}
              >
                Add entity
              </button>
            </div>

            {boardEntities.length === 0 ? (
              <p className="empty-state">No active entities to outfit yet.</p>
            ) : (
              <div className="gear-board">
                {boardEntities.map((entity) => (
                  <GearEntityCard
                    key={entity.id}
                    appState={appState}
                    entity={entity}
                    records={records}
                  />
                ))}
              </div>
            )}
          </div>

          <FloorTray
            floorEntity={floorEntity}
            records={records}
            onCreateFloor={handleCreateFloor}
          />

          <DragOverlay dropAnimation={null}>
            {activeRecord ? (
              <div className="item item-overlay">
                <span className="grip" aria-hidden="true">
                  ⠿
                </span>
                <span className="iname">
                  {getInventoryRowDisplay(activeRecord, records).primaryText}
                </span>
              </div>
            ) : null}
          </DragOverlay>

          <div className="drag-live-region" role="status" aria-live="polite">
            {dragMessage ?? ""}
          </div>
        </DndContext>
      </GearDragContext.Provider>
    </GearActionsContext.Provider>
  );
}

const gearCollisionDetection: CollisionDetection = (args) => {
  const droppableContainers = args.droppableContainers.filter((container) => {
    const type = container.data.current?.type;
    return type === "gear-zone" || type === "gear-gap";
  });
  const scopedArgs = { ...args, droppableContainers };
  const pointerCollisions = pointerWithin(scopedArgs);

  if (pointerCollisions.length === 0) {
    return closestCenter(scopedArgs);
  }

  // Prefer a reorder gap when the pointer is between rows.
  const gapContainers = droppableContainers.filter(
    (container) =>
      container.data.current?.type === "gear-gap" &&
      pointerCollisions.some((collision) => collision.id === container.id),
  );

  if (gapContainers.length > 0) {
    return closestCenter({ ...args, droppableContainers: gapContainers });
  }

  // Otherwise prefer the innermost (smallest) zone — e.g. a container over the
  // contents root it sits in, or a nested container over its parent.
  let best = pointerCollisions[0];
  let bestArea = Number.POSITIVE_INFINITY;

  for (const collision of pointerCollisions) {
    const rect = args.droppableRects.get(collision.id);
    const area = rect ? rect.width * rect.height : Number.POSITIVE_INFINITY;

    if (area < bestArea) {
      bestArea = area;
      best = collision;
    }
  }

  return [best];
};

// ---------------------------------------------------------------------------
// Entity cards
// ---------------------------------------------------------------------------

function GearEntityCard({
  appState,
  entity,
  records,
}: {
  appState: AppState;
  entity: Entity;
  records: InventoryRecord[];
}) {
  if (isCharacterLikeEntity(entity)) {
    return (
      <CharacterGearCard appState={appState} entity={entity} records={records} />
    );
  }

  return (
    <ContentsGearCard appState={appState} entity={entity} records={records} />
  );
}

function CharacterGearCard({
  appState,
  entity,
  records,
}: {
  appState: AppState;
  entity: Entity;
  records: InventoryRecord[];
}) {
  const actions = useGearActions();
  const sections = getInventorySections(
    entity,
    records,
  ) as CharacterInventorySections;
  const encumbrance = getCharacterEncumbrance(entity, records);
  const status = getEntityInventoryStatus(entity, appState);
  const total = encumbrance.equippedItems + encumbrance.stowedItems;
  const tone = capacityTone(total, 16);
  const subtitle = formatCharacterSubtitle(entity);
  const backpack = sections.topLevelStowedContainerRecord;
  const defaultTarget: GearDropTarget = backpack
    ? { entityId: entity.id, placement: "container", containerId: backpack.id }
    : { entityId: entity.id, placement: "equippedLoose" };

  return (
    <article className="rs-card" data-inactive={!entity.active}>
      <EntityHeaderDrop entityId={entity.id} target={defaultTarget}>
        <div className="top">
          <button
            type="button"
            className="nm nm-button"
            onClick={() => actions.onEditEntity(entity)}
          >
            {entity.name}
          </button>
          <span className="sub">{subtitle}</span>
          <MovementBadge encumbrance={encumbrance} />
          <WarningDetailsButton
            validationIssues={status.validationIssues}
            warnings={status.warnings}
          />
        </div>
        <div className="meter">
          <CapBar used={total} max={16} tone={tone} />
          <FreeBadge free={16 - total} tone={tone} />
        </div>
      </EntityHeaderDrop>

      <div className="zone ready-zone">
        <div className="zhead">
          <span className="micro">Ready</span>
        </div>
        <HandRows entityId={entity.id} sections={sections} records={records} />
        <div className="worn-label micro">Worn</div>
        <WornZone
          entityId={entity.id}
          records={records}
          worn={sections.otherEquipped}
        />
      </div>

      <div className="zone stowed-zone">
        <div className="zhead">
          <span className="micro">Stowed</span>
        </div>
        <CoinRow record={sections.coinRecord} />
        {backpack ? (
          <ContainerBlock
            entityId={entity.id}
            container={backpack}
            records={records}
          />
        ) : (
          <p className="empty-label">No stowed container.</p>
        )}
      </div>

      <div className="rs-foot">
        <button
          type="button"
          className="add-link"
          onClick={() => actions.onStartAddRecord(entity)}
        >
          + Add item
        </button>
      </div>
    </article>
  );
}

function ContentsGearCard({
  appState,
  entity,
  records,
}: {
  appState: AppState;
  entity: Entity;
  records: InventoryRecord[];
}) {
  const actions = useGearActions();
  const capacity = getContentsCapacity(entity, records);
  const status = getEntityInventoryStatus(entity, appState);
  const contentsTarget: GearDropTarget = {
    entityId: entity.id,
    placement: "contents",
  };
  const contents = sortInventoryRecordsBySortOrder(
    getOwnedRecords(entity.id, records).filter(
      (record) => record.location.kind === "contents",
    ),
  );

  return (
    <article className="rs-card" data-inactive={!entity.active}>
      <EntityHeaderDrop entityId={entity.id} target={contentsTarget}>
        <div className="top">
          <button
            type="button"
            className="nm nm-button"
            onClick={() => actions.onEditEntity(entity)}
          >
            {entity.name}
          </button>
          <span className="kind-pill">{entity.entityType}</span>
          {entity.baseMovementFeet !== undefined ? (
            <span className="mv">{entity.baseMovementFeet}′</span>
          ) : null}
          <WarningDetailsButton
            validationIssues={status.validationIssues}
            warnings={status.warnings}
          />
        </div>
        {capacity.capacitySlots !== undefined ? (
          <div className="meter">
            <CapBar
              used={capacity.usedSlots}
              max={capacity.capacitySlots}
              tone={capacityTone(capacity.usedSlots, capacity.capacitySlots)}
            />
            <FreeBadge
              free={capacity.capacitySlots - capacity.usedSlots}
              tone={capacityTone(capacity.usedSlots, capacity.capacitySlots)}
            />
          </div>
        ) : null}
      </EntityHeaderDrop>

      <div className="zone stowed-zone">
        <div className="zhead">
          <span className="micro">Contents</span>
        </div>
        <GearDropZone
          dropId={contentsDropId(entity.id)}
          target={contentsTarget}
          className="zone-body"
        >
          <RecordList
            entityId={entity.id}
            target={contentsTarget}
            records={contents}
            allRecords={records}
            emptyLabel="empty — drop here"
          />
        </GearDropZone>
      </div>

      <div className="rs-foot">
        <button
          type="button"
          className="add-link"
          onClick={() => actions.onStartAddRecord(entity)}
        >
          + Add item
        </button>
      </div>
    </article>
  );
}

function EntityHeaderDrop({
  entityId,
  target,
  children,
}: {
  entityId: EntityId;
  target: GearDropTarget;
  children: ReactNode;
}) {
  const drag = useContext(GearDragContext);
  const dropId = `drop:${entityId}:header`;
  const data: GearDropData = { type: "gear-zone", target };
  const { setNodeRef, isOver } = useDroppable({ id: dropId, data });
  const projection = isOver && drag.overId === dropId ? drag.projection : null;

  return (
    <div
      ref={setNodeRef}
      className={`rs-head dropzone no-reveal${isOver ? " over" : ""}${
        projection?.invalid ? " over-bad" : ""
      }`}
      data-proj={projection?.text ?? undefined}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header pieces
// ---------------------------------------------------------------------------

type LoadTone = "ok" | "warn" | "crit";

function capacityTone(used: number, max: number): LoadTone {
  if (used > max) {
    return "crit";
  }

  return used / max >= 0.85 ? "warn" : "ok";
}

function MovementBadge({
  encumbrance,
}: {
  encumbrance: CharacterEncumbranceResult;
}) {
  // Keep movement colors restrained: only the bottom tier (30') is amber and
  // overloaded (0') is red; 120'/90'/60' read as neutral.
  const cls = encumbrance.overloaded
    ? "zero"
    : encumbrance.band === "heavilyEncumbered"
      ? "reduced"
      : "";
  const text = encumbrance.overloaded
    ? "0′"
    : `${encumbrance.movement.explorationFeet}′ (${encumbrance.movement.encounterFeet}′)`;

  return (
    <span className={`mv ${cls}`}>
      {encumbrance.overloaded ? "⚠ " : ""}
      {text}
    </span>
  );
}

function CapBar({
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

function FreeBadge({ free, tone }: { free: number; tone: LoadTone }) {
  return (
    <span className={`free ${tone === "ok" ? "" : tone}`}>
      {free >= 0 ? `${free} free` : `${-free} over`}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Ready zone
// ---------------------------------------------------------------------------

function HandRows({
  entityId,
  sections,
  records,
}: {
  entityId: string;
  sections: CharacterInventorySections;
  records: InventoryRecord[];
}) {
  const bothHandsRecord = getRecordById(
    sections.handRecordIds.bothHands,
    records,
  );

  if (bothHandsRecord) {
    return (
      <HandSlot
        entityId={entityId}
        placement="bothHands"
        label="Both hands"
        record={bothHandsRecord}
        records={records}
      />
    );
  }

  return (
    <>
      <HandSlot
        entityId={entityId}
        placement="leftHand"
        label="Left"
        record={getRecordById(sections.handRecordIds.leftHand, records)}
        records={records}
      />
      <HandSlot
        entityId={entityId}
        placement="rightHand"
        label="Right"
        record={getRecordById(sections.handRecordIds.rightHand, records)}
        records={records}
      />
    </>
  );
}

function HandSlot({
  entityId,
  placement,
  label,
  record,
  records,
}: {
  entityId: string;
  placement: "leftHand" | "rightHand" | "bothHands";
  label: string;
  record?: InventoryRecord;
  records: InventoryRecord[];
}) {
  const isBoth = placement === "bothHands";

  return (
    <GearDropZone
      dropId={handDropId(entityId, placement)}
      target={{ entityId, placement }}
      className={`hand${record ? "" : " empty"}${isBoth ? " both" : ""}`}
    >
      <span className="hlabel">{isBoth ? "Both hands" : label}</span>
      {record ? (
        <DraggableRow record={record} allRecords={records} />
      ) : (
        <span className="empty-label">empty</span>
      )}
    </GearDropZone>
  );
}

function WornZone({
  entityId,
  worn,
  records,
}: {
  entityId: string;
  worn: InventoryRecord[];
  records: InventoryRecord[];
}) {
  const target: GearDropTarget = { entityId, placement: "equippedLoose" };

  return (
    <GearDropZone
      dropId={looseDropId(entityId)}
      target={target}
      className={`worn${worn.length === 0 ? " empty" : ""}`}
    >
      <RecordList
        entityId={entityId}
        target={target}
        records={worn}
        allRecords={records}
        emptyLabel="nothing worn — drop here"
      />
    </GearDropZone>
  );
}

function CoinRow({ record }: { record?: InventoryRecord }) {
  const actions = useGearActions();

  if (!record || record.recordType !== "coins") {
    return null;
  }

  const display = getInventoryRowDisplay(record, [record]);

  return (
    <div className="coinrow">
      <button
        type="button"
        className="micro coins-label coins-label-button"
        onClick={() => actions.onEditRecord(record)}
      >
        Coins
      </button>
      <span className="coins">{display.primaryText}</span>
      <Pips slots={getRecordSlotBurden(record)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Containers + ordered record lists
// ---------------------------------------------------------------------------

function ContainerBlock({
  entityId,
  container,
  records,
  zoneKey,
  index,
}: {
  entityId: string;
  container: InventoryRecord;
  records: InventoryRecord[];
  /** Parent list key + index, present when this container can be reordered. */
  zoneKey?: string;
  index?: number;
}) {
  const contents = getContainerContents(container, records);
  const usage = getContainerSlotUsage(container, records);
  const overCapacity =
    usage.capacitySlots !== undefined && usage.usedSlots > usage.capacitySlots;
  const tone: LoadTone =
    usage.capacitySlots === undefined
      ? "ok"
      : capacityTone(usage.usedSlots, usage.capacitySlots);
  const containerTarget: GearDropTarget = {
    entityId,
    placement: "container",
    containerId: container.id,
  };

  // The whole container block (header + contents) is a single drop target, so
  // hovering anywhere over it outlines the entire block with one indicator.
  return (
    <GearDropZone
      dropId={containerDropId(entityId, container.id)}
      target={containerTarget}
      className="cont"
    >
      <ContainerHeader
        container={container}
        allRecords={records}
        zoneKey={zoneKey}
        index={index}
      >
        {usage.capacitySlots !== undefined ? (
          <>
            <CapBar used={usage.usedSlots} max={usage.capacitySlots} tone={tone} />
            <FreeBadge
              free={usage.capacitySlots - usage.usedSlots}
              tone={overCapacity ? "crit" : tone}
            />
          </>
        ) : null}
      </ContainerHeader>
      <div className={`cbody${contents.length === 0 ? " empty" : ""}`}>
        <RecordList
          entityId={entityId}
          target={containerTarget}
          records={contents}
          allRecords={records}
          emptyLabel="empty — drop here"
        />
      </div>
    </GearDropZone>
  );
}

function ContainerHeader({
  container,
  allRecords,
  zoneKey,
  index,
  children,
}: {
  container: InventoryRecord;
  allRecords: InventoryRecord[];
  zoneKey?: string;
  index?: number;
  children: ReactNode;
}) {
  const actions = useGearActions();
  const drag = useContext(GearDragContext);
  const dragData: GearDragData = {
    type: "gear-record",
    recordId: container.id,
    zoneKey,
    index,
  };
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: recordDraggableId(container.id),
    data: dragData,
  });
  const className = [
    "chead",
    "drag-row",
    isDragging ? "drag-ghost" : "",
    drag.justMovedId === container.id ? "justmoved" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={setNodeRef} className={className} {...attributes} {...listeners}>
      <span className="grip" aria-hidden="true">
        ⠿
      </span>
      <button
        type="button"
        className="cname"
        onClick={() => actions.onEditRecord(container)}
      >
        {getInventoryRowDisplay(container, allRecords).primaryText}
      </button>
      {children}
    </div>
  );
}

function RecordList({
  entityId,
  target,
  records,
  allRecords,
  emptyLabel,
}: {
  entityId: string;
  target: GearDropTarget;
  records: InventoryRecord[];
  allRecords: InventoryRecord[];
  emptyLabel: string;
}) {
  const zoneKey = zoneKeyForTarget(target);

  if (records.length === 0) {
    return <span className="empty-label">{emptyLabel}</span>;
  }

  return (
    <div className="record-list">
      <GapDrop target={target} zoneKey={zoneKey} index={0} />
      {records.map((record, recordIndex) => (
        <Fragment key={record.id}>
          {record.container ? (
            <ContainerBlock
              entityId={entityId}
              container={record}
              records={allRecords}
              zoneKey={zoneKey}
              index={recordIndex}
            />
          ) : (
            <DraggableRow
              record={record}
              allRecords={allRecords}
              zoneKey={zoneKey}
              index={recordIndex}
            />
          )}
          <GapDrop target={target} zoneKey={zoneKey} index={recordIndex + 1} />
        </Fragment>
      ))}
    </div>
  );
}

function GapDrop({
  target,
  zoneKey,
  index,
}: {
  target: GearDropTarget;
  zoneKey: string;
  index: number;
}) {
  const data: GearGapData = { type: "gear-gap", target, zoneKey, index };
  const { setNodeRef, isOver } = useDroppable({
    id: gapDropId(zoneKey, index),
    data,
  });

  return (
    <div
      ref={setNodeRef}
      className={`gear-gap${isOver ? " over" : ""}`}
      aria-hidden="true"
    />
  );
}

function DraggableRow({
  record,
  allRecords,
  zoneKey,
  index,
}: {
  record: InventoryRecord;
  allRecords: InventoryRecord[];
  zoneKey?: string;
  index?: number;
}) {
  const drag = useContext(GearDragContext);
  const data: GearDragData = {
    type: "gear-record",
    recordId: record.id,
    zoneKey,
    index,
  };
  // The whole row is the drag handle (the small grip was too hard to hit).
  // The DragOverlay is the only moving preview — never transform the source.
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: recordDraggableId(record.id),
    data,
  });
  const className = [
    "item",
    "drag-row",
    isDragging ? "drag-ghost" : "",
    drag.justMovedId === record.id ? "justmoved" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={setNodeRef}
      className={className}
      data-record-id={record.id}
      {...attributes}
      {...listeners}
    >
      <span className="grip" aria-hidden="true">
        ⠿
      </span>
      <RecordRowBody record={record} allRecords={allRecords} />
    </div>
  );
}

function RecordRowBody({
  record,
  allRecords,
}: {
  record: InventoryRecord;
  allRecords: InventoryRecord[];
}) {
  const actions = useGearActions();
  const display = getInventoryRowDisplay(record, allRecords);
  const canIdentify =
    actions.currentUserPartyRole !== "player" && canIdentifyRecord(record);

  return (
    <>
      <button
        type="button"
        className="iname iname-button"
        onClick={() => actions.onEditRecord(record)}
      >
        {display.primaryText}
      </button>
      <StateGlyphs record={record} />
      {display.secondaryText ? (
        <span className="isecondary">{display.secondaryText}</span>
      ) : null}
      {canIdentify ? (
        <button
          type="button"
          className="act"
          onClick={() => actions.onIdentifyRecord(record.id)}
        >
          Identify
        </button>
      ) : null}
      <Pips slots={getRecordSlotBurden(record)} />
    </>
  );
}

function StateGlyphs({ record }: { record: InventoryRecord }) {
  if (record.recordType === "coins") {
    return null;
  }

  const lit = record.light?.isLit === true;
  const unidentified = isUnidentified(record);
  const magic = record.isMagic === true;
  const activeAc = isArmorClassActiveRecord(record);

  return (
    <span className="rs-glyphs">
      {lit ? (
        <span className="dot lit" title={buildLitTitle(record)} />
      ) : null}
      {activeAc ? (
        <span className="rs-ac" title="Contributes to armor class">
          <ItemStatusIcon name="activeAc" tone="active" />
        </span>
      ) : null}
      {unidentified ? (
        <span className="gl unid" title="unidentified">
          ?
        </span>
      ) : magic ? (
        <span className="gl" title="magical">
          ✦
        </span>
      ) : null}
    </span>
  );
}

function Pips({ slots }: { slots: number }) {
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

// ---------------------------------------------------------------------------
// Drop zone
// ---------------------------------------------------------------------------

function GearDropZone({
  dropId,
  target,
  className,
  children,
}: {
  dropId: string;
  target: GearDropTarget;
  className: string;
  children: ReactNode;
}) {
  const drag = useContext(GearDragContext);
  const data: GearDropData = { type: "gear-zone", target };
  const { setNodeRef, isOver } = useDroppable({ id: dropId, data });
  const projection = isOver && drag.overId === dropId ? drag.projection : null;

  return (
    <div
      ref={setNodeRef}
      className={`dropzone ${className}${isOver ? " over" : ""}${
        projection?.invalid ? " over-bad" : ""
      }`}
      data-proj={projection?.text ?? undefined}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The Floor (treasure tray)
// ---------------------------------------------------------------------------

function FloorTray({
  floorEntity,
  records,
  onCreateFloor,
}: {
  floorEntity?: Entity;
  records: InventoryRecord[];
  onCreateFloor: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  if (!floorEntity) {
    return (
      <aside className="tray">
        <div className="tinner">
          <div className="thead">
            <span className="tt">The Floor</span>
            <span className="tmeta">not set up</span>
            <button type="button" className="collapse" onClick={onCreateFloor}>
              Create the Floor
            </button>
          </div>
        </div>
      </aside>
    );
  }

  const capacity = getContentsCapacity(floorEntity, records);
  const contents = sortInventoryRecordsBySortOrder(
    getOwnedRecords(floorEntity.id, records).filter(
      (record) => record.location.kind === "contents",
    ),
  );

  return (
    <aside className={`tray${collapsed ? " collapsed" : ""}`}>
      <div className="tinner">
        <div className="thead">
          <span className="tt">The Floor</span>
          <span className="tmeta">
            <b>{contents.length}</b> {contents.length === 1 ? "lot" : "lots"} ·{" "}
            <b>{capacity.usedSlots}</b>{" "}
            {capacity.usedSlots === 1 ? "slot" : "slots"} to place
          </span>
          <button
            type="button"
            className="collapse"
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? "Show" : "Hide"}
          </button>
        </div>
        {collapsed ? null : (
          <GearDropZone
            dropId={contentsDropId(floorEntity.id)}
            target={{ entityId: floorEntity.id, placement: "contents" }}
            className="tbody"
          >
            {contents.length === 0 ? (
              <span className="hint-empty">
                All treasure distributed — the party can move out.
              </span>
            ) : (
              contents.map((record) =>
                record.container ? (
                  <ContainerBlock
                    key={record.id}
                    entityId={floorEntity.id}
                    container={record}
                    records={records}
                  />
                ) : (
                  <DraggableRow
                    key={record.id}
                    record={record}
                    allRecords={records}
                  />
                ),
              )
            )}
          </GearDropZone>
        )}
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HAND_PLACEMENTS = ["leftHand", "rightHand", "bothHands"] as const;
type HandPlacement = (typeof HAND_PLACEMENTS)[number];

function isHandPlacement(
  placement: GearDropTarget["placement"],
): placement is HandPlacement {
  return (
    placement === "leftHand" ||
    placement === "rightHand" ||
    placement === "bothHands"
  );
}

/**
 * Hand-occupancy management for a drop onto a hand slot, mirroring the original
 * design: a two-handed record takes both hands (any held items move to worn),
 * and a one-hander frees a two-hander that was occupying both hands. The
 * displacements run before the main placement so each validated move is legal.
 */
function buildHandDropSequence(
  record: InventoryRecord,
  placement: HandPlacement,
  entityId: EntityId,
  records: InventoryRecord[],
): { recordId: InventoryRecordId; location: InventoryRecordLocationInput }[] {
  const occupant = (hand: HandPlacement) =>
    records.find(
      (candidate) =>
        candidate.id !== record.id &&
        candidate.entityId === entityId &&
        candidate.location.kind === "equipped" &&
        candidate.location.placement === hand,
    );
  const loose: InventoryRecordLocationInput = {
    entityId,
    placement: "equippedLoose",
  };
  const moves: {
    recordId: InventoryRecordId;
    location: InventoryRecordLocationInput;
  }[] = [];

  if (getRecordHandsRequired(record) === 2) {
    for (const hand of HAND_PLACEMENTS) {
      const held = occupant(hand);

      if (held) {
        moves.push({ recordId: held.id, location: loose });
      }
    }

    moves.push({ recordId: record.id, location: { entityId, placement: "bothHands" } });
    return moves;
  }

  const bothHander = occupant("bothHands");

  if (bothHander) {
    moves.push({ recordId: bothHander.id, location: loose });
  }

  const targetHand: HandPlacement =
    placement === "bothHands" ? "rightHand" : placement;
  const held = occupant(targetHand);

  if (held) {
    moves.push({ recordId: held.id, location: loose });
  }

  moves.push({ recordId: record.id, location: { entityId, placement: targetHand } });
  return moves;
}

function isUnidentified(record: InventoryRecord): boolean {
  return (
    record.recordType !== "coins" &&
    record.recordType !== "treasure" &&
    record.identification?.identified === false
  );
}

// The Identify action only applies when there is a secret payload to reveal;
// the store rejects identify on records without one. (The "?" glyph still
// shows for any unidentified record.)
function canIdentifyRecord(record: InventoryRecord): boolean {
  if (record.recordType === "coins" || record.recordType === "treasure") {
    return false;
  }

  return (
    record.identification?.identified === false &&
    (Boolean(record.identification.secretName?.trim()) ||
      Boolean(record.identification.secretDescription?.trim()))
  );
}

function buildLitTitle(record: InventoryRecord): string {
  if (record.recordType === "coins") {
    return "lit";
  }

  const parts = ["lit"];
  const description = record.light?.lightDescription?.trim();

  if (description) {
    parts.push(description);
  }

  if (record.uses) {
    parts.push(
      record.uses.max !== undefined
        ? `${record.uses.current}/${record.uses.max} uses`
        : `${record.uses.current} uses`,
    );
  }

  return parts.join(" · ");
}

function formatCharacterSubtitle(entity: Entity): string {
  const character = entity.character;

  if (!character) {
    return entity.entityType;
  }

  const className = character.className.trim();
  const parts: string[] = [];

  if (className) {
    parts.push(className);
  }

  if (character.level !== null) {
    parts.push(`lvl ${character.level}`);
  }

  return parts.length > 0 ? parts.join(", ") : entity.entityType;
}
