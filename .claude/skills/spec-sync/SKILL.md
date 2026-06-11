---
name: spec-sync
description: Keep the spec docs (MODEL_SPEC, ENCUMBRANCE_SPEC, APP_SPEC, TASKS) in sync with code in the `simple` repo. Use when editing anything in src/model, the store, persistence, or the data model, when adding a model field, or when finishing a scoped task — to update the governing spec in the same change.
---

# Spec sync

`simple` is **spec-driven**: the spec docs are the source of truth, and code is expected to follow them. When behavior changes, the spec changes **in the same commit** — not "later." A drifted spec is worse than no spec because future work trusts it.

Hard rule from `APP_SPEC.md`: *do not infer new model fields from UI needs unless `MODEL_SPEC.md` is updated first.* Spec leads, code follows.

This is the general, cross-cutting policy plus an automated reminder. The domain skills (`encumbrance-rules`, `firestore-permissions`) carry the same "update spec + fixtures in the same change" rule for their areas — defer to them for specifics.

## Which spec governs which code

| You changed… | Update… |
|--------------|---------|
| `src/model/types.ts`, `appState.ts`, `entities.ts`, `inventoryRecords.ts`, `characters.ts`, `validation.ts` — data model, interfaces, invariants, validation rules | `MODEL_SPEC.md` |
| `src/model/encumbrance.ts`, or slot / burden / movement logic in `calculations.ts` | `ENCUMBRANCE_SPEC.md` (see the `encumbrance-rules` skill) |
| `src/model/permissions.ts`, `firestore.rules`, store permission checks, party `gmUid`/`members`, secret inventory fields | `APP_SPEC.md` (see the `firestore-permissions` skill) |
| `src/persistence/**`, `src/store/**`, persistence behavior, local/Firebase parity, terminology, high-level app behavior | `APP_SPEC.md` |
| Class tables, saves, AC, item-catalog conventions | see the `ose-conventions` skill (data lives in JSON; specs describe intent) |
| Completed or re-scoped a phase from the 1.0 plan / post-1.0 backlog | `TASKS.md` |

`MODEL_SPEC.md` is canonical for the data model; never duplicate model rules into other specs (`APP_SPEC.md` says so explicitly).

## Checklist before finishing model/spec work

1. **New or changed field/type/invariant?** → reflect it in `MODEL_SPEC.md` (and `ENCUMBRANCE_SPEC.md` if it's slot/burden/movement). Update field lists, interfaces, and any invariant prose.
2. **Derived vs stored?** → the specs require derived values stay derived unless there's a clear performance reason. If you stored a derived value, justify it in the spec.
3. **Fixtures** → behavior changes need fixture coverage in the same change (this repo's test convention — see the `encumbrance-rules` skill). Run `npm test && npm run typecheck`.
4. **Terminology** → stay on canonical terms: `entity`, `equipped`, `stowed`, "top-level stowed container". Don't reintroduce retired terms (e.g. backpack-specific wording).
5. **Validation philosophy** → hard-block impossible state, warn on table-adjudicated problems, never silently fix user data. Describe new rules in `MODEL_SPEC.md`.
6. **Scope** → if the change completes or defers a `TASKS.md` item, update that checklist. Don't pull post-1.0 items in without re-scoping there first.
7. **Examples in specs** → if a spec shows a TS interface or worked example that your change contradicts, fix it too.

## When code and spec disagree

Treat the spec as intent and the disagreement as a bug to surface, not silently "fix" by editing whichever is easier. If the code is right and the spec is stale, update the spec. If the spec is right and the code drifted, flag it. If genuinely unsure which is intended, ask rather than guessing.

> A `Stop` hook prints a reminder when `src/model/**` changed in the working tree without a matching spec edit. That's a prompt to run this checklist, not proof anything is wrong — a pure refactor with no behavior change is a legitimate reason to skip a spec edit.
