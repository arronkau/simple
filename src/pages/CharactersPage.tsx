import { type FormEvent, useEffect, useState } from "react";
import { getCharacterArmorClass } from "../model/calculations";
import {
  ABILITY_SCORE_KEYS,
  ABILITY_SCORE_LABELS,
  normalizeCharacterData,
} from "../model/characters";
import {
  getCharacterEncumbrance,
  getEncumbranceWarnings,
} from "../model/encumbrance";
import { getCharacterSaveLookup } from "../model/saveTables";
import { getOwnedRecords } from "../model/inventoryDisplay";
import { isCharacterLikeEntity, validateInventoryState } from "../model/validation";
import type { AppState } from "../model/appState";
import type {
  CharacterAlignment,
  CharacterData,
  Entity,
  EntityId,
} from "../model/types";
import type { EntityMutationResult } from "../store/useAppStore";
import {
  formatMovementFeet,
  formatNullableNumberInput,
  formatNullablePartyNumber,
  formatPartyClassLevel,
  formatPartyHp,
  formatSignedNumber,
} from "../formatters";
import {
  createFormRowId,
  type AbilityScoreKey,
  type CharacterFeatureFormState,
  type CharacterSheetFormState,
  type CharacterSkillFormState,
} from "../view-types";
import { NumberField } from "../ui/NumberField";
import { EntitySummary } from "../entity/EntityStatus";
import { EntityInventoryHeader } from "../inventory/InventoryDisplay";

export function CharactersPage({
  appState,
  sortedEntities,
  onSaveCharacterData,
}: {
  appState: AppState;
  sortedEntities: Entity[];
  onSaveCharacterData: (
    entityId: EntityId,
    characterData: CharacterData,
  ) => EntityMutationResult;
}) {
  const characterEntities = sortedEntities.filter(isCharacterLikeEntity);
  const [selectedEntityId, setSelectedEntityId] = useState<EntityId | undefined>(
    () => characterEntities[0]?.id,
  );
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

  return (
    <section className="entity-workspace" aria-labelledby="characters-title">
      <div className="section-heading">
        <div>
          <h2 id="characters-title">Characters</h2>
          <p>Character and retainer sheets with compact inventory status.</p>
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
                  onClick={() => setSelectedEntityId(entity.id)}
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
              <EntitySummary appState={appState} entity={selectedEntity} />
              <CharacterInventorySummary appState={appState} entity={selectedEntity} />
              <CharacterSheetPanel
                appState={appState}
                entity={selectedEntity}
                onSaveCharacterData={onSaveCharacterData}
              />
            </article>
          ) : null}
        </div>
      )}
    </section>
  );
}

function CharacterInventorySummary({
  appState,
  entity,
}: {
  appState: AppState;
  entity: Entity;
}) {
  const ownedRecords = getOwnedRecords(entity.id, appState.inventoryRecords);
  const warnings = getEncumbranceWarnings(entity, appState.inventoryRecords);
  const validationResult = validateInventoryState(
    appState.entities,
    appState.inventoryRecords,
  );
  const validationIssues = [
    ...validationResult.errors,
    ...validationResult.warnings,
  ].filter(
    (issue) =>
      issue.entityId === entity.id ||
      (issue.recordId !== undefined &&
        ownedRecords.some((record) => record.id === issue.recordId)),
  );

  return (
    <div className="character-inventory-summary">
      <EntityInventoryHeader
        entity={entity}
        records={appState.inventoryRecords}
        warnings={warnings}
        validationIssues={validationIssues}
      />
    </div>
  );
}

function CharacterSheetPanel({
  appState,
  entity,
  onSaveCharacterData,
}: {
  appState: AppState;
  entity: Entity;
  onSaveCharacterData: (
    entityId: EntityId,
    characterData: CharacterData,
  ) => EntityMutationResult;
}) {
  const [formState, setFormState] = useState<CharacterSheetFormState>(() =>
    createCharacterSheetFormState(normalizeCharacterData(entity.character)),
  );
  const [message, setMessage] = useState<
    { tone: "error" | "success"; text: string } | undefined
  >();

  useEffect(() => {
    setFormState(
      createCharacterSheetFormState(normalizeCharacterData(entity.character)),
    );
  }, [entity.character]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const result = onSaveCharacterData(
      entity.id,
      toCharacterDataFormInput(formState),
    );

    if (!result.ok) {
      setMessage({ tone: "error", text: result.message });
      return;
    }

    setMessage({ tone: "success", text: "Character sheet saved." });
  }

  function updateAbilityScore(key: AbilityScoreKey, value: string) {
    setFormState((currentState) => ({
      ...currentState,
      abilityScores: {
        ...currentState.abilityScores,
        [key]: value,
      },
    }));
  }

  function updateSkill(
    skillId: string,
    patch: Partial<CharacterSkillFormState>,
  ) {
    setFormState((currentState) => ({
      ...currentState,
      skills: currentState.skills.map((skill) =>
        skill.id === skillId ? { ...skill, ...patch } : skill,
      ),
    }));
  }

  function updateFeature(
    featureId: string,
    patch: Partial<CharacterFeatureFormState>,
  ) {
    setFormState((currentState) => ({
      ...currentState,
      features: currentState.features.map((feature) =>
        feature.id === featureId ? { ...feature, ...patch } : feature,
      ),
    }));
  }

  const normalizedCharacter = normalizeCharacterData(entity.character);
  const armorClass = getCharacterArmorClass(
    entity,
    appState.inventoryRecords,
    normalizedCharacter,
  );
  const encumbrance = getCharacterEncumbrance(entity, appState.inventoryRecords);
  const saveLookup = getCharacterSaveLookup(
    formState.className,
    parseNullableIntegerInput(formState.level),
  );

  return (
    <section
      className="character-sheet-panel"
      aria-label={`${entity.name} character sheet`}
    >
      <form className="character-sheet-form" onSubmit={handleSubmit}>
        <div className="record-form-heading">
          <h4>Character Sheet</h4>
          {message ? (
            <p
              className={
                message.tone === "error" ? "form-error" : "form-success"
              }
            >
              {message.text}
            </p>
          ) : null}
        </div>

        <section className="character-sheet-section character-reference-section">
          <h5>Table Reference</h5>
          <div className="character-reference-grid">
            <div className="reference-stat">
              <span>HP</span>
              <strong>
                {formatPartyHp({
                  ...normalizedCharacter,
                  hp: {
                    current: parseNullableIntegerInput(formState.hpCurrent),
                    max: parseNullableIntegerInput(formState.hpMax),
                  },
                })}
              </strong>
            </div>
            <div className="reference-stat">
              <span>AC</span>
              <strong>{formatNullablePartyNumber(armorClass.armorClass)}</strong>
            </div>
            <div className="reference-stat">
              <span>Move</span>
              <strong>{formatMovementFeet(encumbrance.movement.explorationFeet)}</strong>
            </div>
            <div className="reference-stat">
              <span>XP</span>
              <strong>
                {formatNullablePartyNumber(parseNullableIntegerInput(formState.xp))}
              </strong>
            </div>
            <div className="reference-stat">
              <span>Attack</span>
              <strong>
                {saveLookup.ok ? formatSignedNumber(saveLookup.attackBonus) : "—"}
              </strong>
            </div>
          </div>

          <div className="saving-throw-panel">
            <div className="saving-throw-heading">
              <span>Saves</span>
              {!saveLookup.ok ? <p>{saveLookup.message}</p> : null}
            </div>
            <div className="saving-throw-grid">
              {saveLookup.saves.map((save) => (
                <span key={save.key}>
                  <strong>{save.label}</strong>
                  {Number.isFinite(save.value) ? save.value : "—"}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="character-sheet-section">
          <h5>Identity</h5>
          <div className="character-sheet-grid">
            <label>
              <span>Class</span>
              <input
                autoComplete="off"
                maxLength={80}
                type="text"
                value={formState.className}
                onChange={(event) =>
                  setFormState({
                    ...formState,
                    className: event.target.value,
                  })
                }
              />
            </label>
            <NumberField
              label="Level"
              value={formState.level}
              onChange={(value) =>
                setFormState({ ...formState, level: value })
              }
            />
            <label>
              <span>Alignment</span>
              <select
                value={formState.alignment}
                onChange={(event) =>
                  setFormState({
                    ...formState,
                    alignment: event.target.value as CharacterAlignment,
                  })
                }
              >
                <option value="">Unspecified</option>
                <option value="Law">Law</option>
                <option value="Neutrality">Neutrality</option>
                <option value="Chaos">Chaos</option>
              </select>
            </label>
            <NumberField
              label="XP"
              value={formState.xp}
              onChange={(value) => setFormState({ ...formState, xp: value })}
            />
          </div>
        </section>

        <section className="character-sheet-section">
          <h5>HP</h5>
          <div className="character-sheet-grid compact-grid">
            <NumberField
              label="Current HP"
              value={formState.hpCurrent}
              onChange={(value) =>
                setFormState({ ...formState, hpCurrent: value })
              }
            />
            <NumberField
              label="Max HP"
              value={formState.hpMax}
              onChange={(value) =>
                setFormState({ ...formState, hpMax: value })
              }
            />
          </div>
        </section>

        <section className="character-sheet-section">
          <h5>Armor Class</h5>
          <div className="character-sheet-grid compact-grid">
            <NumberField
              label="AC modifier"
              min="-99"
              value={formState.armorClassModifier}
              onChange={(value) =>
                setFormState({ ...formState, armorClassModifier: value })
              }
            />
            <NumberField
              label="Manual AC"
              value={formState.armorClassOverride}
              onChange={(value) =>
                setFormState({ ...formState, armorClassOverride: value })
              }
            />
          </div>
        </section>

        <section className="character-sheet-section">
          <h5>Ability Scores</h5>
          <div className="ability-score-grid">
            {ABILITY_SCORE_KEYS.map((abilityScoreKey) => (
              <NumberField
                key={abilityScoreKey}
                label={ABILITY_SCORE_LABELS[abilityScoreKey]}
                min="1"
                value={formState.abilityScores[abilityScoreKey]}
                onChange={(value) =>
                  updateAbilityScore(abilityScoreKey, value)
                }
              />
            ))}
          </div>
        </section>

        <section className="character-sheet-section">
          <div className="repeatable-heading">
            <h5>Skills</h5>
            <button
              type="button"
              onClick={() =>
                setFormState((currentState) => ({
                  ...currentState,
                  skills: [...currentState.skills, createEmptySkillFormState()],
                }))
              }
            >
              Add skill
            </button>
          </div>

          {formState.skills.length === 0 ? (
            <p className="empty-state compact">No skills</p>
          ) : (
            <div className="repeatable-list">
              {formState.skills.map((skill) => (
                <div className="repeatable-row skill-row" key={skill.id}>
                  <label>
                    <span>Name</span>
                    <input
                      autoComplete="off"
                      maxLength={80}
                      required
                      type="text"
                      value={skill.name}
                      onChange={(event) =>
                        updateSkill(skill.id, { name: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    <span>Chance</span>
                    <select
                      value={skill.chanceInSix}
                      onChange={(event) =>
                        updateSkill(skill.id, {
                          chanceInSix: event.target.value,
                        })
                      }
                    >
                      {[1, 2, 3, 4, 5, 6].map((chance) => (
                        <option key={chance} value={chance.toString()}>
                          {chance} in 6
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="wide-field">
                    <span>Description</span>
                    <input
                      autoComplete="off"
                      maxLength={160}
                      type="text"
                      value={skill.description}
                      onChange={(event) =>
                        updateSkill(skill.id, {
                          description: event.target.value,
                        })
                      }
                    />
                  </label>
                  <button
                    className="danger-button"
                    type="button"
                    onClick={() =>
                      setFormState((currentState) => ({
                        ...currentState,
                        skills: currentState.skills.filter(
                          (candidateSkill) => candidateSkill.id !== skill.id,
                        ),
                      }))
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="character-sheet-section">
          <h5>Languages</h5>
          <label>
            <span>Languages</span>
            <textarea
              rows={3}
              value={formState.languagesText}
              onChange={(event) =>
                setFormState({
                  ...formState,
                  languagesText: event.target.value,
                })
              }
            />
          </label>
        </section>

        <section className="character-sheet-section">
          <div className="repeatable-heading">
            <h5>Class Abilities / Features</h5>
            <button
              type="button"
              onClick={() =>
                setFormState((currentState) => ({
                  ...currentState,
                  features: [
                    ...currentState.features,
                    createEmptyFeatureFormState(),
                  ],
                }))
              }
            >
              Add ability
            </button>
          </div>

          {formState.features.length === 0 ? (
            <p className="empty-state compact">No class abilities</p>
          ) : (
            <div className="repeatable-list">
              {formState.features.map((feature) => (
                <div className="repeatable-row feature-row" key={feature.id}>
                  <label>
                    <span>Name</span>
                    <input
                      autoComplete="off"
                      maxLength={80}
                      type="text"
                      value={feature.name}
                      onChange={(event) =>
                        updateFeature(feature.id, {
                          name: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="wide-field">
                    <span>Description</span>
                    <textarea
                      rows={2}
                      value={feature.description}
                      onChange={(event) =>
                        updateFeature(feature.id, {
                          description: event.target.value,
                        })
                      }
                    />
                  </label>
                  <button
                    className="danger-button"
                    type="button"
                    onClick={() =>
                      setFormState((currentState) => ({
                        ...currentState,
                        features: currentState.features.filter(
                          (candidateFeature) =>
                            candidateFeature.id !== feature.id,
                        ),
                      }))
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="character-sheet-section">
          <h5>Description</h5>
          <label>
            <span>Description / notes</span>
            <textarea
              rows={4}
              value={formState.description}
              onChange={(event) =>
                setFormState({
                  ...formState,
                  description: event.target.value,
                })
              }
            />
          </label>
        </section>

        <div className="record-form-actions">
          <button type="submit">Save character sheet</button>
        </div>
      </form>
    </section>
  );
}

// ---- Character form utilities ----

export function createCharacterSheetFormState(
  characterData: CharacterData,
): CharacterSheetFormState {
  const normalizedCharacterData = normalizeCharacterData(characterData);

  return {
    className: normalizedCharacterData.className,
    level: formatNullableNumberInput(normalizedCharacterData.level),
    alignment: normalizedCharacterData.alignment,
    xp: formatNullableNumberInput(normalizedCharacterData.xp),
    hpCurrent: formatNullableNumberInput(normalizedCharacterData.hp.current),
    hpMax: formatNullableNumberInput(normalizedCharacterData.hp.max),
    armorClassModifier: normalizedCharacterData.armorClass.modifier.toString(),
    armorClassOverride: formatNullableNumberInput(
      normalizedCharacterData.armorClass.override,
    ),
    abilityScores: ABILITY_SCORE_KEYS.reduce<Record<AbilityScoreKey, string>>(
      (abilityScores, key) => ({
        ...abilityScores,
        [key]: formatNullableNumberInput(
          normalizedCharacterData.abilityScores[key],
        ),
      }),
      {
        strength: "",
        intelligence: "",
        wisdom: "",
        dexterity: "",
        constitution: "",
        charisma: "",
      },
    ),
    skills: normalizedCharacterData.skills.map((skill) => ({
      id: skill.id,
      name: skill.name,
      chanceInSix: skill.chanceInSix.toString(),
      description: skill.description ?? "",
    })),
    languagesText: normalizedCharacterData.languages.join("\n"),
    description: normalizedCharacterData.description,
    features: normalizedCharacterData.features.map((feature) => ({
      id: feature.id,
      name: feature.name,
      description: feature.description,
    })),
  };
}

export function toCharacterDataFormInput(
  formState: CharacterSheetFormState,
): CharacterData {
  return {
    className: formState.className.trim(),
    level: parseNullableIntegerInput(formState.level),
    alignment: formState.alignment,
    xp: parseNullableIntegerInput(formState.xp),
    hp: {
      current: parseNullableIntegerInput(formState.hpCurrent),
      max: parseNullableIntegerInput(formState.hpMax),
    },
    armorClass: {
      modifier: formState.armorClassModifier.trim()
        ? parseIntegerInput(formState.armorClassModifier)
        : 0,
      override: parseNullableIntegerInput(formState.armorClassOverride),
    },
    abilityScores: ABILITY_SCORE_KEYS.reduce<CharacterData["abilityScores"]>(
      (abilityScores, key) => ({
        ...abilityScores,
        [key]: parseNullableIntegerInput(formState.abilityScores[key]),
      }),
      {
        strength: null,
        intelligence: null,
        wisdom: null,
        dexterity: null,
        constitution: null,
        charisma: null,
      },
    ),
    skills: formState.skills.map((skill) => ({
      id: skill.id,
      name: skill.name.trim(),
      chanceInSix: parseIntegerInput(skill.chanceInSix),
      ...(skill.description.trim()
        ? { description: skill.description.trim() }
        : {}),
    })),
    languages: parseLanguagesInput(formState.languagesText),
    description: formState.description.trim(),
    features: formState.features
      .map((feature) => ({
        id: feature.id,
        name: feature.name.trim(),
        description: feature.description.trim(),
      }))
      .filter((feature) => feature.name || feature.description),
  };
}

function createEmptySkillFormState(): CharacterSkillFormState {
  return {
    id: createFormRowId("skill"),
    name: "",
    chanceInSix: "1",
    description: "",
  };
}

function createEmptyFeatureFormState(): CharacterFeatureFormState {
  return {
    id: createFormRowId("feature"),
    name: "",
    description: "",
  };
}

function parseLanguagesInput(value: string): string[] {
  return value
    .split(/[\n,]+/)
    .map((language) => language.trim())
    .filter((language) => language.length > 0);
}

function parseNullableIntegerInput(value: string): number | null {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  return parseIntegerInput(trimmedValue);
}

function parseIntegerInput(value: string): number {
  const parsedValue = Number(value);

  return Number.isInteger(parsedValue) ? parsedValue : Number.NaN;
}
