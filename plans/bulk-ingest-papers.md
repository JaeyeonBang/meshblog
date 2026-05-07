# Plan — Bulk-ingest the tunix paper notes

## Context

`raw/부스트캠프/tunix/논문/` holds 16 Notion-export `.md` files describing reasoning-evaluation datasets and one summary "rl" note. `tunix/dataset/` is verified-identical (same hash IDs, `diff` returns empty), so we only walk one folder.

Each file is small — mostly 200-1000 bytes, a few short paragraphs. They are dataset descriptions (GSM8K, gpqa, multi_news, sciq, code_contests, etc.), one role-distribution analysis (`rl`), and a few "TeichAI claude-haiku-... reasoning-1700x" / "TeichAI gemini-... reasoning-1000x" benchmark notes.

This is the third dogfood pass on the Phase 1+2+3 pipeline (after the manual single-file run for ODQA). The new value here is **batch behavior at N=16** plus **cross-graph linking** with the 12 existing posts.

## Goals

1. Bulk-ingest all 16 papers via `/ingest-raw`.
2. Surface real-world failure modes the prior single-file dogfood couldn't:
   - LLM picking duplicate titles for similar topics (`TeichAI claude-haiku...` vs `TeichAI gemini-...`).
   - Tag overfitting on tiny inputs.
   - Korean-mixed slug edge cases (`sft(증류)`, `데이터셋`, `rl`).
3. Measure **cross-link rate**: how many of the 16 new notes have at least one auto-link pointing to one of the existing post slugs (`09-ppo`, `10-deepseek-math`, `11-rlpr`, `04-agentic-llms-survey-reasoning`, etc.). This is the headline metric — without cross-links the new notes are isolated islands.
4. Promote the subset that passes review; ship the rest as drafts (still ignored by `build-index`).

## Steps

### 1. Pre-flight (no LLM cost)
- `bun run ingest-raw raw/부스트캠프/tunix/논문 --estimate --no-refresh` — token volume + per-file size.
- Confirm vocab includes the existing post slugs: `node -e ...` against `.data/index.db`.

### 2. Live batch ingest
- `bun run ingest-raw raw/부스트캠프/tunix/논문 --no-refresh`.
- Capture the summary section: `written: N / skipped: M (K slug collisions)`.
- For each collision, decide whether to re-run with `--title "..."` or skip. (Per `polish` PR #103, collisions print a dedicated section.)

### 3. Quality + cross-link audit
- Sample 5 generated notes (mix of dataset / benchmark / summary): tag quality, body cleanliness, auto-link accuracy.
- Count `[[<existing-post-slug>|...]]` occurrences across all new notes. Target: ≥ 5 of 16 cross-link to an existing post.
- Surface any obviously-wrong auto-links (e.g. semantically-unrelated targets from the fixture-stub vocab).

### 4. Selective promote
- Promote only notes that pass quality bar (frontmatter clean, body coherent, tags non-generic).
- `bun run promote content/notes/<slug>.md ...` (multi-path from PR #103 lets us batch by argument).
- `bun run build-index --skip-embed` to register.

### 5. Decide whether to also synthesize a post
- If 3+ promoted notes share a coherent theme (e.g. "reasoning benchmark survey"), run `/draft-post` to produce a post citing them. Optional — only if material is there.

### 6. Ship
- Commit promoted notes (and post if generated). PII is unlikely in dataset descriptions, but verify before commit.
- PR + watch deploy. Confirm new notes visible at `/notes/<slug>/` and graph picks them up.

## Acceptance gates

1. ≥ 12 of 16 files successfully ingested (75% — accounts for slug collisions on near-duplicate titles).
2. ≥ 5 of 16 notes contain at least one auto-link to an existing post slug (cross-graph value).
3. Zero notes contain LLM-hallucinated facts not in source (spot-check ≥ 5).
4. Audit clean, fixture build green, deploy 200 OK on the new note routes.

## Risks + mitigations

| Risk | Mitigation |
|---|---|
| All 16 produce variants of "Reasoning Dataset" → 14 collisions | First batch run is observational; per-collision retry with `--title` is cheap (one call each). Worst case: 2-4 manual retries. |
| Tag overfitting on tiny inputs (e.g. 5 generic tags per dataset) | Spot-check during step 3, prune via `prompts` skill if systematic. |
| Auto-link picks fixture stubs (`fixture-rag-overview`) over real posts | Already observed in earlier dogfood. The vocab query in `loadEntityVocab` ranks by `mention_count`; 12 numbered posts have high counts vs fixture-* with 1-2 each. Should naturally outrank. If it doesn't: filter fixtures from vocab in a follow-up PR. |
| `sft(증류)` slug becomes `sft` losing the Korean signifier | Acceptable — the body retains "증류 (distillation)" context. |
| Cost runaway on a stuck call | Each `claude -p` has internal timeout; we have retry-with-backoff. 16 calls × ~10s = ~3 min wall, $0 marginal on subscription. |

## Out of scope

- Tuning the auto-link algorithm (covered by Phase 2 already; iterate only if step 3 reveals systemic issues).
- Refactoring `loadEntityVocab` to filter fixture stubs (defer to a follow-up if cross-link rate is < 5).
- Translating Korean dataset descriptions to English (the harness is bilingual-aware via `new-bilingual-post`; not in scope here).

## Verification before reporting complete

1. ✅ Step 2 output captured (written count + collision summary).
2. ✅ Cross-link rate computed and reported as a single number.
3. ✅ At least one promoted note appears at the live URL after merge.
4. ✅ All committed notes audited for PII (dataset descriptions are public, but row-level retro-style content shouldn't sneak in).

---

## Revisions after Opus outside-voice review

The original plan was over-structured for the actual work. Adopting the following changes before execution.

### Acceptance gate #2 → expected-bridge checklist (replaces "≥ 5 of 16")

Pre-written before the run so the goalposts can't shift after:

| New note source | Plausible existing-post target |
|---|---|
| `GSM8K` | `10-deepseek-math` |
| `Idavidrein gpqa` | `04-agentic-llms-survey-reasoning` |
| `TeichAI claude-haiku-4 5-high-reasoning-1700x` | `04-agentic-llms-survey-reasoning` |
| `TeichAI gemini-3-pro-preview-high-reasoning-1000x` | `04-agentic-llms-survey-reasoning` |
| `TuringEnterprises Turing-Open-Reasoning` | `04-agentic-llms-survey-reasoning`, `11-rlpr` |
| `nvidia Nemotron-Math-v2` | `10-deepseek-math` |
| `math-ai TemplateGSM` | `10-deepseek-math` |
| `math-ai olympiadbench` | `10-deepseek-math`, `04-agentic-llms-survey-reasoning` |
| `rl` (role-distribution note) | `01-deep-rl-from-human-preferences`, `09-ppo`, `11-rlpr` |

9 files have plausible bridges. Success = ≥ 6 of those 9 actually fire (66%, leaves room for vocab-stub mismatch).

The other 7 (`multi_news`, `sciq`, `code_contests`, `qmsum-cleaned`, `writingprompts`, `데이터셋`, `sft(증류)`) have no expected bridge — zero auto-links there is fine.

### Kill-switch
- Wrap the batch run in `timeout 1200 bun run ingest-raw ...` (20 min hard cap; healthy run is ~3 min).
- If the wall clock passes 5 min with no progress in stdout, abort and rerun the batch in two halves manually.

### PII grep (concrete, not hand-waved)
Before commit:
```
rg -n '(@\w+\.(com|net)|010-\d{4}-?\d{4}|[가-힣]{2,4}\s*(님|씨|연구원|매니저|TL|PM|팀장))' content/notes/<new files>
```
Block commit if any hit. Mirrors the ODQA team-table redaction lesson.

### Step 5 (synthesize a post) — DROPPED
"3+ notes share a theme" is a vibes check. Out of scope for this dogfood; revisit as a separate decision after the notes land.

### Step 4 — drop redundant `build-index --skip-embed`
`/promote` already invokes `bun run refresh` which runs build-index. No need to call it again.

### Hallucination defense (added to step 3)
For the 5 spot-checked notes: read source vs generated body side-by-side. Flag any factual claim in the body that isn't traceable to the source. Source files are 200-1000 bytes; this check is fast.

### Out of scope (re-confirmed)
Filtering fixture stubs from `loadEntityVocab` — only address if step 3 reveals systemic wrong-target auto-links to `fixture-*` slugs.

### Step 0 (added — discovered during pre-flight)

Direct DB query reveals the 12 numbered posts have **zero entity rows**: only the 5 fixture posts hold entities (15 total, all from `test/fixtures/seed.sql`). This is because past local runs used `build-index --skip-embed` and didn't re-extract entities for already-hashed notes.

Without this seeding, `loadEntityVocab` returns only fixture targets, so every auto-link in the new notes would point to `fixture-*` slugs — making the cross-link acceptance gate impossible to clear.

Pre-step (one-time):
```
bun run build-index --force   # re-extract entities for all 17 notes via claude CLI
```
Cost: 17 calls × ~10s = ~3 min wall, $0 marginal.

This belongs to this plan because the bulk-ingest goal (cross-graph value) literally cannot succeed without it. Treating it as out-of-scope would have produced a false-negative dogfood result.
