import { useEffect, useState } from "react";
import { normalizeCharacterData } from "../model/characters";
import { isCharacterLikeEntity } from "../model/validation";
import type { AppState } from "../model/appState";
import type { CharacterData, Entity, EntityId } from "../model/types";
import type { EntityMutationResult } from "../store/useAppStore";
import { formatPartyClassLevel } from "../formatters";
import { EntitySummary } from "../entity/EntityStatus";
import { CharacterSheet } from "../character/CharacterSheet";
import { CharacterSheetEditForm } from "../character/CharacterSheetEditForm";

export function CharactersPage({
  appState,
  sortedEntities,
  onEditEntity,
  onSaveCharacterData,
  onAdjustHp,
  onAdjustXp,
  onAdjustSpellMemorized,
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
}) {
  const characterEntities = sortedEntities.filter(isCharacterLikeEntity);
  const [selectedEntityId, setSelectedEntityId] = useState<EntityId | undefined>(
    () => characterEntities[0]?.id,
  );
  const [sheetMode, setSheetMode] = useState<"read" | "edit">("read");
  const selectedEntity =
    characterEntities.find((entity) => entity.id === selectedEntityId) ??
    characterEntities[0];

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
          <aside className="character-selector" aria-label="Characters">
            {characterEntities.map((entity) => {
              const character = normalizeCharacterData(entity.character);

              return (
                <button
                  data-active={entity.id === selectedEntity?.id}
                  key={entity.id}
                  type="button"
                  onClick={() => selectEntity(entity.id)}
                >
                  <span>{entity.name}</span>
                  <small>{formatPartyClassLevel(character)}</small>
                </button>
              );
            })}
          </aside>

          {selectedEntity ? (
            <article
              className="character-detail"
              data-inactive={!selectedEntity.active}
            >
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
