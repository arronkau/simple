import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  ABILITY_SCORE_KEYS,
  ABILITY_SCORE_LABELS,
  normalizeCharacterData,
} from "../model/characters";
import { getClassContentLookup } from "../model/classContent";
import {
  ENTITY_TYPE_LABELS,
  getEditableEntityTypes,
  type UpdateEntityInput,
} from "../model/entities";
import {
  getAllowedClassDisplayNames,
  isClassAllowed,
} from "../model/campaign";
import { getSpellListLookup } from "../model/spellLibrary";
import type {
  CharacterAlignment,
  CharacterData,
  Entity,
  EntityId,
  EntityType,
} from "../model/types";
import type { EntityMutationResult } from "../store/useAppStore";
import { formatPartyAlignment } from "../formatters";
import type {
  AbilityScoreKey,
  CharacterFeatureFormState,
  CharacterSheetFormState,
  CharacterSkillFormState,
  CharacterSpellFormState,
} from "../view-types";
import { NumberField } from "../ui/NumberField";
import {
  createCharacterSheetFormState,
  createEmptyFeatureFormState,
  createEmptySkillFormState,
  createEmptySpellFormState,
  toCharacterDataFormInput,
} from "./characterSheetForm";
import {
  getSheetCommitSchedule,
  getSheetSaveStatus,
  isCharacterDataDirty,
  isEntityDraftDirty,
  shouldReseedSheetDraft,
  shouldRunQueuedCommit,
  type EntityDraft,
  type SheetEditKind,
  type SheetSaveState,
} from "./characterSheetAutosave";

const SPELL_NAME_DATALIST_ID = "character-sheet-spell-names";
const CLASS_NAME_DATALIST_ID = "character-sheet-class-names";

/** Which draft a queued commit belongs to, so switching between the entity
 * fields and the sheet fields flushes the earlier one instead of dropping it. */
type CommitTarget = "sheet" | "entity";

type QueuedCommit = {
  target: CommitTarget;
  run: () => void;
};

function getSpellNameOptions(className: string): string[] {
  const classContent = getClassContentLookup(className);

  if (!classContent.ok || !classContent.spellListId) {
    return [];
  }

  const spellList = getSpellListLookup(classContent.spellListId);

  if (!spellList.ok) {
    return [];
  }

  return spellList.levels.flatMap((level) =>
    level.spells.map((spell) => spell.displayName),
  );
}

/**
 * The one edit surface for a character. There is no Save button: selects,
 * steppers and row add/remove commit as they change, typed fields commit a
 * short pause after the last keystroke (or immediately on blur), and "Done"
 * only closes the editor after flushing anything still queued. Every sheet
 * commit goes through `updateCharacterData` so validation stays in the model.
 */
export function CharacterSheetEditForm({
  entity,
  onSaveCharacterData,
  onUpdateEntity,
  onSetEntityActive,
  onDeleteEntity,
  onDone,
}: {
  entity: Entity;
  onSaveCharacterData: (
    entityId: EntityId,
    characterData: CharacterData,
  ) => EntityMutationResult;
  onUpdateEntity: (
    entityId: EntityId,
    input: UpdateEntityInput,
  ) => EntityMutationResult;
  onSetEntityActive: (entityId: EntityId, active: boolean) => void;
  onDeleteEntity: (entity: Entity) => void;
  onDone: () => void;
}) {
  const [seededEntityId, setSeededEntityId] = useState<EntityId>(entity.id);
  const [formState, setFormState] = useState<CharacterSheetFormState>(() =>
    createCharacterSheetFormState(normalizeCharacterData(entity.character)),
  );
  const [entityDraft, setEntityDraft] = useState<EntityDraft>(() => ({
    name: entity.name,
    entityType: entity.entityType,
  }));
  const [saveState, setSaveState] = useState<SheetSaveState>({ phase: "idle" });

  // The draft is seeded when the editor opens and re-seeded only if it is
  // pointed at a different entity. A remote update that lands while the editor
  // is open is deliberately not merged in, so it can never overwrite the field
  // being typed in; see `shouldReseedSheetDraft` for the trade-off that buys.
  if (shouldReseedSheetDraft(seededEntityId, entity.id)) {
    setSeededEntityId(entity.id);
    setFormState(
      createCharacterSheetFormState(normalizeCharacterData(entity.character)),
    );
    setEntityDraft({ name: entity.name, entityType: entity.entityType });
    setSaveState({ phase: "idle" });
  }

  const timerRef = useRef<number | undefined>(undefined);
  const queuedCommitRef = useRef<QueuedCommit | undefined>(undefined);
  // A queued commit can run after several renders, so it reads the entity and
  // the store actions from here rather than from its own closure.
  const latestRef = useRef({ entity, onSaveCharacterData, onUpdateEntity });

  useEffect(() => {
    latestRef.current = { entity, onSaveCharacterData, onUpdateEntity };
  });

  useEffect(
    () => () => {
      // Closing the editor (or navigating away) must not lose a keystroke that
      // is still inside its debounce window.
      if (timerRef.current !== undefined) {
        window.clearTimeout(timerRef.current);
        timerRef.current = undefined;
      }

      const queued = queuedCommitRef.current;
      queuedCommitRef.current = undefined;
      queued?.run();
    },
    [],
  );

  function reportResult(result: EntityMutationResult) {
    setSaveState(
      result.ok ? { phase: "saved" } : { phase: "error", message: result.message },
    );
  }

  /** Nothing to write: clear a pending/failed status but keep a "Saved". */
  function reportNoChange() {
    setSaveState((currentState) =>
      currentState.phase === "saved" ? currentState : { phase: "idle" },
    );
  }

  function commitSheet(
    entityId: EntityId,
    nextFormState: CharacterSheetFormState,
  ) {
    const { entity: currentEntity, onSaveCharacterData: saveCharacterData } =
      latestRef.current;

    // The editor may have been pointed at another entity since this commit was
    // queued; writing then would land one character's draft on another.
    if (!shouldRunQueuedCommit(entityId, currentEntity.id)) {
      return;
    }

    const characterData = toCharacterDataFormInput(nextFormState);

    if (!isCharacterDataDirty(characterData, currentEntity.character)) {
      reportNoChange();
      return;
    }

    // A rejected save leaves the typed draft alone: the model message is shown
    // and the next change tries again.
    reportResult(saveCharacterData(currentEntity.id, characterData));
  }

  function commitEntity(entityId: EntityId, nextDraft: EntityDraft) {
    const { entity: currentEntity, onUpdateEntity: updateEntity } =
      latestRef.current;

    if (!shouldRunQueuedCommit(entityId, currentEntity.id)) {
      return;
    }

    if (!isEntityDraftDirty(nextDraft, currentEntity)) {
      reportNoChange();
      return;
    }

    reportResult(
      updateEntity(currentEntity.id, {
        name: nextDraft.name,
        entityType: nextDraft.entityType,
      }),
    );
  }

  function clearTimer() {
    if (timerRef.current !== undefined) {
      window.clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
  }

  function scheduleCommit(
    kind: SheetEditKind,
    target: CommitTarget,
    run: () => void,
  ) {
    const queued = queuedCommitRef.current;

    clearTimer();
    queuedCommitRef.current = undefined;

    // A queued commit for the *other* draft still has to happen; a queued
    // commit for this one is superseded by the newer state it carries.
    if (queued && queued.target !== target) {
      queued.run();
    }

    const schedule = getSheetCommitSchedule(kind);

    if (schedule.mode === "immediate") {
      run();
      return;
    }

    queuedCommitRef.current = { target, run };
    setSaveState({ phase: "saving" });
    timerRef.current = window.setTimeout(() => {
      timerRef.current = undefined;

      const pending = queuedCommitRef.current;
      queuedCommitRef.current = undefined;
      pending?.run();
    }, schedule.delayMs);
  }

  function flushQueuedCommit() {
    clearTimer();

    const queued = queuedCommitRef.current;
    queuedCommitRef.current = undefined;
    queued?.run();
  }

  function applySheetChange(
    kind: SheetEditKind,
    nextFormState: CharacterSheetFormState,
  ) {
    setFormState(nextFormState);
    scheduleCommit(kind, "sheet", () => commitSheet(entity.id, nextFormState));
  }

  function applyEntityChange(kind: SheetEditKind, nextDraft: EntityDraft) {
    setEntityDraft(nextDraft);
    scheduleCommit(kind, "entity", () => commitEntity(entity.id, nextDraft));
  }

  function updateAbilityScore(key: AbilityScoreKey, value: string) {
    applySheetChange("number", {
      ...formState,
      abilityScores: {
        ...formState.abilityScores,
        [key]: value,
      },
    });
  }

  function updateSkill(
    skillId: string,
    patch: Partial<CharacterSkillFormState>,
    kind: SheetEditKind,
  ) {
    applySheetChange(kind, {
      ...formState,
      skills: formState.skills.map((skill) =>
        skill.id === skillId ? { ...skill, ...patch } : skill,
      ),
    });
  }

  function updateFeature(
    featureId: string,
    patch: Partial<CharacterFeatureFormState>,
    kind: SheetEditKind,
  ) {
    applySheetChange(kind, {
      ...formState,
      features: formState.features.map((feature) =>
        feature.id === featureId ? { ...feature, ...patch } : feature,
      ),
    });
  }

  function updateSpell(
    spellId: string,
    patch: Partial<CharacterSpellFormState>,
    kind: SheetEditKind,
  ) {
    applySheetChange(kind, {
      ...formState,
      spells: formState.spells.map((spell) =>
        spell.id === spellId ? { ...spell, ...patch } : spell,
      ),
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    flushQueuedCommit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    // Enter used to submit the sheet; it now commits whatever is queued so the
    // old keyboard habit still means "save this now". Buttons, selects and
    // textareas keep their own Enter behavior.
    if (event.key !== "Enter" || !(event.target instanceof HTMLInputElement)) {
      return;
    }

    event.preventDefault();
    flushQueuedCommit();
  }

  function handleDone() {
    flushQueuedCommit();
    onDone();
  }

  const spellNameOptions = getSpellNameOptions(formState.className);
  const classNameOptions = getAllowedClassDisplayNames();
  const showClassWarning =
    formState.className.trim().length > 0 &&
    !isClassAllowed(formState.className);
  const editableEntityTypes = getEditableEntityTypes(entity);
  const canEditEntityType = editableEntityTypes.length > 1;
  const saveStatus = getSheetSaveStatus(saveState);

  return (
    <section
      className="character-sheet-panel"
      aria-label={`${entity.name} character sheet editor`}
    >
      <form
        className="character-sheet-form"
        noValidate
        onBlur={flushQueuedCommit}
        onKeyDown={handleKeyDown}
        onSubmit={handleSubmit}
      >
        <div className="record-form-heading">
          <h4>Edit Character Sheet</h4>
          <p
            aria-live="polite"
            className={
              saveStatus?.tone === "error"
                ? "form-error"
                : saveStatus?.tone === "success"
                  ? "form-success"
                  : "form-help"
            }
            role="status"
          >
            {saveStatus ? saveStatus.text : ""}
          </p>
        </div>

        <section className="character-sheet-section">
          <h5>Entity</h5>
          <div className="character-sheet-grid compact-grid">
            <label>
              <span>Name</span>
              <input
                autoComplete="off"
                maxLength={80}
                type="text"
                value={entityDraft.name}
                onChange={(event) =>
                  applyEntityChange("text", {
                    ...entityDraft,
                    name: event.target.value,
                  })
                }
              />
            </label>
            <label>
              <span>Type</span>
              <select
                disabled={!canEditEntityType}
                value={entityDraft.entityType}
                onChange={(event) =>
                  applyEntityChange("choice", {
                    ...entityDraft,
                    entityType: event.target.value as EntityType,
                  })
                }
              >
                {editableEntityTypes.map((entityType) => (
                  <option key={entityType} value={entityType}>
                    {ENTITY_TYPE_LABELS[entityType]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="record-form-action-group left-actions">
            <button
              className="compact-row-action"
              type="button"
              onClick={() => onSetEntityActive(entity.id, !entity.active)}
            >
              {entity.active ? "Bench" : "Reactivate"}
            </button>
            <button
              className="danger-button compact-row-action"
              type="button"
              onClick={() => onDeleteEntity(entity)}
            >
              Delete
            </button>
          </div>
        </section>

        <section className="character-sheet-section">
          <h5>Identity</h5>
          <div className="character-sheet-grid">
            <label>
              <span>Class</span>
              <input
                autoComplete="off"
                list={CLASS_NAME_DATALIST_ID}
                maxLength={80}
                type="text"
                value={formState.className}
                onChange={(event) =>
                  applySheetChange("text", {
                    ...formState,
                    className: event.target.value,
                  })
                }
              />
              <datalist id={CLASS_NAME_DATALIST_ID}>
                {classNameOptions.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
              {showClassWarning ? (
                <small className="form-warning">Not a campaign class</small>
              ) : null}
            </label>
            <NumberField
              label="Level"
              value={formState.level}
              onChange={(value) =>
                applySheetChange("number", { ...formState, level: value })
              }
            />
            <label>
              <span>Alignment</span>
              <select
                value={formState.alignment}
                onChange={(event) =>
                  applySheetChange("choice", {
                    ...formState,
                    alignment: event.target.value as CharacterAlignment,
                  })
                }
              >
                <option value="">Unspecified</option>
                {(["Law", "Neutrality", "Chaos"] as CharacterAlignment[]).map(
                  (alignment) => (
                    <option key={alignment} value={alignment}>
                      {formatPartyAlignment(alignment)}
                    </option>
                  ),
                )}
              </select>
            </label>
            <NumberField
              label="XP"
              value={formState.xp}
              onChange={(value) =>
                applySheetChange("number", { ...formState, xp: value })
              }
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
                applySheetChange("number", { ...formState, hpCurrent: value })
              }
            />
            <NumberField
              label="Max HP"
              value={formState.hpMax}
              onChange={(value) =>
                applySheetChange("number", { ...formState, hpMax: value })
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
                applySheetChange("number", {
                  ...formState,
                  armorClassModifier: value,
                })
              }
            />
            <NumberField
              label="Manual AC"
              value={formState.armorClassOverride}
              onChange={(value) =>
                applySheetChange("number", {
                  ...formState,
                  armorClassOverride: value,
                })
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
            <h5>Spells</h5>
            <button
              type="button"
              onClick={() =>
                applySheetChange("structure", {
                  ...formState,
                  spells: [...formState.spells, createEmptySpellFormState()],
                })
              }
            >
              Add spell
            </button>
          </div>

          {spellNameOptions.length > 0 ? (
            <datalist id={SPELL_NAME_DATALIST_ID}>
              {spellNameOptions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          ) : null}

          {formState.spells.length === 0 ? (
            <p className="empty-state compact">No spells</p>
          ) : (
            <div className="repeatable-list">
              {formState.spells.map((spell) => (
                <div className="repeatable-row spell-row" key={spell.id}>
                  <label>
                    <span>Name</span>
                    <input
                      autoComplete="off"
                      list={
                        spellNameOptions.length > 0
                          ? SPELL_NAME_DATALIST_ID
                          : undefined
                      }
                      maxLength={80}
                      type="text"
                      value={spell.name}
                      onChange={(event) =>
                        updateSpell(
                          spell.id,
                          { name: event.target.value },
                          "text",
                        )
                      }
                    />
                  </label>
                  <label>
                    <span>Level</span>
                    <select
                      value={spell.level}
                      onChange={(event) =>
                        updateSpell(
                          spell.id,
                          { level: event.target.value },
                          "choice",
                        )
                      }
                    >
                      {[1, 2, 3, 4, 5, 6, 7].map((spellLevel) => (
                        <option key={spellLevel} value={spellLevel.toString()}>
                          Level {spellLevel}
                        </option>
                      ))}
                    </select>
                  </label>
                  <NumberField
                    label="Memorized"
                    value={spell.memorized}
                    onChange={(value) =>
                      updateSpell(spell.id, { memorized: value }, "number")
                    }
                  />
                  <label className="wide-field">
                    <span>Notes</span>
                    <input
                      autoComplete="off"
                      maxLength={160}
                      type="text"
                      value={spell.notes}
                      onChange={(event) =>
                        updateSpell(
                          spell.id,
                          { notes: event.target.value },
                          "text",
                        )
                      }
                    />
                  </label>
                  <button
                    className="danger-button"
                    type="button"
                    onClick={() =>
                      applySheetChange("structure", {
                        ...formState,
                        spells: formState.spells.filter(
                          (candidateSpell) => candidateSpell.id !== spell.id,
                        ),
                      })
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
          <div className="repeatable-heading">
            <h5>Skills</h5>
            <button
              type="button"
              onClick={() =>
                applySheetChange("structure", {
                  ...formState,
                  skills: [...formState.skills, createEmptySkillFormState()],
                })
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
                      type="text"
                      value={skill.name}
                      onChange={(event) =>
                        updateSkill(
                          skill.id,
                          { name: event.target.value },
                          "text",
                        )
                      }
                    />
                  </label>
                  <label>
                    <span>Chance</span>
                    <select
                      value={skill.chanceInSix}
                      onChange={(event) =>
                        updateSkill(
                          skill.id,
                          { chanceInSix: event.target.value },
                          "choice",
                        )
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
                        updateSkill(
                          skill.id,
                          { description: event.target.value },
                          "text",
                        )
                      }
                    />
                  </label>
                  <button
                    className="danger-button"
                    type="button"
                    onClick={() =>
                      applySheetChange("structure", {
                        ...formState,
                        skills: formState.skills.filter(
                          (candidateSkill) => candidateSkill.id !== skill.id,
                        ),
                      })
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
                applySheetChange("text", {
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
                applySheetChange("structure", {
                  ...formState,
                  features: [
                    ...formState.features,
                    createEmptyFeatureFormState(),
                  ],
                })
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
                        updateFeature(
                          feature.id,
                          { name: event.target.value },
                          "text",
                        )
                      }
                    />
                  </label>
                  <label className="wide-field">
                    <span>Description</span>
                    <textarea
                      rows={2}
                      value={feature.description}
                      onChange={(event) =>
                        updateFeature(
                          feature.id,
                          { description: event.target.value },
                          "text",
                        )
                      }
                    />
                  </label>
                  <button
                    className="danger-button"
                    type="button"
                    onClick={() =>
                      applySheetChange("structure", {
                        ...formState,
                        features: formState.features.filter(
                          (candidateFeature) =>
                            candidateFeature.id !== feature.id,
                        ),
                      })
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
                applySheetChange("text", {
                  ...formState,
                  description: event.target.value,
                })
              }
            />
          </label>
        </section>

        <div className="record-form-actions">
          <button type="button" onClick={handleDone}>
            Done
          </button>
        </div>
      </form>
    </section>
  );
}
