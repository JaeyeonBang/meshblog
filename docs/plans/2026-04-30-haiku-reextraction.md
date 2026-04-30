# 2026-04-30 — Haiku re-extraction (Plan B)

## Why

Per-post concept graphs are sparse because the entity extraction model
(`openai/gpt-4o-mini`) returns very few entities per note (cap 10, prompt
asking for "at most 10"). With ~3 entities/post on average and Louvain
clustering on a 12-post corpus, each post's entity set typically falls
inside a single concept, so the per-post graph collapses to one node.

PR #84 fixed the concept↔concept edge synthesis (1 → 3 inter-concept edges
globally), but only 1 of 6 sampled posts now shows the toggle (`08-lora`).

The remaining gap is **upstream** — entity extraction quality. Switching the
extraction model to **Haiku 4.5** (Anthropic) and loosening the per-note
caps should give richer entity coverage, which in turn means more posts
mention multiple concepts, which gives more co-occurrence edges.

## Acceptance criteria

After CI deploys with the new pipeline:

1. Median entities-per-post ≥ 8 (currently ≈ 3).
2. Median concepts-per-post ≥ 2 (currently ≈ 1).
3. ≥ 4 of the 6 currently-degenerate posts show the concept-toggle:
   `11-rlpr`, `12-transformer`, `10-deepseek-math`, `09-ppo`, `08-lora`,
   `07-agentic-llms-survey-interacting`.
4. Health score holds or improves (no console errors, no 4xx links).
5. Build cost stays under $1 per full re-extract (12 posts × Haiku 4.5).

## Scope (in)

1. **Model swap** — `src/lib/rag/graph.ts:69`: `openai/gpt-4o-mini` →
   `anthropic/claude-haiku-4-5`.
2. **Cap loosening** — `src/lib/rag/graph.ts` schema: `.max(10)` →
   `.max(25)` for both `entities` and `relationships`.
3. **Prompt tweak** — `src/lib/llm/prompts/entity-extract.ts`: change
   "at most 10" → "up to 25, prefer richer coverage". Slice cap 8000 →
   16000 chars (Haiku context is generous; richer signal = better extraction).
4. **maxTokens bump** — `src/lib/rag/graph.ts:71`: 1500 → 3000.
5. **Skill `/re-extract`** — `.claude/skills/re-extract/SKILL.md` that:
   - Verifies `OPENROUTER_API_KEY` is set.
   - Wipes `note_entities`, `entities`, `concepts`, `concept_entities`.
   - Runs `bun run build-index` (forces re-extraction since rows are gone).
   - Runs `bun run cluster-communities`.
   - Runs `bun run export-graph`.
   - Prints before/after stats: entities/post median, concepts/post median,
     concept-l3 inter-concept edge count.
   - Optionally pushes via `/ship`.
6. **CI confirmation** — verify next deploy (auto on merge) hits criterion 3.

## Scope (out)

- Don't touch embedding generation (`OPENAI_API_KEY` still used for
  `text-embedding-3-small`; that's orthogonal and works).
- Don't change the Louvain `minEntities=5` floor in `clusterEntities`.
- Don't add a per-post LLM-named concept naming step (separate v2 task).
- Don't widen scope to Q&A regeneration (keeps Claude CLI dependency out).

## Eng-review revisions (2026-04-30)

Applied:
- **P0 fix** — `scripts/build-index.ts` gets `--force` flag. The skill's "delete entity rows" alone doesn't trigger re-extraction because `build-index.ts:262-267` skips on `content_hash` match. `--force` bypasses that gate.
- **P1 fix** — Model name moves to env var: `process.env.MESHBLOG_LLM_MODEL ?? "anthropic/claude-haiku-4-5"`.
- **P2 fix** — `scripts/concept-stats.ts` gets a real implementation (printed below).
- **Tests added** — extraction-schema (cap 25), entity-extract prompt, build-index --force.
- **Critical gap** — defensive JSON parse in `extractEntities` (handle prose-prefix Haiku output).

## Implementation steps

### Step 1 — model + caps swap

`src/lib/rag/graph.ts`:

```diff
 const entitySchema = z.object({
   name: z.string().min(1),
   type: z.enum(ENTITY_TYPES).catch("other"),
   description: z.string().default(""),
 })

 export const extractionResultSchema = z.object({
-  entities: z.array(entitySchema).max(10).default([]),
+  entities: z.array(entitySchema).max(25).default([]),
   relationships: z.array(z.object({
     source: z.string().min(1),
     target: z.string().min(1),
     relationship: z.string().min(1),
-  })).max(10).default([]),
+  })).max(25).default([]),
 })
```

```diff
       const response = await callOpenRouter({
         messages,
-        model: "openai/gpt-4o-mini",
-        maxTokens: 1500,
+        model: "anthropic/claude-haiku-4-5",
+        maxTokens: 3000,
         temperature: 0.3,
       })
```

`src/lib/llm/prompts/entity-extract.ts`:

```diff
- Return at most 10 entities and 10 relationships
+ Return up to 25 entities and 25 relationships. Prefer richer coverage —
+ extract every distinct technical concept, person, paper, model, and method
+ mentioned, even if they appear once.
```

```diff
   const cleaned = noteContent
     .replace(/<[^>]*>/g, "")
     .replace(/\s+/g, " ")
     .trim()
-    .slice(0, 8000)
+    .slice(0, 16000)
```

### Step 2 — `/re-extract` skill

`.claude/skills/re-extract/SKILL.md`:

```markdown
# /re-extract

Re-run entity extraction across all notes using the current LLM model
(`anthropic/claude-haiku-4-5`). Use when concept graphs look sparse, after
changing the extraction prompt/model, or after adding many notes.

## Preflight
- Ensure `OPENROUTER_API_KEY` is exported (`echo $OPENROUTER_API_KEY | head -c 8`).
- Confirm clean working tree (`git status` empty or stashed).
- Capture baseline: `bun run scripts/concept-stats.ts` (writes JSON snapshot).

## Run
1. `node -e "
     const D=require('better-sqlite3');
     const db=new D('.data/index.db');
     for (const t of ['note_entities','entities','concepts','concept_entities']) {
       db.prepare('DELETE FROM '+t).run();
     }
     console.log('cleared.');
   "`
2. `bun run build-index`            # re-extracts entities
3. `bun run cluster-communities`    # re-derives concepts
4. `bun run export-graph`           # re-exports JSON
5. `bun run scripts/concept-stats.ts` and diff against baseline.

## Verify
- Median entities/post ≥ 8.
- Median concepts/post ≥ 2.
- `public/graph/concept-l3.json` inter-concept edge count > 5.

## Ship
- `bun run build:fixture` (sanity); `bunx vitest run scripts/__tests__/`.
- `git add public/graph .data/index.db.bak`? — NO. Graph JSON is built by
  CI; only commit source/skill changes.
- Push branch, open PR with before/after stats in description.
```

`scripts/concept-stats.ts` (new file, ~30 lines): reads SQLite, prints
median entities/post, median concepts/post, total inter-concept edges.

### Step 3 — verify

After merge, follow the same per-post curl loop from PR #84 verification.
Expect ≥ 4 toggles where there were 0.

## Risks

| Risk | Mitigation |
| :--- | :--- |
| Haiku output ≠ JSON-strict (extra prose) | Existing `replace(/^```json?\n?/m, "")` already strips fences; reproduce locally before push. |
| 25-entity cap floods Louvain → 30+ concepts (noise) | Louvain has `minEntities=5` floor (clusterEntities). If too noisy, raise to 8. |
| OpenRouter rate-limits on 12 parallel calls | Script processes notes sequentially (line `for (let i = 0; i < files.length; i++)`); already safe. |
| Cost overrun | Haiku 4.5 ≈ $1/MTok in, $5/MTok out. 12 posts × ~5KB × 25 entities ≈ ~$0.10. Budget $1. |
| Live deploy degenerate again if extraction fails | CI already falls back to fixture mode if API key missing. Hard failure on JSON parse aborts the deploy step (good — won't ship broken graph). |

## Test plan

- [ ] Unit: existing `scripts/__tests__/export-graph.test.ts` still green.
- [ ] Unit: existing `src/lib/rag/__tests__/graph.test.ts` (mocked LLM) still green.
- [ ] Integration: local re-extract on `.data/index.db` (fixture) shows
      median entities/post ≥ 8 and ≥ 2 concepts on at least one fixture note.
- [ ] Manual: skill `/re-extract` runs end-to-end without prompts.
- [ ] Live: post-deploy curl loop shows toggle on ≥ 4/6 sampled posts.

## Rollback

Single revert commit on `src/lib/rag/graph.ts` + `entity-extract.ts` brings
the pipeline back to gpt-4o-mini. The graph rebuilds on next deploy.
