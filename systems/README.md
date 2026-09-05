# systems/

Rule-system content that must not enter version control: source PDFs and the
rule text transcribed from them. Everything in this folder except this README is
git-ignored (`.gitignore` and `.git/info/exclude`).

Layout: one folder per rule system, holding the source book(s) and the content
files the app knows how to load.

```
systems/
  ose-advanced-fantasy/
    <Player's Tome>.pdf
    spell_library.json     # same shape as src/model/ose_spell_library.json
    class_content.json     # same shape as src/model/ose_class_content.json
```

At build time (`vite dev` / `vite build`) `src/model/systemContent.ts` globs
`systems/*/<file>.json`. When at least one system provides a file, the
in-repo skeleton of that file is ignored and the system files are merged by
entry id; when the folder is absent (a fresh clone) the skeletons load and the
app degrades as documented in `CONTENT_GUIDE.md`. The fixture suite never reads
this folder.

`scripts/extract-oseaf-spells.mjs` regenerates `spell_library.json` from the
Player's Tome PDF (needs poppler's `pdftotext`). `class_content.json` is
hand-authored. See `CONTENT_GUIDE.md` for formats, provenance, and the license
position of each list.
