# Phase 3 — `/promote` + `/prompts` (slimmed per Opus outer voice)

> Author: planning session 2026-05-07
> Status: APPROVED v2 (after Opus fresh-context review)
> Supersedes: original Phase 3 plan (rejected as gold-plated)

## Context

Phase 1 (PR #99) shipped alias resolver + LLM concept naming. Phase 2 (PR #100)
shipped `/ingest-raw` + `/draft-post`. User asked for two more skills:

1. **`/promote`** — bookend the ingest pipeline (drafts → published).
2. **prompt management** — easy way to tune voice for the LLM-driven scripts.

Original plan was ~3 days of yak-shaving. Opus outer voice cut it to ~1 day:
- `/promote` cut from 200→80 lines, drop OG/wikilink/glob/--force/published-at flags
- `/prompts` cut radically: NO presets, NO subdirs, NO `new`/`diff`. ONE override file per use. Three subcommands (list/show/validate).
- **STYLE/CONTRACT split** in TS prompt files: kills the Zod footgun where preset-replaced prompts could break output schema.

## Skill 1: `/promote` (lean)

### Spec

```bash
bun run promote <path> [--dry-run] [--no-refresh]
```

Path can be a single `.md` file OR a directory (then all files inside).
Accepts both `content/notes/*.md` and `content/posts/*.md`.

### Pipeline (per file)

| Step | Severity |
|---|---|
| Frontmatter parses via gray-matter | FAIL |
| `tags` is a non-empty array | FAIL |
| `bun run audit` passes (existing audit script) | FAIL |
| Currently `draft: true` (else SKIP) | INFO |

On all-pass:
1. Set `draft: false` in frontmatter.
2. Add `published_at: <today UTC YYYY-MM-DD>` if not already set.
3. Atomic write: `<file>.tmp` then rename.

After all files: spawn `bun run refresh` unless `--no-refresh`.

### Idempotency

Re-running on already-published file → log `[promote] already published: <path>` and exit 0 (per file). Whole-batch exit code = 0 if no FAIL anywhere, else 1.

### Files

- `scripts/promote.ts` (NEW, ~80 lines)
- `scripts/__tests__/promote.test.ts` (NEW, 4 tests)
- `.claude/skills/promote/SKILL.md` (NEW)
- `package.json` — `"promote": "tsx scripts/promote.ts"`

### Tests (TDD red-first)

1. file with all checks pass → frontmatter flipped, `published_at` set
2. file with `tags: []` → exit 1, no flip
3. file with `draft: false` already → no-op, log, exit 0
4. `--dry-run` → no file writes, prints intended changes

Audit-fail test deferred — `bun run audit` runs against entire `src/`, not per-file. The `audit` integration test is just "if audit's exit code is non-zero, promote bails." Mock audit invocation in test.

## Skill 2: `/prompts` (radically slim)

### Architecture: STYLE / CONTRACT split

Each existing prompt TS file gets refactored:

```typescript
// src/lib/llm/prompts/post-synth.ts (after refactor)

/** USER-EDITABLE: voice, style, banned phrases, length budget. */
export const POST_SYNTH_STYLE = `You are an editorial synthesizer. Long-form
post (800-1500 words) drawing on N source notes.

Style rules:
- Concise, editorial voice. No "in conclusion", "furthermore", ...
- Mix one-sentence paragraphs with 2-3 sentence runs.
- Be opinionated where sources support it.`

/** TS-LOCKED: output JSON contract aligned to postSynthSchema. NEVER edit via prompts/. */
const POST_SYNTH_CONTRACT = `Return ONLY a JSON object with this exact structure (no markdown fences, no prose):
{
  "title": string,
  "lede": string,
  "sections": [{ "heading": string, "body": string }],
  "conclusion": string
}

Hard rules:
- 2-8 sections; every section body MUST cite a source via [[<slug>|surface]].
- Output ONLY the JSON object.`

export function buildPostSynthPrompt(topic, sources): ChatMessage[] {
  const style = loadStyleBlock('post-synth')  // reads prompts/post-synth.md if present
  const system = `${style}\n\n${POST_SYNTH_CONTRACT}`
  // ... user content as before
}
```

Same split for `ingest-enrich.ts` and `concept-naming.ts`. Skip `entity-extract.ts` (build-index internal; user doesn't tune voice for structured data extraction).

### Override mechanism

`prompts/<use>.md` at repo root:
- `prompts/post-synth.md`
- `prompts/ingest-enrich.md`
- `prompts/concept-naming.md`

Each is plain markdown — no required frontmatter, no nesting:

```markdown
You are an editorial synthesizer with academic rigor...

Style rules:
- Cite every claim via [[slug|surface]].
- Use formal voice. No first-person.
- ...
```

Loader reads file body (entire content excluding any optional frontmatter).
Falls back to TS `STYLE` constant when file missing.

**No subcommand for invocation: there's a single override per use.** No
`--preset` flag on `ingest-raw`/`draft-post`. The override is global.

### `/prompts` subcommands (only 3)

```bash
bun run prompts list       # table: use, override status, override file path
bun run prompts show <use> # print STYLE block (resolved: override or TS default), then CONTRACT
bun run prompts validate   # check each override file parses; dry-run loadStyleBlock for all uses
```

### Files

- `prompts/.gitkeep` (initial empty dir; user adds override files manually)
- `src/lib/llm/prompts/loader.ts` (NEW, ~30 lines)
- `src/lib/llm/prompts/__tests__/loader.test.ts` (NEW, ~6 tests)
- `src/lib/llm/prompts/post-synth.ts` (UPDATE — STYLE/CONTRACT split + loader)
- `src/lib/llm/prompts/ingest-enrich.ts` (UPDATE — same)
- `src/lib/llm/prompts/concept-naming.ts` (UPDATE — same)
- `src/lib/llm/prompts/__tests__/post-synth.test.ts` (UPDATE — add round-trip test)
- `src/lib/llm/prompts/__tests__/ingest-enrich.test.ts` (UPDATE — add round-trip test)
- `src/lib/rag/__tests__/concepts.test.ts` (UPDATE — verify nameCommunity uses loader)
- `scripts/prompts.ts` (NEW, ~80 lines: 3 subcommand dispatcher)
- `scripts/__tests__/prompts.test.ts` (NEW, ~5 tests)
- `.claude/skills/prompts/SKILL.md` (NEW)
- `package.json` — `"prompts": "tsx scripts/prompts.ts"`

### Tests

Loader:
1. No override file → returns TS default
2. Override file present → returns its body
3. Override file empty → returns TS default (graceful)
4. Override file with frontmatter → strips frontmatter, returns body only

post-synth/ingest-enrich:
5. `buildXPrompt` without override → identical to pre-refactor (golden, mocked)
6. `buildXPrompt` with `prompts/<use>.md` present → system message contains override body

prompts CLI:
7. `list` enumerates all 3 uses + shows override status
8. `show <use>` prints STYLE then CONTRACT
9. `show invalid-use` → exit 1 with usage hint
10. `validate` returns success when no overrides exist
11. `validate` catches malformed overrides (e.g., empty file when override exists)

## Risks (consolidated, slimmed)

| # | Risk | Mitigation |
|---|------|-----------|
| 1 | User edits override and breaks output (e.g., asks LLM to omit JSON fields) | CONTRACT block always appended, TS-owned. Output Zod still rejects malformed; existing 1-retry mechanism handles transients |
| 2 | Path traversal in `/promote <path>` | Slugified inputs reject `..`; fs operations stay within `content/notes/` and `content/posts/` |
| 3 | `/promote` on file modified mid-flip | Atomic write via `.tmp` + rename (matches ingest-raw pattern) |
| 4 | Override file accidentally committed empty | `prompts validate` flags it; defensive: empty body falls back to TS default silently |

## Out of scope (defer to v4)

- Multiple presets per use / `--preset <name>` flag (Opus: "defer until user has 2+ alternatives")
- `prompts new` scaffolder (user creates `.md` manually)
- `prompts diff` (use `git diff prompts/`)
- `extends: parent` inheritance
- OG image auto-gen in `/promote`
- Per-promote checklist on wikilink count (defer; may surface in v4 audit)
- Multi-locale prompts (KOR vs ENG voice)
- A/B eval framework
- Round-trip TS→md export

## Acceptance

End-to-end:

1. `bun run prompts list` — shows 3 uses (post-synth, ingest-enrich, concept-naming), all "TS default".
2. Create `prompts/post-synth.md` with academic-style instructions.
3. `bun run prompts list` — post-synth row updates to "override".
4. `bun run prompts show post-synth` — prints override + CONTRACT block.
5. `bun run prompts validate` — green.
6. `bun run draft-post --title "X" --notes a,b` (mocked in tests; ~$0.05 in real use) → uses override style.
7. `bun run promote content/notes/<slug>.md` → flips draft, sets published_at, refreshes graph.

CI must stay green (Phase 2 baseline minus pre-existing l3-visibility race).

## Sequencing — direct implementation (no subagents)

Previous Sonnet subagent dispatches hit rate limits. Direct implementation
order:

1. **Loader + STYLE/CONTRACT refactor** (foundational; required by /prompts)
2. **`/prompts` CLI + SKILL.md**
3. **`/promote` script + SKILL.md** (independent of /prompts)
4. **Tests for all** (red-first or paired)
5. **package.json scripts**
6. **QA: vitest, astro check, audit, build:fixture, smoke for /promote**
7. **PR + self-merge**

Total estimated files: ~12 (was ~17 in original plan).
