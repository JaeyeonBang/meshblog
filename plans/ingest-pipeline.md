# Ingest Pipeline Plan v2 — graphify-style raw → notes / posts / concepts

> Author: planning session 2026-05-05
> Supersedes: v1 (rejected as over-engineered after eng review + Opus outside-voice review)
> Status: APPROVED — Phase 1 (2d) + Phase 2 (7d), total 9d

## 0. Goal

Drop a raw file (PDF / DOCX / PPTX / MD / TXT) anywhere into the vault and have
meshblog's knowledge graph absorb it incrementally — same UX as
`graphify update .` for code, but for prose. Edges to existing notes appear
automatically through three paths:

1. **Entity co-occurrence** (automatic): shared entities link the new note to
   existing ones via Louvain community membership.
2. **Wikilinks** (auto-suggested + author confirms): `--auto-link` inserts
   `[[<slug>|<surface>]]` for entities that already exist as notes.
3. **Concept membership** (automatic): Louvain re-clusters → new entities
   slot into existing or new concepts; concept names refresh via LLM.

## 1. Why this shape (lessons from v1 review)

The original v1 plan proposed 6 skills + 25 files + 14 days. Cross-model review
(eng review + Opus fresh-context) converged on:

- The visible bug TODAY is `concepts.ts:34` `nameCommunity()` returning
  `"Concept cluster: a, b, c"`. Fixing that is ~80% of the perceivable graph
  quality gain.
- All proposed caches (`concept_names_cache`, `entity_name_embeddings`) are
  speculative — Louvain is stochastic, so cache hit rate ≈ 0% without a fixed
  RNG seed; on-demand entity embedding is run quarterly.
- Skills `/promote`, `/dedupe-entities`, `/refine-concepts` (standalone),
  `/suggest-links` (standalone) are theatre over thin scripts.
- Speculative columns (`summary`, `source_path`, `source_url`, `derived_from`,
  `published_at`) have no UI consumer.

This v2 ships the visible bug fix in **2 days (Phase 1)** independently, then
adds graphify-style ingest in **7 days (Phase 2)**. Two sequential PRs.

## 2. Mental model

```
                          ┌──────────────────────────────────┐
   raw file (PDF/DOCX/    │                                  │
   PPTX/MD/TXT) or URL ──▶│       /ingest-raw                │
                          │   (Phase 2)                      │
                          │  ┌───────────────────────┐       │
                          │  │ extract text          │       │
                          │  │ enrich frontmatter    │       │
                          │  │ archive raw           │       │
                          │  │ auto-link wikilinks   │       │
                          │  └───────────┬───────────┘       │
                          │              ▼                   │
                          │  content/notes/<slug>.md         │
                          │  (draft: true)                   │
                          └──────────────┬───────────────────┘
                                         │
                                         ▼
                          ┌──────────────────────────────────┐
                          │       bun run refresh            │
                          │  (already exists)                │
                          │  ┌───────────────────────┐       │
                          │  │ build-tokens          │       │
                          │  │ build-index ──┐       │       │
                          │  │  ┌─ entity extract     │      │
                          │  │  └─ Louvain communities│      │
                          │  │ build-backlinks       │       │
                          │  │ cluster-communities   │       │
                          │  │ export-graph          │       │
                          │  │  ▲                    │       │
                          │  │  │ Phase 1: nameCommunity LLM │
                          │  └──┴───────────────────┘        │
                          └──────────────┬───────────────────┘
                                         ▼
                          public/graph/note-l*.json + backlinks.json
                          ─────────────────────────────────────────
                          three edge types automatically incorporated:
                          ① shared-entity  ② wikilink  ③ co-concept
```

`/ingest-raw _inbox/ --auto-link --refresh` is the single command. Author drops
files in `_inbox/`, runs once, graph updates. graphify-style.

## 3. Skill catalogue (final)

| Skill | Phase | Backing script | Notes |
|-------|-------|----------------|-------|
| **`/ingest-raw`** | 2 | `scripts/ingest-raw.ts` | File or directory. `--auto-link` + `--refresh` ON by default. |
| **`/draft-post`** | 2 | `scripts/draft-post.ts` | N notes → post in `content/posts/`. |

**Removed from v1:** `/suggest-links`, `/refine-concepts` (skill), `/dedupe-entities`,
`/promote`. See §10.

**Production code change (no skill):** `nameCommunity()` LLM call lands in Phase 1.
Existing `/re-extract` skill rerun handles existing DBs.

---

## PHASE 1 — Foundation (2 days)

Visible-bug fix + alias plumbing. Ships independently as one PR.

### 1.1 Schema migration (single column)

```sql
ALTER TABLE notes ADD COLUMN aliases TEXT NOT NULL DEFAULT '[]';
```

`scripts/migrate.ts` already handles idempotent `ALTER TABLE ADD COLUMN` (verify
it does; if not, fix as part of this phase).

**Removed from v1:** `summary`, `source_path`, `source_url`, `derived_from`,
`published_at`. Add when a renderer needs them.

### 1.2 D0 — alias-aware wikilink resolver

**Problem**: `resolve-wikilinks.ts` and `build-backlinks.ts` both lookup by
`id.toLowerCase()` only. `aliases:` frontmatter is ignored. `[[self-attention]]`
won't resolve to `12-transformer-self-attention.md` even with
`aliases: ["self-attention"]`.

**New file**: `src/lib/markdown/wikilink-resolver.ts`

```typescript
export type Wikilink = {
  isImage: boolean
  target: string         // raw text inside [[...]]
  alias: string | null
  position: number       // char offset
}

export type LookupMap = Map<string, string>  // lowercased name → slug

/** Single regex source — replaces 3 duplicated copies. */
export function parseWikilinks(text: string): Wikilink[]

/** Build slug+alias lookup. Throws on collision (see policy below). */
export function buildLookupMap(
  notes: { id: string; aliases: string[] }[],
): { lookup: LookupMap; collisions: AliasCollision[] }

export type AliasCollision = {
  alias: string
  claimers: string[]   // note ids claiming this alias
}
```

**Collision policy**:
- Slug always wins over alias (literal match on lowercased id).
- Two notes claiming the same alias → **neither gets it**. Alias resolves to
  null. `[[<that-alias>]]` renders as `wikilink--missing`. Collisions
  list is returned to the caller for logging.
- Build-time: `build-index.ts` calls this and logs collisions to stderr (loud,
  not fatal). Future v2 surfaces via `/audit`.

**Files updated**:
- `src/lib/markdown/resolve-wikilinks.ts` — consume new resolver factory.
- `scripts/build-backlinks.ts` — replace local `buildSlugMap` with shared
  `buildLookupMap`. Read `aliases` JSON from `notes.aliases` column.
- `scripts/build-index.ts` — write `aliases` column from frontmatter:
  `aliases: JSON.stringify(fm.aliases ?? [])`.

### 1.3 backfill-aliases script

**New file**: `scripts/backfill-aliases.ts`

For each existing note with `aliases: []` or no `aliases:` field:
1. LLM call (Haiku 4.5): given title + first 1500 chars of body, suggest 0-3
   common aliases (acronyms like "PPO", common alt forms, hyphenation
   variants). Strict JSON output, Zod-validated.
2. Stage edits to each frontmatter via `gray-matter.stringify`.
3. Print a unified diff. Confirm with prompt before writing.
4. Idempotent: skip notes with non-empty `aliases:`.

CLI: `bun run scripts/backfill-aliases.ts [--dry-run] [--yes]`.

### 1.4 nameCommunity LLM fix (concepts.ts)

**Problem**: `src/lib/rag/concepts.ts:34-46` returns `"Concept cluster: a, b, c"`.
This is the visible quality bug.

**Replace with** (no cache table):

```typescript
async function nameCommunity(
  memberNames: string[],
  memberDescriptions?: string[],
): Promise<{ name: string; description: string }> {
  if (!process.env.OPENROUTER_API_KEY) {
    return heuristicName(memberNames)  // existing behavior, keyless mode
  }

  const messages = buildConceptNamingPrompt(memberNames, memberDescriptions)
  const response = await callOpenRouter({ messages, model: HAIKU, maxTokens: 200, temperature: 0.3 })
  const json = await response.json()
  const parsed = conceptNameSchema.parse(JSON.parse(json.choices[0].message.content))
  return parsed
}
```

**No cache** — Louvain is stochastic so any `sha256(member_names)` cache key
misses on every refresh. Cost per refresh: ~$0.01 on Haiku for typical
20-50 communities. Re-evaluate caching only if cost grows visibly.

**New file**: `src/lib/llm/prompts/concept-naming.ts`

Prompt:
- Input: member entity names (capped 20) + optional descriptions.
- Output: `{ name: string (2-5 words, capitalized, no period), description: string (one sentence, ≤120 chars) }`.
- Zod validation. On parse fail: 1 retry with `temperature=0.1`. Fall back to heuristic on second fail.

**Heuristic fallback** (extracted from current stub for keyless mode):

```typescript
function heuristicName(memberNames: string[]) {
  const first = memberNames[0] ?? "Unknown"
  return {
    name: first.slice(0, 100),
    description: `Concept cluster: ${memberNames.slice(0, 5).join(", ")}`.slice(0, 500),
  }
}
```

### 1.5 Phase 1 acceptance

1. `bunx astro check` — 0 errors.
2. `bunx vitest run` — all green (existing 252 + ~15 new).
3. `bun run build:fixture` — exits 0.
4. After `bun run refresh` on the existing 12-note vault:
   - Concepts have LLM-named labels (e.g., "Attention Mechanisms" not "self-attention").
   - ≥ 80% of concepts have description > 50 chars.
5. After `bun run scripts/backfill-aliases.ts --yes` then `bun refresh`:
   - `[[PPO]]` in any note resolves to `09-ppo` via alias.
6. Authoring two notes with the same alias logs a clear stderr collision
   message, the alias resolves to `wikilink--missing` in both directions.
7. CI green; live site shows updated concept names within 5 min of merge.

### 1.6 Phase 1 file list

**New (5):**
- `src/lib/markdown/wikilink-resolver.ts`
- `src/lib/markdown/__tests__/wikilink-resolver.test.ts`
- `src/lib/llm/prompts/concept-naming.ts`
- `scripts/backfill-aliases.ts`
- `scripts/__tests__/backfill-aliases.test.ts`

**Updated (7):**
- `src/lib/db/schema.sql` (+1 column)
- `src/lib/markdown/resolve-wikilinks.ts`
- `scripts/build-backlinks.ts`
- `scripts/build-index.ts`
- `scripts/__tests__/build-index.test.ts`
- `scripts/__tests__/build-backlinks.test.ts`
- `src/lib/rag/concepts.ts` + `src/lib/rag/__tests__/concepts.test.ts`

**Total: 12 files. Tests red-first per global TDD rule.**

### 1.7 Phase 1 parallelization

Two independent lanes — both can run in parallel Sonnet agents.

| Lane | Files | Rationale |
|------|-------|-----------|
| **L1** (alias plumbing) | wikilink-resolver.ts (NEW) + resolve-wikilinks.ts + build-backlinks.ts + build-index.ts + schema.sql + backfill-aliases.ts + their tests | All alias-related; share schema + resolver factory. |
| **L2** (concept naming) | concepts.ts + prompts/concept-naming.ts + concepts.test.ts | Self-contained; touches no file in L1. |

After both lanes complete: integration verify (vitest run, astro check, build:fixture).

---

## PHASE 2 — graphify-style ingest (7 days)

Ships after Phase 1 is merged + verified live. Second PR.

### 2.1 `/ingest-raw` — single skill, all formats

**Invocation**:
```bash
bun run ingest-raw <file-or-dir> [flags]

# common shapes:
bun run ingest-raw ~/Downloads/paper.pdf            # single file, defaults
bun run ingest-raw _inbox/                          # process every raw file in dir
bun run ingest-raw paper.pdf --no-auto-link         # opt out of auto-wikilink
bun run ingest-raw paper.pdf --no-refresh           # skip the post-ingest refresh
bun run ingest-raw paper.pdf --dry-run              # extract + enrich, print, write nothing
bun run ingest-raw paper.pdf --estimate             # token count + cost, no LLM call
```

**Defaults**: `--auto-link=true`, `--refresh=true`. Author drops files, runs
once, graph updates. graphify parity.

**Pipeline per file**:

```
1. Format detect          — extension + magic byte
2. Extract text           — dispatcher (pdf-parse | mammoth | officeparser | passthrough)
3. Slugify                — reuse scripts/new-post.ts:slugify; --title overrides
4. Refuse if exists       — content/notes/<slug>.md present → exit 1 (or --force)
5. Archive raw            — cp to .cache/sources/<slug>.<ext>  (gitignored)
6. Build entity vocab     — DB query: top-200 entities by mention_count
7. LLM enrich             — Haiku 4.5; structured JSON; 16K char body cap
8. Compose frontmatter    — title, tags, aliases, draft:true
9. Auto-link (if enabled) — for each suggested_link {surface, target_slug}:
                            replace first non-code occurrence of surface
                            with [[target_slug|surface]]
10. Atomic write          — tmpfile + rename to content/notes/<slug>.md
11. (after all files)     — if --refresh: bun run refresh
```

**Format dispatcher** (`scripts/lib/ingest-helpers/extract-text.ts`):

| Format | Library | Notes |
|--------|---------|-------|
| `.md` `.txt` | `fs.readFileSync` | passthrough |
| `.pdf` | `pdf-parse` (new dep) | text PDFs only; if extracted length < 50 → log `[scanned-pdf]`, skip LLM, return error |
| `.docx` | `officeparser` (new dep) | unified format dispatcher; verify .docx parity vs `mammoth` on fixture before committing |
| `.pptx` | `officeparser` | per-slide text |
| URL | **assistant-mediated only** | bash script accepts file paths only; the SKILL.md explains: assistant pre-fetches via `mcp__jina-reader__*`, writes to `/tmp/<hash>.md`, invokes script with file path + `--source-url=<url>` |

`.doc` legacy: unsupported. Print error pointing to "save as .docx".

**LLM enrich prompt** (`src/lib/llm/prompts/ingest-enrich.ts`):

System:
- Output strict JSON: `{ title, tags, aliases, body, suggested_links }`.
- `tags` ≤ 5; prefer entries from supplied `existing_tags` list.
- `aliases` ≤ 5; obvious acronyms + common alt forms.
- `body` cleaned markdown (preserve headings/tables/code/math).
- `suggested_links: [{ surface, target_slug }]` — only entities that match
  exactly an entry in `existing_entities`. Surface must appear verbatim in body.
- Temperature 0.3, max_tokens 6000.

**Auto-link impl** (`scripts/lib/ingest-helpers/auto-link.ts`):

For each `{ surface, target_slug }`:
1. Find first occurrence of `surface` in body via case-insensitive whole-word
   regex.
2. Skip if inside fenced code block, inline code, or already wrapped in `[[...]]`.
3. Replace with `[[<target_slug>|<surface>]]`.

**Directory mode**:
- Walks dir non-recursive (or recursive with `--recursive`).
- Per-file errors isolated (log + continue), final summary count.
- Atomic per-file: a failure on file 3 leaves files 1-2 written.
- Single `bun run refresh` at the end (not per-file).

### 2.2 `/draft-post`

**Invocation**:
```bash
bun run draft-post --title "..." --notes <slug-1>,<slug-2>,<slug-3>
```

**Pipeline**:
1. Resolve note slugs → load body + tags.
2. LLM call (Sonnet 4.6, temperature 0.5, 8K tokens):
   `{ lede, sections: [{heading, body}], conclusion }`. Each section body must
   cite ≥ 1 source note via `[[slug|surface]]`. Zod-validated; reject + 1 retry
   if a section is uncited.
3. Compose frontmatter: title, draft:true, tags (union of source-note tags,
   capped 5), category (majority vote across source notes).
4. Write `content/posts/<slug>.md` atomically.
5. Print path + per-source citation count.

### 2.3 New deps

| Package | Purpose | Verified license |
|---------|---------|------------------|
| `pdf-parse` | PDF text | MIT |
| `officeparser` | DOCX + PPTX | MIT |

`mammoth` and `pizzip` rejected (single-format coverage; officeparser unifies).

### 2.4 Phase 2 acceptance

End-to-end fork-user scenario:

1. Drop `~/Downloads/some-paper.pdf` into vault → `bun run ingest-raw <path>`
   → draft note appears in `content/notes/<slug>.md`.
2. Refresh runs automatically. Graph view shows the new node connected to
   existing notes via shared entities (visible in browser within 30s).
3. If the paper cites PPO, `[[09-ppo|PPO]]` appears auto-linked in the body
   (verify by `git diff content/notes/<slug>.md`).
4. Drop 3 papers in `_inbox/` → `bun run ingest-raw _inbox/` → all 3 ingested,
   one refresh at end, graph shows 3 new nodes properly clustered.
5. `bun run draft-post --title "X" --notes a,b,c` → post in `content/posts/`,
   each source note cited via wikilink ≥ 1 time.
6. `bun run audit` passes on all generated files.
7. `git push` → CI green → live site shows new content + graph edges within 5 min.

### 2.5 Phase 2 file list

**New (~10):**
- `scripts/ingest-raw.ts`
- `scripts/draft-post.ts`
- `scripts/lib/ingest-helpers/extract-text.ts`
- `scripts/lib/ingest-helpers/auto-link.ts`
- `scripts/lib/ingest-helpers/archive.ts`
- `src/lib/llm/prompts/ingest-enrich.ts`
- `src/lib/llm/prompts/post-synth.ts`
- `.claude/skills/ingest-raw/SKILL.md`
- `.claude/skills/draft-post/SKILL.md`
- `.gitignore` update for `.cache/sources/` and `_inbox/`

**Updated (~3):**
- `src/lib/rag/graph.ts` — add optional `dryRun: boolean` to `extractEntities`
  for re-use by ingest enrich
- `package.json` — new deps
- Tests for each new script

**Total ~15 files.**

### 2.6 Phase 2 parallelization

Cleaner split than Phase 1:

| Lane | Files | Independent? |
|------|-------|--------------|
| **L3** (extract + ingest) | extract-text, archive, auto-link, ingest-raw, ingest-enrich prompt | Yes — self-contained pipeline |
| **L4** (post synth) | post-synth prompt, draft-post script | Yes — different inputs |
| **L5** (skill metadata) | both SKILL.md files + .gitignore | Trivial; can be folded into L3 or done sequentially after |

Run L3 + L4 in parallel, L5 sequential at end.

---

## 4. Risks (consolidated)

| # | Risk | Mitigation |
|---|------|-----------|
| 1 | Scanned PDFs return no text | Length-50 heuristic → emit `[scanned]` warning, skip LLM. v2: vision flow. |
| 2 | LLM hallucinates entity not in source | Zod schema enforces `suggested_links` entries appear in extracted text. Retry once on violation. |
| 3 | Auto-link clobbers code blocks | `auto-link.ts` skips fenced + inline code regions before replace. Test fixture with 5 collision shapes. |
| 4 | Alias collision between two notes | Per §1.2: alias resolves to null, both surface as `wikilink--missing`. Logged loudly. |
| 5 | Atomic write half-state | Archive first → LLM → tmpfile + rename. On any post-archive failure: archive stays, no half-written note. |
| 6 | LLM cost spike on `_inbox/` of 50 PDFs | `--estimate` flag prints per-file token cost without LLM call. Document expected $/file in SKILL.md. |
| 7 | `officeparser` .docx output worse than `mammoth` | Phase 2 first task: run on 1 docx fixture, compare to known-good output. If parity fails → swap to `mammoth` for .docx + officeparser for .pptx. |
| 8 | URL ingest path mis-wired | Phase 2 SKILL.md spells out: assistant fetches via jina-reader → writes to `/tmp/<hash>.md` → invokes script. Bash script never sees URLs. |
| 9 | `nameCommunity` LLM regression vs heuristic | Phase 1 acceptance test compares LLM output to heuristic on fixture; flag if descriptions ≤ 30 chars or names contain banned phrases. |

## 5. NOT in scope

- OCR for scanned PDFs / image-only slides
- `.doc` legacy Word
- Bulk-ingest watcher daemon (file system events)
- `/promote`, `/dedupe-entities`, `/refine-concepts` (skill), `/suggest-links`
  standalone — see §1
- Concept name caching (Louvain non-determinism makes it ineffective)
- Entity name embedding cache
- `derived_from`, `summary`, `source_path`, `source_url`, `published_at` columns
- Re-synthesis of posts when source notes change
- Multilingual ingest (current scope: KOR + ENG via existing `has_en` flow)
- `/audit` integration of alias collisions (Phase 1 logs to stderr; v2 audit hook)

## 6. Sequencing

```
Day 1-2:  Phase 1     (parallel L1 + L2)
Day 2:    Verify, PR, merge, deploy
Day 3:    Phase 2 starts (parallel L3 + L4)
Day 9:    Phase 2 verify, PR, merge, deploy
```

Phase 2 does **not** start until Phase 1 is live. The visible-bug fix
(nameCommunity) ships independently — that's the primary risk-reduction move.
