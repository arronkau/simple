# simple

A small TTRPG character and inventory tracker for table use.

## Current Status

Spec-first repository. Implementation should follow:

- `APP_SPEC.md`
- `MODEL_SPEC.md`
- `INVENTORY_VIEW_SPEC.md`
- `TASKS.md`

## Priorities

1. Local mode must work without Firebase.
2. Inventory model must stay simple.
3. Character-like inventory must distinguish equipped and stowed records.
4. Stowed non-coin character inventory requires one top-level stowed container, normally a backpack.
5. Character coin purse is a placement/display concept, not a real container.
6. Mounts, vehicles, and storage use simple contents inventory, not equipped/stowed.
7. No drag-and-drop in the initial implementation.
8. No unrelated refactors.
9. Firebase sync comes after local behavior is stable.

## Implementation Guardrails

- Do not add a separate item-definition layer for v1.
- Do not add legacy migration code or legacy terminology.
- Do not use holder terminology. Use `entity`.
- Do not implement drag-and-drop in the first pass.
- Do not create a separate armor location.
- Do not create a real coin-purse container.
- Do not allow character stowed non-coin records outside the character's top-level stowed container or another valid container.
