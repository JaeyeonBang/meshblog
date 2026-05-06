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

Haiku 4.5 input ~$0.001 / 1K tokens. Body cap is 16K chars. Per file: ~$0.001-0.005. Run `--estimate` first for batch ingests to preview spend before committing.

Why Haiku not `claude -p`: measured `claude -p --model haiku` at ~$0.099 / call (79K cache tokens loaded each spawn) vs OpenRouter Haiku ~$0.001 / call. 100× cost ratio. Same rationale documented in `src/lib/rag/concepts.ts`.

## Idempotency

Re-running on the same input refuses to overwrite. Pass `--force` to bypass. The script writes to a `<slug>.md.tmp` then renames so a mid-write crash leaves no half-state.

Scanned PDFs (extracted text < 50 chars) emit a `[scanned-pdf]` warning and are skipped — vision-LLM ingest is v3 scope.
