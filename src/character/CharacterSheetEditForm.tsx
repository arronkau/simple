import { type FormEvent, useEffect, useState } from "react";
import {
  ABILITY_SCORE_KEYS,
  ABILITY_SCORE_LABELS,
  normalizeCharacterData,
} from "../model/characters";
import type {
  CharacterAlignment,
  CharacterData,
  Entity,
  EntityId,
} from "../model/types";
import type { EntityMutationResult } from "../store/useAppStore";
import type {
  AbilityScoreKey,
  CharacterFeatureFormState,
  CharacterSheetFormState,
  CharacterSkillFormState,
} from "../view-types";
import { NumberField } from "../ui/NumberField";
import {
  createCharacterSheetFormState,
  createEmptyFeatureFormState,
  createEmptySkillFormState,
  toCharacterDataFormInput,
} from "./characterSheetForm";

export function CharacterSheetEditForm({
  entity,
  onSaveCharacterData,
  onDone,
}: {
  entity: Entity;
  onSaveCharacterData: (
    entityId: EntityId,
    characterData: CharacterData,
  ) => EntityMutationResult;
  onDone: () => void;
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

    onDone();
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

  return (
    <section
      className="character-sheet-panel"
      aria-label={`${entity.name} character sheet editor`}
    >
      <form className="character-sheet-form" onSubmit={handleSubmit}>
        <div className="record-form-heading">
          <h4>Edit Character Sheet</h4>
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
          <button type="button" onClick={onDone}>
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}
