import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outfile = resolve(rootDir, ".test-dist/run-fixtures.test.mjs");

await mkdir(dirname(outfile), { recursive: true });

await build({
  entryPoints: [resolve(rootDir, "src/run-fixtures.test.ts")],
  outfile,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  jsx: "automatic",
  sourcemap: "inline",
  logLevel: "silent",
});

await import(pathToFileURL(outfile).href);
