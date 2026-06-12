import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { DraggableAttributes } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { normalizeCharacterData } from "../model/characters";
import { isCharacterLikeEntity } from "../model/validation";
import type { AppState } from "../model/appState";
import type {
  CharacterData,
  Entity,
  EntityId,
  InventoryRecord,
} from "../model/types";
import type { EntityMutationResult } from "../store/useAppStore";
import { formatPartyClassLevel } from "../formatters";
import { EntitySummary } from "../entity/EntityStatus";
import { CharacterSheet } from "../character/CharacterSheet";
import { CharacterSheetEditForm } from "../character/CharacterSheetEditForm";

const SELECTOR_BENCH_DROP_ID = "selector-bench-zone";

export function CharactersPage({
  appState,
  sortedEntities,
  onEditEntity,
  onSaveCharacterData,
  onAdjustHp,
  onAdjustXp,
  onAdjustSpellMemorized,
  onStartAddRecord,
  onEditRecord,
  onSetEntityActive,
  onReorderEntity,
}: {
  appState: AppState;
  sortedEntities: Entity[];
  onEditEntity: (entity: Entity) => void;
  onSaveCharacterData: (
    entityId: EntityId,
    characterData: CharacterData,
  ) => EntityMutationResult;
  onAdjustHp: (entityId: EntityId, delta: number) => EntityMutationResult;
  onAdjustXp: (entityId: EntityId, delta: number) => EntityMutationResult;
  onAdjustSpellMemorized: (
    entityId: EntityId,
    spellId: string,
    delta: number,
  ) => EntityMutationResult;
  onStartAddRecord: (entity: Entity) => void;
  onEditRecord: (record: InventoryRecord) => void;
  onSetEntityActive: (entityId: EntityId, active: boolean) => void;
  onReorderEntity: (entityId: EntityId, targetIndex: number) => void;
}) {
  const characterEntities = sortedEntities.filter(isCharacterLikeEntity);
  const activeCharacters = characterEntities.filter((entity) => entity.active);
  const benchedCharacters = characterEntities.filter(
    (entity) => !entity.active,
  );
  // ?c=<entityId> drives selection so the party table can link to a sheet.
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedEntityId, setSelectedEntityId] = useState<EntityId | undefined>(
    () => searchParams.get("c") ?? characterEntities[0]?.id,
  );
  const [sheetMode, setSheetMode] = useState<"read" | "edit">("read");
  const requestedEntityId = searchParams.get("c");
  const selectedEntity =
    characterEntities.find((entity) => entity.id === selectedEntityId) ??
    characterEntities[0];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor),
  );

  useEffect(() => {
    if (
      requestedEntityId &&
      requestedEntityId !== selectedEntityId &&
      characterEntities.some((entity) => entity.id === requestedEntityId)
    ) {
      setSelectedEntityId(requestedEntityId);
      setSheetMode("read");
    }
  }, [requestedEntityId, selectedEntityId, characterEntities]);

  useEffect(() => {
    if (
      characterEntities.length > 0 &&
      !characterEntities.some((entity) => entity.id === selectedEntityId)
    ) {
      setSelectedEntityId(characterEntities[0]?.id);
    }
  }, [characterEntities, selectedEntityId]);

  function selectEntity(entityId: EntityId) {
    setSelectedEntityId(entityId);
    setSheetMode("read");
    setSearchParams({ c: entityId }, { replace: true });
  }

  // Same drag interaction as the party table: drop on a row to take its
  // place (activating first when dragged off the bench), drop on the bench
  // group to deactivate.
  function handleDragEnd(event: DragEndEvent) {
    const draggedId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;

    if (!overId || overId === draggedId) {
      return;
    }

    const draggedEntity = characterEntities.find(
      (entity) => entity.id === draggedId,
    );

    if (!draggedEntity) {
      return;
    }

    if (overId === SELECTOR_BENCH_DROP_ID) {
      if (draggedEntity.active) {
        onSetEntityActive(draggedId, false);
      }
      return;
    }

    const overEntity = characterEntities.find((entity) => entity.id === overId);

    if (!overEntity?.active) {
      return;
    }

    if (!draggedEntity.active) {
      onSetEntityActive(draggedId, true);
    }

    const targetIndex = sortedEntities.findIndex(
      (entity) => entity.id === overId,
    );

    if (targetIndex !== -1) {
      onReorderEntity(draggedId, targetIndex);
    }
  }

  return (
    <section className="entity-workspace" aria-labelledby="characters-title">
      <div className="section-heading">
        <div>
          <h2 id="characters-title">Characters</h2>
          <p>Character and retainer sheets for table use.</p>
        </div>
      </div>

      {characterEntities.length === 0 ? (
        <p className="empty-state">No characters or retainers yet.</p>
      ) : (
        <div className="character-page-layout">
          <DndContext
            collisionDetection={closestCenter}
            sensors={sensors}
            onDragEnd={handleDragEnd}
          >
            <aside className="character-selector" aria-label="Characters">
              <SortableContext
                items={activeCharacters.map((entity) => entity.id)}
                strategy={verticalListSortingStrategy}
              >
                {activeCharacters.map((entity) => (
                  <SortableSelectorItem
                    entity={entity}
                    key={entity.id}
                    selected={entity.id === selectedEntity?.id}
                    onSelect={selectEntity}
                  />
                ))}
              </SortableContext>

              <SelectorBenchedGroup
                benchedCharacters={benchedCharacters}
                selectedEntityId={selectedEntity?.id}
                onSelect={selectEntity}
              />
            </aside>
          </DndContext>

          {selectedEntity ? (
            <article className="character-detail">
              <div className="character-entity-settings">
                <EntitySummary appState={appState} entity={selectedEntity} />
                <button type="button" onClick={() => onEditEntity(selectedEntity)}>
                  Edit entity
                </button>
              </div>
              {sheetMode === "read" ? (
                <CharacterSheet
                  appState={appState}
                  entity={selectedEntity}
                  onAdjustHp={onAdjustHp}
                  onAdjustXp={onAdjustXp}
                  onAdjustSpellMemorized={onAdjustSpellMemorized}
                  onEdit={() => setSheetMode("edit")}
                  onStartAddRecord={onStartAddRecord}
                  onEditRecord={onEditRecord}
                />
              ) : (
                <CharacterSheetEditForm
                  entity={selectedEntity}
                  onDone={() => setSheetMode("read")}
                  onSaveCharacterData={onSaveCharacterData}
                />
              )}
            </article>
          ) : null}
        </div>
      )}
    </section>
  );
}

function SelectorBenchedGroup({
  benchedCharacters,
  selectedEntityId,
  onSelect,
}: {
  benchedCharacters: Entity[];
  selectedEntityId: EntityId | undefined;
  onSelect: (entityId: EntityId) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: SELECTOR_BENCH_DROP_ID });

  return (
    <div
      ref={setNodeRef}
      className={`selector-benched${isOver ? " drop-over" : ""}`}
    >
      <h3 className="micro">Benched</h3>
      {benchedCharacters.length === 0 ? (
        <p className="empty-state compact">Drag here to bench</p>
      ) : (
        benchedCharacters.map((entity) => (
          <DraggableSelectorItem
            entity={entity}
            key={entity.id}
            selected={entity.id === selectedEntityId}
            onSelect={onSelect}
          />
        ))
      )}
    </div>
  );
}

function SortableSelectorItem({
  entity,
  selected,
  onSelect,
}: {
  entity: Entity;
  selected: boolean;
  onSelect: (entityId: EntityId) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entity.id });

  return (
    <SelectorItem
      dragRef={setNodeRef}
      dragging={isDragging}
      entity={entity}
      gripAttributes={attributes}
      gripListeners={listeners}
      selected={selected}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      onSelect={onSelect}
    />
  );
}

function DraggableSelectorItem({
  entity,
  selected,
  onSelect,
}: {
  entity: Entity;
  selected: boolean;
  onSelect: (entityId: EntityId) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: entity.id });

  return (
    <SelectorItem
      dragRef={setNodeRef}
      dragging={isDragging}
      entity={entity}
      gripAttributes={attributes}
      gripListeners={listeners}
      selected={selected}
      style={{ transform: CSS.Translate.toString(transform) }}
      onSelect={onSelect}
    />
  );
}

function SelectorItem({
  entity,
  selected,
  dragging,
  dragRef,
  gripAttributes,
  gripListeners,
  style,
  onSelect,
}: {
  entity: Entity;
  selected: boolean;
  dragging: boolean;
  dragRef: (node: HTMLElement | null) => void;
  gripAttributes: DraggableAttributes;
  gripListeners: Record<string, unknown> | undefined;
  style: React.CSSProperties;
  onSelect: (entityId: EntityId) => void;
}) {
  const character = normalizeCharacterData(entity.character);

  return (
    <div
      ref={dragRef}
      className={`character-selector-item${dragging ? " pt-dragging" : ""}`}
      data-active={selected}
      style={style}
    >
      <button
        aria-label={`Reorder or bench ${entity.name}`}
        className="pt-grip"
        type="button"
        {...gripAttributes}
        {...gripListeners}
      >
        ⠿
      </button>
      <button
        className="character-select-button"
        type="button"
        onClick={() => onSelect(entity.id)}
      >
        <span>{entity.name}</span>
        <small>{formatPartyClassLevel(character)}</small>
      </button>
    </div>
  );
}
