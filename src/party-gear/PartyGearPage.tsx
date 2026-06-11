import {
  createContext,
  useContext,
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
import { CSS } from "@dnd-kit/utilities";
import { getSortedEntities } from "../model/entities";
import {
  getCharacterEncumbrance,
  getContentsCapacity,
  type CharacterEncumbranceResult,
} from "../model/encumbrance";
import { getContainerSlotUsage, getRecordSlotBurden } from "../model/calculations";
import {
  getContainerContents,
  getInventorySections,
  getOwnedRecords,
  getRecordById,
  type CharacterInventorySections,
} from "../model/inventoryDisplay";
import { getInventoryRowDisplay } from "../model/inventoryRowDisplay";
import { isCharacterLikeEntity } from "../model/validation";
import { sortInventoryRecordsBySortOrder } from "../model/inventoryRecords";
import type {
  Entity,
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
  handDropId,
  looseDropId,
  recordDraggableId,
  type GearDragData,
  type GearDropData,
  type GearDropTarget,
} from "./gearDnd";
import { projectMove, type MoveProjection } from "./gearProjection";
import { resolveFloorEntity, useFloorUiStore } from "./floorUiStore";

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

  function handleDragOver(event: DragOverEvent) {
    const activeData = event.active.data.current as GearDragData | undefined;
    const overData = event.over?.data.current as GearDropData | undefined;
    const overId = event.over ? String(event.over.id) : null;

    if (!activeData || !overData || overData.type !== "gear-zone" || !overId) {
      setDragState((state) => ({ ...state, overId: null, projection: null }));
      return;
    }

    const projection = projectMove(
      records,
      activeData.recordId,
      overData.target,
      entities,
    );

    setDragState((state) => ({ ...state, overId, projection }));
  }

  function handleDragEnd(event: DragEndEvent) {
    const activeData = event.active.data.current as GearDragData | undefined;
    const overData = event.over?.data.current as GearDropData | undefined;

    if (!activeData || !overData || overData.type !== "gear-zone") {
      resetDrag();
      return;
    }

    const result = moveInventoryRecord(
      activeData.recordId,
      dropTargetToLocationInput(overData.target),
    );

    if (!result.ok) {
      setDragMessage(result.message);
      resetDrag();
      return;
    }

    setDragMessage(undefined);
    resetDrag(activeData.recordId);

    if (justMovedTimer.current) {
      clearTimeout(justMovedTimer.current);
    }

    justMovedTimer.current = setTimeout(() => {
      setDragState((state) =>
        state.justMovedId === activeData.recordId
          ? { ...state, justMovedId: null }
          : state,
      );
    }, 800);
  }

  function handleCreateFloor() {
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
                  Drag the <b>⠿</b> handle — across cards too
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
                <span className="leg">
                  <span className="loadbar" /> load
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

          <DragOverlay>
            {activeRecord ? (
              <div className="item item-overlay">
                <span className="grip">⠿</span>
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
  const droppableContainers = args.droppableContainers.filter(
    (container) => container.data.current?.type === "gear-zone",
  );
  const scopedArgs = { ...args, droppableContainers };
  const pointerCollisions = pointerWithin(scopedArgs);

  return pointerCollisions.length > 0
    ? pointerCollisions
    : closestCenter(scopedArgs);
};

// ---------------------------------------------------------------------------
// Entity cards
// ---------------------------------------------------------------------------

function GearEntityCard({
  entity,
  records,
}: {
  entity: Entity;
  records: InventoryRecord[];
}) {
  if (isCharacterLikeEntity(entity)) {
    return <CharacterGearCard entity={entity} records={records} />;
  }

  return <ContentsGearCard entity={entity} records={records} />;
}

function CharacterGearCard({
  entity,
  records,
}: {
  entity: Entity;
  records: InventoryRecord[];
}) {
  const actions = useGearActions();
  const sections = getInventorySections(
    entity,
    records,
  ) as CharacterInventorySections;
  const encumbrance = getCharacterEncumbrance(entity, records);
  const total = encumbrance.equippedItems + encumbrance.stowedItems;
  const tone = loadTone(encumbrance);
  const subtitle = formatCharacterSubtitle(entity);

  return (
    <article className="rs-card" data-inactive={!entity.active}>
      <div className="rs-head">
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
        </div>
        <div className="meter">
          <CapBar used={total} max={16} tone={tone} />
          <FreeBadge free={16 - total} tone={tone} />
        </div>
      </div>

      <div className="zone ready-zone">
        <div className="zhead">
          <span className="micro">Ready</span>
        </div>
        <HandRows entityId={entity.id} sections={sections} records={records} />
        <div className="worn-label micro">Worn</div>
        <WornZone entityId={entity.id} records={records} worn={sections.otherEquipped} />
      </div>

      <div className="zone stowed-zone">
        <div className="zhead">
          <span className="micro">Stowed</span>
        </div>
        <CoinRow record={sections.coinRecord} />
        {sections.topLevelStowedContainerRecord ? (
          <ContainerBlock
            entityId={entity.id}
            container={sections.topLevelStowedContainerRecord}
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
  entity,
  records,
}: {
  entity: Entity;
  records: InventoryRecord[];
}) {
  const actions = useGearActions();
  const capacity = getContentsCapacity(entity, records);
  const contents = sortInventoryRecordsBySortOrder(
    getOwnedRecords(entity.id, records).filter(
      (record) => record.location.kind === "contents",
    ),
  );

  return (
    <article className="rs-card" data-inactive={!entity.active}>
      <div className="rs-head">
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
      </div>

      <div className="zone stowed-zone">
        <div className="zhead">
          <span className="micro">Contents</span>
        </div>
        <GearDropZone
          dropId={contentsDropId(entity.id)}
          target={{ entityId: entity.id, placement: "contents" }}
          className="zone-body"
        >
          <RecordRows
            entityId={entity.id}
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

// ---------------------------------------------------------------------------
// Header pieces
// ---------------------------------------------------------------------------

function loadTone(encumbrance: CharacterEncumbranceResult): LoadTone {
  if (encumbrance.overloaded) {
    return "crit";
  }

  return encumbrance.band === "normal" ? "ok" : "warn";
}

function capacityTone(used: number, max: number): LoadTone {
  if (used > max) {
    return "crit";
  }

  return used / max >= 0.85 ? "warn" : "ok";
}

type LoadTone = "ok" | "warn" | "crit";

function MovementBadge({
  encumbrance,
}: {
  encumbrance: CharacterEncumbranceResult;
}) {
  const cls = encumbrance.overloaded
    ? "zero"
    : encumbrance.band === "normal"
      ? ""
      : "reduced";
  const text = encumbrance.overloaded
    ? "0′"
    : `${encumbrance.movement.explorationFeet}′ (${encumbrance.movement.encounterFeet}′)`;

  return <span className={`mv ${cls}`}>{encumbrance.overloaded ? "⚠ " : ""}{text}</span>;
}

function CapBar({ used, max, tone }: { used: number; max: number; tone: LoadTone }) {
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
        <DraggableRecordRow record={record} allRecords={records} />
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
  return (
    <GearDropZone
      dropId={looseDropId(entityId)}
      target={{ entityId, placement: "equippedLoose" }}
      className={`worn${worn.length === 0 ? " empty" : ""}`}
    >
      {worn.length === 0 ? (
        <span className="empty-label">nothing worn — drop here</span>
      ) : (
        worn.map((record) => (
          <DraggableRecordRow
            key={record.id}
            record={record}
            allRecords={records}
          />
        ))
      )}
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
      <span className="micro coins-label">Coins</span>
      <span className="coins">{display.primaryText}</span>
      <Pips slots={getRecordSlotBurden(record)} />
      <button
        type="button"
        className="act"
        onClick={() => actions.onSpendCoins(record)}
      >
        Spend
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Containers + record rows
// ---------------------------------------------------------------------------

function ContainerBlock({
  entityId,
  container,
  records,
}: {
  entityId: string;
  container: InventoryRecord;
  records: InventoryRecord[];
}) {
  const actions = useGearActions();
  const contents = getContainerContents(container, records);
  const usage = getContainerSlotUsage(container, records);
  const overCapacity =
    usage.capacitySlots !== undefined && usage.usedSlots > usage.capacitySlots;
  const tone: LoadTone =
    usage.capacitySlots === undefined
      ? "ok"
      : capacityTone(usage.usedSlots, usage.capacitySlots);

  return (
    <div className="cont">
      <div className="chead">
        <ContainerHandle record={container} allRecords={records} />
        {usage.capacitySlots !== undefined ? (
          <>
            <CapBar
              used={usage.usedSlots}
              max={usage.capacitySlots}
              tone={tone}
            />
            <FreeBadge
              free={usage.capacitySlots - usage.usedSlots}
              tone={overCapacity ? "crit" : tone}
            />
          </>
        ) : null}
      </div>
      <GearDropZone
        dropId={containerDropId(entityId, container.id)}
        target={{ entityId, placement: "container", containerId: container.id }}
        className={`cbody${contents.length === 0 ? " empty" : ""}`}
      >
        {contents.length === 0 ? (
          <span className="empty-label">empty — drop here</span>
        ) : (
          <RecordRows
            entityId={entityId}
            records={contents}
            allRecords={records}
            emptyLabel="empty — drop here"
          />
        )}
      </GearDropZone>
    </div>
  );
}

function RecordRows({
  entityId,
  records,
  allRecords,
  emptyLabel,
}: {
  entityId: string;
  records: InventoryRecord[];
  allRecords: InventoryRecord[];
  emptyLabel: string;
}) {
  if (records.length === 0) {
    return <span className="empty-label">{emptyLabel}</span>;
  }

  return (
    <>
      {records.map((record) =>
        record.container ? (
          <ContainerBlock
            key={record.id}
            entityId={entityId}
            container={record}
            records={allRecords}
          />
        ) : record.recordType === "coins" ? (
          <StaticRecordRow key={record.id} record={record} allRecords={allRecords} />
        ) : (
          <DraggableRecordRow
            key={record.id}
            record={record}
            allRecords={allRecords}
          />
        ),
      )}
    </>
  );
}

function DraggableRecordRow({
  record,
  allRecords,
}: {
  record: InventoryRecord;
  allRecords: InventoryRecord[];
}) {
  const drag = useContext(GearDragContext);
  const data: GearDragData = { type: "gear-record", recordId: record.id };
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } =
    useDraggable({ id: recordDraggableId(record.id), data });
  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;
  const className = [
    "item",
    isDragging ? "drag-ghost" : "",
    drag.justMovedId === record.id ? "justmoved" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={setNodeRef} style={style} className={className} data-record-id={record.id}>
      <button
        ref={setActivatorNodeRef}
        type="button"
        className="grip"
        aria-label={`Move ${getInventoryRowDisplay(record, allRecords).primaryText}`}
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>
      <RecordRowBody record={record} allRecords={allRecords} />
    </div>
  );
}

function StaticRecordRow({
  record,
  allRecords,
}: {
  record: InventoryRecord;
  allRecords: InventoryRecord[];
}) {
  return (
    <div className="item item-static" data-record-id={record.id}>
      <span className="grip grip-static" aria-hidden="true">
        ⠿
      </span>
      <RecordRowBody record={record} allRecords={allRecords} />
    </div>
  );
}

function ContainerHandle({
  record,
  allRecords,
}: {
  record: InventoryRecord;
  allRecords: InventoryRecord[];
}) {
  const actions = useGearActions();
  const drag = useContext(GearDragContext);
  const data: GearDragData = { type: "gear-record", recordId: record.id };
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } =
    useDraggable({ id: recordDraggableId(record.id), data });
  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;
  const className = [
    "cname-row",
    isDragging ? "drag-ghost" : "",
    drag.justMovedId === record.id ? "justmoved" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={setNodeRef} style={style} className={className} data-record-id={record.id}>
      <button
        ref={setActivatorNodeRef}
        type="button"
        className="grip"
        aria-label={`Move ${getInventoryRowDisplay(record, allRecords).primaryText}`}
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>
      <button
        type="button"
        className="cname"
        onClick={() => actions.onEditRecord(record)}
      >
        {getInventoryRowDisplay(record, allRecords).primaryText}
      </button>
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
    actions.currentUserPartyRole !== "player" && isUnidentified(record);

  return (
    <>
      <button
        type="button"
        className="iname iname-button"
        onClick={() => actions.onEditRecord(record)}
      >
        {display.primaryText}
        <StateGlyphs record={record} />
      </button>
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
  const litTitle = lit ? buildLitTitle(record) : undefined;

  return (
    <>
      {lit ? <span className="dot lit" title={litTitle} /> : null}
      {unidentified ? (
        <span className="gl unid" title="unidentified">
          ?
        </span>
      ) : magic ? (
        <span className="gl" title="magical">
          ✦
        </span>
      ) : null}
    </>
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
                ) : record.recordType === "coins" ? (
                  <StaticRecordRow key={record.id} record={record} allRecords={records} />
                ) : (
                  <DraggableRecordRow
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

function isUnidentified(record: InventoryRecord): boolean {
  return (
    record.recordType !== "coins" &&
    record.recordType !== "treasure" &&
    record.identification?.identified === false
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
