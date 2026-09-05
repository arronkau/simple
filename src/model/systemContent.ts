/**
 * Rule-system content loaded from `systems/<system>/<file>.json` at build time.
 *
 * The folder is git-ignored (see `systems/README.md`): it holds transcribed
 * rule text that must not enter version control. Vite resolves the globs below
 * when the app is built or served; on a fresh clone with no `systems/` folder
 * they match nothing and the in-repo skeleton libraries load instead. The
 * fixture bundle (esbuild) has no `import.meta.glob`, so the same fallback
 * applies there and fixtures only ever see the skeletons or injected libraries.
 */

export type SystemContentFile = {
  path: string;
  content: unknown;
};

/**
 * Picks the library to use: the merged system files when at least one system
 * provides this kind of file, otherwise the bundled skeleton. The keyed
 * collection (`spellLists`, `classes`) is merged by entry id in path order,
 * later paths winning, so two systems can be in play at once; every other
 * top-level field (metadata, library-wide lists such as `commonSkills`) is
 * taken from the system files in the same order, later files winning, and
 * falls back to the skeleton's value. A file without the expected collection
 * is skipped.
 */
export function resolveContentLibrary<
  Key extends string,
  Library extends Record<Key, Record<string, unknown>>,
>(
  skeleton: Library,
  collectionKey: Key,
  systemFiles: SystemContentFile[],
): Library {
  const usable = [...systemFiles]
    .sort((left, right) => left.path.localeCompare(right.path))
    .flatMap((file) => {
      const collection = getCollection(file.content, collectionKey);

      return collection
        ? [{ fields: file.content as Record<string, unknown>, collection }]
        : [];
    });

  if (usable.length === 0) {
    return skeleton;
  }

  return {
    ...skeleton,
    ...Object.assign({}, ...usable.map((file) => file.fields)),
    [collectionKey]: Object.assign({}, ...usable.map((file) => file.collection)),
  };
}

export function listSystemFiles(
  globResult: Record<string, unknown>,
): SystemContentFile[] {
  return Object.entries(globResult).map(([path, content]) => ({
    path,
    content,
  }));
}

function getCollection(
  content: unknown,
  collectionKey: string,
): Record<string, unknown> | undefined {
  if (typeof content !== "object" || content === null) {
    return undefined;
  }

  const collection = (content as Record<string, unknown>)[collectionKey];

  if (typeof collection !== "object" || collection === null) {
    return undefined;
  }

  return collection as Record<string, unknown>;
}

/**
 * `import.meta.glob` only exists under Vite. Anywhere else (the esbuild test
 * bundle) the call throws, which is the "no systems folder" case.
 */
export function loadSpellLibraryFiles(): SystemContentFile[] {
  try {
    return listSystemFiles(
      import.meta.glob("/systems/*/spell_library.json", {
        eager: true,
        import: "default",
      }),
    );
  } catch {
    return [];
  }
}

export function loadClassContentFiles(): SystemContentFile[] {
  try {
    return listSystemFiles(
      import.meta.glob("/systems/*/class_content.json", {
        eager: true,
        import: "default",
      }),
    );
  } catch {
    return [];
  }
}
