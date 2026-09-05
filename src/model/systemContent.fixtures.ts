import { listSystemFiles, resolveContentLibrary } from "./systemContent";

type TestLibrary = {
  schemaVersion: string;
  things: Record<string, { id: string; label: string }>;
};

const skeleton: TestLibrary = {
  schemaVersion: "0.1.0-skeleton",
  things: { sample: { id: "sample", label: "Sample" } },
};

export const SYSTEM_CONTENT_MANUAL_FIXTURES = [
  {
    name: "system content falls back to the skeleton when no system files exist",
    actual: resolveContentLibrary(skeleton, "things", []),
    expected: skeleton,
  },
  {
    name: "system content replaces the skeleton collection and keeps its metadata",
    actual: resolveContentLibrary(skeleton, "things", [
      {
        path: "/systems/alpha/things.json",
        content: { things: { one: { id: "one", label: "One" } } },
      },
    ]),
    expected: {
      schemaVersion: "0.1.0-skeleton",
      things: { one: { id: "one", label: "One" } },
    },
  },
  {
    name: "system content merges files by id in path order with later paths winning",
    actual: resolveContentLibrary(skeleton, "things", [
      {
        path: "/systems/beta/things.json",
        content: { things: { one: { id: "one", label: "Beta One" }, two: { id: "two", label: "Two" } } },
      },
      {
        path: "/systems/alpha/things.json",
        content: { things: { one: { id: "one", label: "Alpha One" } } },
      },
    ]),
    expected: {
      schemaVersion: "0.1.0-skeleton",
      things: {
        one: { id: "one", label: "Beta One" },
        two: { id: "two", label: "Two" },
      },
    },
  },
  {
    name: "system content skips files without the expected collection",
    actual: resolveContentLibrary(skeleton, "things", [
      { path: "/systems/alpha/things.json", content: { other: {} } },
      { path: "/systems/beta/things.json", content: "not an object" },
    ]),
    expected: skeleton,
  },
  {
    name: "system file listing keeps the glob path with each file",
    actual: listSystemFiles({ "/systems/alpha/things.json": { things: {} } }),
    expected: [{ path: "/systems/alpha/things.json", content: { things: {} } }],
  },
];
