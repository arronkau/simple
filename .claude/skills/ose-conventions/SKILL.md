---
name: ose-conventions
description: This project's OSR/OSE house rules and rule-data provenance for saves, AC, class tables, coins, and the item catalog in the `simple` tracker. Use when touching class/level data, saving throws, armor class, or item-catalog code, or when a change depends on getting an OSE number, label, or convention right. (Encumbrance/movement is covered by the encumbrance-rules skill.)
---

# OSE conventions

`simple` targets Old-School Essentials (OSE) Advanced Fantasy, but it **deliberately does not automate the ruleset** (`APP_SPEC.md`: "No full automation of all OSE rules. Avoid a generic rules engine"). This skill is a **reference for the project's conventions and deviations**, not a rules engine and not a place to paste rulebook text. The numeric tables already in the repo are audited derivations with explicit sourcing — extend those data files; don't hardcode new rule numbers in logic.

**Scope split:** encumbrance, slot burden, movement rates, containers, and coin *burden* are owned by the **`encumbrance-rules`** skill — go there for those. This skill covers **saves, AC, class/level tables, coin denominations/value, and the item catalog**.

When a rule genuinely governs behavior, authority order is: `MODEL_SPEC.md` → `ENCUMBRANCE_SPEC.md` → the JSON data files → existing `model/` functions. Update the spec before adding model fields.

## Where the rule data lives

- [src/model/ose_class_reference.json](../../../src/model/ose_class_reference.json) — per-class, per-level data. Read via [src/model/saveTables.ts](../../../src/model/saveTables.ts) (`getCharacterSaveLookup`).
- [src/model/standardItemCatalog.json](../../../src/model/standardItemCatalog.json) — item-autofill templates (catalog data, **not** full `InventoryRecord` instances).
- [src/model/calculations.ts](../../../src/model/calculations.ts) — AC and coin value/burden helpers.

## Saving throws — relabeled

Save **labels are remapped** to Dolmenwood names over OSE categories. Always use the Dolmenwood labels in UI and code; the underlying OSE D/W/P/B/S values are unchanged:

| Label | OSE key | OSE category |
|-------|---------|--------------|
| Doom  | D | Death / poison |
| Ray   | W | Wands |
| Hold  | P | Paralysis / petrify |
| Blast | B | Breath attacks |
| Spell | S | Spells / rods / staves |

Saves come from class/level lookup, not ability scores. `getCharacterSaveLookup` normalizes the class name (lowercase, strip non-alphanumerics) and matches `id` or `displayName`; unknown class or level returns `ok: false`.

## Class reference scope

Curated subset: **OSE Advanced Fantasy classes + the Carcass Crawler #1 goblin**. Each level record carries only `xpThreshold`, `attackBonus`, `saves`, `spellSlots`, `maxSpellLevel` — this is intentional (`excludedByDesign`). Do not invent additional per-level fields; if a feature needs more, update `MODEL_SPEC.md` and re-source the JSON first.

## Armor Class

**Ascending AC**, base **10** (`DEFAULT_ASCENDING_ARMOR_CLASS`). AC is derived in `getCharacterArmorClass` from the single best equipped armor plus a shield held in hand; multiple equipped armors warn and the best is used. A manual override, when present, wins over the calculated value.

## Items & coins

- **House-rules weapons/armor only.** Do **not** import OSE weapon or armor rows into the catalog. "Torch is not a weapon entry." (`standardItemCatalog.json` normalization rules.)
- Catalog entries are templates: at creation the app adds `id`, `entityId`, `location`, `sortOrder`, timestamps, and UI defaults.
- `gpValue` is **catalog metadata**. The model only defines `gpValue` on `treasure` records — do not persist it onto other record types unless the model is extended.
- Coins are PP/GP/SP/CP; value is derived (`getCoinGpValue`), never stored. Coin slot *burden* rules live in the `encumbrance-rules` skill.

## Philosophy

Hard-block structurally impossible state; use **warnings** (not enforcement) for table-adjudicated rule problems where strict checking would slow play. Keep rules data in the JSON/spec layer so the table data stays auditable and copyright-clean.
