// Transcribes the four spell lists of the Old-School Essentials Advanced
// Fantasy Player's Tome PDF into systems/ose-advanced-fantasy/spell_library.json.
//
// Usage: node scripts/extract-oseaf-spells.mjs [path/to/tome.pdf]
//
// Requires poppler's `pdftotext` on PATH. The output folder is git-ignored
// (see systems/README.md); nothing here ships rule text into the repository.
// The parser is specific to this book's layout: the spell-list index pages are
// read for names, levels, and reversed names; the description chapters are
// read one column at a time so side-by-side spells never interleave.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const systemDir = join(rootDir, "systems", "ose-advanced-fantasy");
const outFile = join(systemDir, "spell_library.json");

// PDF page = printed page − 2 for this edition.
const PRINTED_PAGE_OFFSET = 2;
const PAGE_WIDTH_PT = 420;
const PAGE_HEIGHT_PT = 596;
const COLUMN_SPLIT_PT = 210;

const LISTS = [
  {
    id: "cleric",
    displayName: "Cleric",
    indexPrintedPage: 128,
    printedPages: [134, 145],
    header: "Cleric Spells",
    license: "Open Game Content (OGL 1.0a designation, p246)",
  },
  {
    id: "druid",
    displayName: "Druid",
    indexPrintedPage: 129,
    printedPages: [146, 157],
    header: "Druid Spells",
    license: "Product identity (not declared Open Game Content)",
  },
  {
    id: "illusionist",
    displayName: "Illusionist",
    indexPrintedPage: 130,
    printedPages: [158, 189],
    header: "Illusionist Spells",
    license: "Product identity (not declared Open Game Content)",
  },
  {
    id: "magicUser",
    displayName: "Magic-User",
    indexPrintedPage: 131,
    printedPages: [190, 211],
    header: "Magic-User Spells",
    // The reincarnation tables after the last spell are not transcribed.
    stopAt: /^Reincarnation: Class/,
    license: "Open Game Content (OGL 1.0a designation, p246)",
  },
];

const pdfPath = process.argv[2] ?? findPdf();

if (!pdfPath || !existsSync(pdfPath)) {
  console.error(
    "No PDF found. Put the Player's Tome PDF in systems/ose-advanced-fantasy/ or pass its path.",
  );
  process.exit(1);
}

const problems = [];
const spellLists = {};
const stats = [];

for (const list of LISTS) {
  const index = parseIndexPage(list);
  const entries = parseDescriptions(list, index);
  const levels = {};

  for (const indexEntry of index) {
    const entry = entries.get(indexEntry.key);

    if (!entry) {
      problems.push(`${list.id}: no description found for "${indexEntry.name}"`);
      continue;
    }

    const levelKey = String(indexEntry.level);
    levels[levelKey] ??= [];
    levels[levelKey].push({
      id: toCamelCaseId(indexEntry.name),
      displayName: indexEntry.name,
      ...(indexEntry.reversedName
        ? { reversible: true, reversedName: indexEntry.reversedName }
        : { reversible: false }),
      duration: entry.duration,
      range: entry.range,
      description: entry.description,
    });
  }

  for (const key of entries.keys()) {
    if (!index.some((indexEntry) => indexEntry.key === key)) {
      problems.push(`${list.id}: description "${key}" is not in the index`);
    }
  }

  spellLists[list.id] = {
    id: list.id,
    displayName: list.displayName,
    levels,
  };
  stats.push(
    `${list.id}: ${index.length} indexed, ${entries.size} described, levels ${Object.entries(
      levels,
    )
      .map(([level, spells]) => `${level}:${spells.length}`)
      .join(" ")}`,
  );
}

const output = {
  schemaVersion: "1.0.0-transcribed",
  ruleset: "Old-School Essentials Advanced Fantasy spell lists",
  sourceBasis: [
    "Old-School Essentials Advanced Fantasy Player's Tome (Necrotic Gnome). Spell lists: Cleric p128, Druid p129, Illusionist p130, Magic-User p131. Spell descriptions: Cleric pp134-145, Druid pp146-157, Illusionist pp158-189, Magic-User pp190-211.",
    "Transcribed mechanically by scripts/extract-oseaf-spells.mjs from the PDF; ligatures (Th, ffi) and bullet glyphs restored by the script. Spot-check against the printed pages before treating any single value as audited.",
  ],
  license: {
    note: "The book's OGL 1.0a designation (p246) declares the Cleric Spells, Magic-User Spells, Cleric Spell List, and Magic-User Spell List sections Open Game Content. Druid and Illusionist spells are not declared and are product identity. This file is kept outside version control for personal table use; do not redistribute without resolving that.",
    byList: Object.fromEntries(LISTS.map((list) => [list.id, list.license])),
  },
  spellLists,
};

mkdirSync(systemDir, { recursive: true });
writeFileSync(outFile, `${JSON.stringify(output, null, 2)}\n`);

console.log(`Wrote ${outFile}`);
for (const line of stats) console.log(line);
if (problems.length > 0) {
  console.log(`\n${problems.length} problem(s):`);
  for (const problem of problems) console.log(`- ${problem}`);
  process.exitCode = 2;
}

// ---------------------------------------------------------------------------

function findPdf() {
  if (!existsSync(systemDir)) return undefined;
  const pdf = readdirSync(systemDir).find((name) => name.toLowerCase().endsWith(".pdf"));
  return pdf ? join(systemDir, pdf) : undefined;
}

function pdftotext(printedPage, crop) {
  const pdfPage = String(printedPage - PRINTED_PAGE_OFFSET);
  const args = ["-f", pdfPage, "-l", pdfPage];
  if (crop) {
    args.push("-x", String(crop.x), "-y", "0", "-W", String(crop.w), "-H", String(PAGE_HEIGHT_PT));
  }
  args.push(pdfPath, "-");
  return execFileSync("pdftotext", args, { encoding: "utf8" });
}

/** The index page lists "N." on one run of lines and the names on the next. */
function parseIndexPage(list) {
  const lines = pdftotext(list.indexPrintedPage)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const entries = [];
  let level = 0;
  let expected = 0;
  let collected = 0;

  for (const rawLine of lines) {
    const line = fixGlyphs(rawLine);
    const levelMatch = line.match(/^(\d)(?:st|nd|rd|th) Level$/);

    if (levelMatch) {
      level = Number(levelMatch[1]);
      expected = 0;
      collected = 0;
      continue;
    }

    if (level === 0) continue;
    if (/^\d+\.$/.test(line)) {
      expected += 1;
      continue;
    }
    if (/^\d+$/.test(line)) continue; // page number
    if (line.startsWith("Reversible Spells")) break;
    if (collected >= expected) continue; // trailing prose on the page

    const nameMatch = line.match(/^(.*?)\s*(?:\((.+)\))?$/);
    const name = nameMatch[1].trim();
    const reversedName = nameMatch[2]?.trim();
    entries.push({
      name,
      reversedName,
      level,
      key: normalize(name),
    });
    collected += 1;
  }

  return entries;
}

function parseDescriptions(list, index) {
  const indexKeys = new Set(index.map((entry) => entry.key));
  const [firstPage, lastPage] = list.printedPages;
  const lines = [];

  for (let page = firstPage; page <= lastPage; page += 1) {
    for (const crop of [
      { x: 0, w: COLUMN_SPLIT_PT },
      { x: COLUMN_SPLIT_PT, w: PAGE_WIDTH_PT - COLUMN_SPLIT_PT },
    ]) {
      lines.push(...pdftotext(page, crop).split("\n").map((line) => line.trimEnd()));
      lines.push("");
    }
  }

  const stopIndex = list.stopAt ? lines.findIndex((line) => list.stopAt.test(line.trim())) : -1;
  const cleaned = (stopIndex === -1 ? lines : lines.slice(0, stopIndex))
    .map((line) => fixGlyphs(line.trim()))
    .filter(
      (line) =>
        // Running headers straddle the column split, so fragments such as
        // "er Spells" arrive on their own line.
        !(
          line.length >= 3 &&
          list.header.includes(line) &&
          !indexKeys.has(normalize(line))
        ) &&
        !/^\d(?:st|nd|rd|th) Level Spells$/.test(line) &&
        !/^\d+$/.test(line),
    );

  // Find spell starts: name line(s), then "Duration:", then "Range:".
  const starts = [];
  for (let i = 0; i < cleaned.length; i += 1) {
    if (!cleaned[i].startsWith("Duration:")) continue;
    const rangeIndex = findRangeLine(cleaned, i + 1);
    if (rangeIndex === -1) continue;

    const oneLine = previousNonEmpty(cleaned, i - 1, 1);
    const twoLines = previousNonEmpty(cleaned, i - 1, 2);
    const candidates = [oneLine, twoLines].filter(Boolean);
    const match = candidates.find((candidate) => indexKeys.has(normalize(candidate.text)));

    if (!match) {
      if (oneLine && /^[A-Z][A-Za-z'’ \-\/0-9]+$/.test(oneLine.text) && oneLine.text.length < 40) {
        problems.push(
          `${list.id}: "${oneLine.text}" looks like a spell heading but is not in the index`,
        );
      }
      continue;
    }

    starts.push({
      key: normalize(match.text),
      nameStart: match.startIndex,
      durationIndex: i,
      rangeIndex,
    });
  }

  const entries = new Map();

  starts.forEach((start, position) => {
    const end = position + 1 < starts.length ? starts[position + 1].nameStart : cleaned.length;
    const duration = cleaned
      .slice(start.durationIndex, start.rangeIndex)
      .join(" ")
      .replace(/^Duration:\s*/, "")
      .trim();
    const bodyStart = start.rangeIndex + 1;
    const range = cleaned[start.rangeIndex].replace(/^Range:\s*/, "").trim();
    const description = buildParagraphs(cleaned.slice(bodyStart, end));

    if (entries.has(start.key)) {
      problems.push(`${list.id}: duplicate description for "${start.key}"`);
    }
    if (!description) {
      problems.push(`${list.id}: empty description for "${start.key}"`);
    }

    entries.set(start.key, { duration, range, description });
  });

  return entries;
}

function findRangeLine(lines, from) {
  for (let i = from; i < Math.min(from + 2, lines.length); i += 1) {
    if (lines[i].startsWith("Range:")) return i;
    if (lines[i] === "") return -1;
  }
  return -1;
}

function previousNonEmpty(lines, from, count) {
  const picked = [];
  let i = from;
  while (i >= 0 && picked.length < count) {
    if (lines[i] === "") {
      if (picked.length > 0) break;
      i -= 1;
      continue;
    }
    picked.unshift(i);
    i -= 1;
  }
  if (picked.length !== count) return undefined;
  return { text: picked.map((index) => lines[index]).join(" "), startIndex: picked[0] };
}

function buildParagraphs(lines) {
  const paragraphs = [];
  let current = [];

  const flush = () => {
    if (current.length > 0) {
      paragraphs.push(current.join(" ").replace(/\s+/g, " ").trim());
      current = [];
    }
  };

  for (const line of lines) {
    if (line === "") {
      flush();
      continue;
    }
    // Bold lead-ins ("Restrictions:", "Material cost:") start a paragraph in
    // print but arrive with no blank line before them.
    const startsBlock =
      line.startsWith("• ") ||
      /^\d+\. /.test(line) ||
      /^[A-Z][A-Za-z’' \-]{0,40}:(\s|$)/.test(line);
    if (startsBlock) flush();
    current.push(line);
  }
  flush();

  return paragraphs.join("\n");
}

/** The PDF's Th and ffi ligatures come out as "!" and "'"; bullets as "%". */
function fixGlyphs(text) {
  return text
    .replace(/!(?=[a-z])/g, "Th")
    .replace(/(?<=[a-z])'(?=[a-z])/g, "ffi")
    .replace(/^%\s*/, "• ");
}

function normalize(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function toCamelCaseId(name) {
  const words = name
    .replace(/[’']/g, "")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  return words
    .map((word, index) =>
      index === 0 ? word.toLowerCase() : word[0].toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join("");
}
