---
name: ingest-raw
description: Convert PDF, DOCX, PPTX, MD, or TXT files (or a directory of them) into draft notes in content/notes/. Auto-suggests wikilinks against existing entities and triggers `bun run refresh` so the graph view updates immediately. graphify-style. Triggers — "ingest", "import this paper", "process raw files", "ingest the inbox".
---

# /ingest-raw

Drop a raw file (or a directory of them) and meshblog produces a draft note + wires it into the entity/concept graph. The same UX as `graphify update .` for prose.

## What it does

1. Detect format via extension (`.pdf` `.docx` `.pptx` `.md` `.txt`).
2. Extract text (`pdf-parse`, `officeparser`, or passthrough).
3. Pull existing entity → note vocab from `.data/index.db` (top 200 by mention_count).
4. LLM enrich (Haiku 4.5): produce title, tags, aliases, cleaned body, and a list of `[surface → target_slug]` wikilink candidates.
5. Filter candidates to only entities that map to existing notes; auto-insert `[[<slug>|<surface>]]` at the first non-code occurrence.
6. Atomic write to `content/notes/<slug>.md` (`draft: true`).
7. Archive original to `.cache/sources/<slug>.<ext>` (gitignored).
8. Run `bun run refresh` so the graph view picks up the new node + edges.

## Run

```bash
# single file (defaults: --auto-link ON, --refresh ON)
bun run scripts/ingest-raw.ts ~/Downloads/some-paper.pdf

# directory (typical pattern: drop everything in _inbox/, run once)
bun run scripts/ingest-raw.ts _inbox/

# common flags
--title "..."     override the LLM-suggested title (single file only)
--no-auto-link    skip wikilink auto-insertion
--no-refresh      skip post-ingest `bun run refresh`
--force           overwrite an existing target file
--dry-run         extract + LLM enrich, write nothing
--estimate        print token + cost estimate, no LLM call
```

## URL handling (assistant-mediated)

The bash script accepts file paths only. URLs raise an error. To ingest a URL:

1. Assistant fetches the page via `mcp__jina-reader__*` (per the project's interaction rules — never WebFetch).
2. Assistant writes the markdown body to `/tmp/<short-hash>.md`.
3. Assistant invokes `bun run scripts/ingest-raw.ts /tmp/<short-hash>.md --title "<original page title>"`.

The script never sees the URL itself. This keeps the bash entry point focused on file I/O while preserving the prohibition on direct web fetches.

## Cost

LLM enrichment runs through the local `claude -p` CLI, so the marginal monetary cost is whatever your Claude Code session bills (zero on Pro/Max, included subscription minutes otherwise). Wall time is ~3-10s per file thanks to subprocess overhead — heavier than a flat HTTP call but not significant for a personal blog.

Run `--estimate` first for batch ingests to preview total token volume (no LLM call).

## Next step: review + promote

Ingested notes land with `draft: true`, which means **`build-index` excludes them from the search index**. They will not appear in `/draft-post` source lookups, the graph, or the live site until promoted.

Workflow:

1. `/ingest-raw <path>` — produces `content/notes/<slug>.md` (`draft: true`)
2. Review the note: tags sensible? body cleaned? auto-link targets correct?
3. `/promote content/notes/<slug>.md` — flips `draft: false`, sets `published_at`, runs refresh
4. Now usable as a `--notes` source for `/draft-post`

This is intentional: `/ingest-raw` is meant to be cheap and reversible, while publication is a deliberate gate.

## Sibling cross-linking in batch ingest

`/ingest-raw <dir>` loads the entity vocab once before walking the directory, then **augments it after each successful write** with the new note's title + aliases. This means files later in the same batch CAN auto-link to siblings ingested earlier in the same loop — no two-pass workaround needed.

The augmentation is in-memory only; it does not write to the entity DB (that still happens via `build-index` after refresh). The augmentation also runs in dependency order: file 2 can link to file 1, but file 1 cannot link to file 2 (LLM saw an older vocab when it ran). Order the input directory accordingly if a specific cross-link matters.

The auto-link prompt explicitly requires the surface phrase to appear verbatim in the body — fabricated links are not produced. So the worst case for a thin source like a 5-line dataset stub is "no auto-link", not a wrong link.

## "Untitled" rejection

If the LLM returns `Untitled` (or whitespace) as the title — usually because the source is too ambiguous to name confidently — the file is **skipped**, not written as `untitled.md`. The skip reason tells you to either re-run with `--title "Some Distinct Title"` or fix the source heading. This prevents the silent-collision-on-untitled.md trap surfaced by the bulk-ingest dogfood (PR #106).

## Slug collisions in directory mode

When `/ingest-raw` walks a directory, the LLM picks the title for each file independently. Two raw files about the same topic can produce the same slug, in which case the second is **skipped** (the existing target is preserved — no data is lost on disk, but the second file is not ingested).

The summary surfaces collisions explicitly:

```
[ingest-raw] 2 file(s) skipped due to slug collisions:
    COLLISION raw/_inbox/foo.md
    COLLISION raw/_inbox/bar.md
  → re-run each with --title "Distinct Title" to ingest, or accept the loss.
```

If you actually want to ingest both, re-run the script per file with `--title` overrides.

## Idempotency

Re-running on the same input refuses to overwrite. Pass `--force` to bypass. The script writes to a `<slug>.md.tmp` then renames so a mid-write crash leaves no half-state.

Scanned PDFs (extracted text < 50 chars) emit a `[scanned-pdf]` warning and are skipped — vision-LLM ingest is v3 scope.
