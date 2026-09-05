# simple

A small TTRPG character, party, and inventory tracker built for table use.

`simple` is designed for old-school roleplaying games where encumbrance, light, equipment, retainers, mounts, and shared party resources matter during play. The app favors fast table workflows, clear inventory state, and practical warnings over heavy rules automation.

## Features

- Party overview for characters, retainers, mounts, vehicles, and storage.
- Inventory tracking for weapons, armor, equipment, treasure, coins, and containers.
- Slot-based encumbrance with separate equipped and stowed burden.
- Movement warnings for overloaded characters and containers.
- Character-like inventory sections for hands, equipped gear, backpack, and stowed containers.
- Simpler contents inventory for mounts, vehicles, and storage.
- A "Party Gear" board (Ready / Stowed) with drag-and-drop repacking and a "Floor" loot-staging bar. Drag-and-drop is an intended feature that reuses the same validated move and encumbrance logic as the non-drag workflows.
- Add and edit modals for entities and inventory records.
- Audit log for significant party and inventory changes.
- Party management in Manage: create a party, switch to a recent one, forget one on this device, or delete the open party as the GM.
- Local-only mode with `localStorage`.
- Optional Firebase anonymous auth and Firestore sync when configured, tolerant of a dropped connection: edits are cached offline, failed writes retry on a backoff, and a refused write is rolled back.

## Tech Stack

- React
- TypeScript
- Vite
- React Router
- Zustand
- Plain CSS
- Firebase / Firestore, optional

## Getting Started

### Prerequisites

Install Node.js and npm.

### Install

```bash
npm install
```

### Run the development server

```bash
npm run dev
```

Vite will print the local development URL in the terminal.

### Build

```bash
npm run build
```

### Typecheck

```bash
npm run typecheck
```

### Test

```bash
npm run test
```

Bundles and runs the manual fixture suite (`src/run-fixtures.test.ts`). There is no test framework and no single-test runner; the whole suite runs together.

## Configuration

The app can run without Firebase. When Firebase environment variables are missing, it should fall back to local storage.

To enable Firebase-backed sync, copy the example environment file:

```bash
cp .env.example .env
```

Then fill in the Firebase values:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

In the Firebase console, enable **Authentication → Sign-in method → Anonymous** and **Google**, and create a Firestore database. Deploy the rules and (optionally) hosting with:

```bash
npm run build && npx firebase deploy --only firestore:rules,hosting
```

Access model in Firebase mode: the GM shares the **invite link** from Manage → Party; anyone who opens it joins as a player. The plain party URL does not grant access. Any user can sign in with Google from Manage → Account so their role survives cleared browser data or a new device.

### Security rules tests

```bash
npm run test:rules
```

Runs `scripts/test-rules.mjs` against the Firestore emulator (requires a Java runtime).

## Project Documents

The main project documents are:

- `APP_SPEC.md` — app goals, constraints, stack, and persistence behavior.
- `MODEL_SPEC.md` — canonical data model and rule calculations.
- `ENCUMBRANCE_SPEC.md` — encumbrance rules and expected behavior.
- `GEAR_VIEW_SPEC.md` — the Party Gear board, the Floor, and the drag-and-drop contract (view + interaction only).
- `SYNC_SPEC.md` — the Firestore document shape, field-level writes, and sync failure handling.
- `CONTENT_GUIDE.md` — how to author the bundled rule-content JSON libraries.
- `TASKS.md` — what is done, in progress, and open, plus the post-1.0 list.

Use these documents as the source of truth when changing behavior.

## Development Notes

- Prefer minimal, focused changes.
- Do not introduce unrelated refactors.
- Keep the inventory model simple.
- Use `entity` terminology for characters, retainers, mounts, vehicles, and storage.
- Keep derived calculations derived unless there is a clear performance reason to store them.
- Preserve local mode behavior when adding Firebase-related changes.

## License

No license has been specified.
