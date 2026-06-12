# Content Guide

How to author the bundled rule-content libraries in `src/model/`. These files ship with the app, are read by pure lookup functions, and are **never part of `PartyState`** — authoring content requires no migration and syncs nothing.

The app never blocks on missing content: an unauthored class hides its content sections, an unauthored level row renders em-dashes, an unmatched spell name renders without a detail view. Author incrementally — start with the classes your table actually plays.

## Shared conventions

- **Ids are camelCase** and stable (`magicUser`, `halfElf`, `turnUndead`). Class ids and display names must match `ose_class_reference.json` so one class name resolves both files.
- **Name matching is fuzzy**: lookups lowercase the input and strip all non-alphanumerics, then match either `id` or `displayName`. "Magic-User", "magic user", and "magicUser" all resolve the same entry.
- **Provenance is required** before a file is treated as audited, matching `ose_class_reference.json`:
  - `schemaVersion` — bump from `0.1.0-skeleton` to an `-audited` version once content is sourced.
  - `sourceBasis` — cite the book and **printed page numbers** for every table/list you author.
- **Sample entries** (`sampleList`, `sampleClass`) exist only as format references and can be deleted once real content exists. The fixture suite does not depend on them — model fixtures inject their own test libraries.
- After editing a JSON file, run `npm run typecheck && npm run test`. A malformed shape fails the typecheck or the fixture suite.

## `ose_spell_library.json` — spell lists

Spells are organized by **list, then spell level** (the way OSE prints them; divine casters browse the whole list). Read via `src/model/spellLibrary.ts` (`getSpellLookup`, `getSpellListLookup`).

```json
{
  "spellLists": {
    "magicUser": {
      "id": "magicUser",
      "displayName": "Magic-User",
      "levels": {
        "1": [
          {
            "id": "lightSpell",
            "displayName": "Light",
            "reversible": true,
            "duration": "12 turns",
            "range": "120'",
            "description": "Authored rules text for the spell."
          }
        ]
      }
    }
  }
}
```

- `levels` keys are spell levels as strings (`"1"`–`"7"`); each value is an array of spells.
- `reversible`, `duration`, and `range` are optional; `description` is required.
- A character links to a list through `spellListId` in `ose_class_content.json` (below). List ids don't have to be class ids (e.g. a shared `cleric` list can serve paladins too).
- If the same spell appears in two lists at different levels, lookups prefer the character's class list.

## `ose_class_content.json` — per-class content

Per-**class** (not per-level) content: prime requisites, class abilities, and level-indexed tables. Per-level records in `ose_class_reference.json` stay limited to xp/attack/saves/slots by design — anything else goes here. Read via `src/model/classContent.ts` (`getClassContentLookup`, `getClassLevelTables`).

```json
{
  "classes": {
    "thief": {
      "id": "thief",
      "displayName": "Thief",
      "primeRequisites": ["dexterity"],
      "abilities": [
        {
          "id": "backStab",
          "name": "Back-stab",
          "description": "Authored rules text."
        }
      ],
      "levelTables": [
        {
          "id": "thiefSkills",
          "name": "Thief Skills",
          "columns": ["CS", "HN", "HS", "MS", "OL", "PP", "RT"],
          "rowsByLevel": {
            "1": [87, "1-2", 10, 20, 15, 20, 10]
          }
        }
      ]
    }
  }
}
```

(The numbers in the example rows show the **format**, not sourced values — fill in audited values from the book.)

- `primeRequisites` values are the model's ability keys: `strength`, `intelligence`, `wisdom`, `dexterity`, `constitution`, `charisma`.
- `spellListId` (optional) names the class's list in the spell library.
- `levelTables` is one generic format for any level-indexed table: thief/acrobat skills, **turn undead**, etc. `columns` are header labels; `rowsByLevel` maps character level (string key) to a row of cells in column order. Cells may be numbers or strings — for turn undead use the book's notation as strings: `"7"`, `"9"`, `"11"`, `"T"`, `"D"`, `"-"`. Tables are display-only; the app never interprets cell values.
- Levels you haven't authored render as em-dashes; you can fill `rowsByLevel` for only the levels in play.

## `ose_ability_modifiers.json` — ability score modifiers

The shared −3…+3 modifier table shown beside each ability score. Read via `src/model/abilityModifiers.ts` (`getAbilityModifier`).

```json
{
  "modifierBands": [
    { "minScore": 3, "maxScore": 3, "modifier": -3 },
    { "minScore": 9, "maxScore": 12, "modifier": 0 },
    { "minScore": 18, "maxScore": 18, "modifier": 3 }
  ]
}
```

- Bands are inclusive on both ends; scores outside every band show no modifier.
- One table serves all six scores. Per-ability extras (CHA retainer count/morale, INT languages) are deliberately not modeled yet — when wanted, they can be added to this file as an ability-keyed section without changing the band format.
