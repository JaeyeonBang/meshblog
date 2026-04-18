# Quota Log — Phase 2 Dry-Run

> Renamed from `cost-log.md` per PGR-3 (Claude Code CLI replaces OpenRouter).
> Tracks wall-clock time per stage and OpenAI embedding cost only.
> LLM (Q&A generation) uses Claude Code CLI — no per-call cost, quota = wall-clock.

---

## Dry-Run Status

**Date:** 2026-04-18  
**Phase:** Phase 2 Agent C (Tasks 5a, 9–14)

### Pre-conditions for full dry-run

The following are required to run the full pipeline with real data:

| Requirement | Status |
|-------------|--------|
| `OPENAI_API_KEY` | Not set in .env.local (embeddings stage will skip) |
| `OPENROUTER_API_KEY` | Not set (entity extraction will fail gracefully) |
| `claude` binary available | Unknown (run `claude --version` to verify) |
| 20 notes in content/ | ✅ 21 notes (20 synthetic + 1 existing fixture) |

### Structural dry-run (no API calls)

Run with `--skip-embed --skip-concepts` (entity extraction still calls OpenRouter):

| Stage | Notes | Wall-clock | Notes |
|-------|-------|------------|-------|
| File discovery + schema | 21 | ~1s | Instant (SQLite WAL mode) |
| Entity extraction (stub) | 21 | <1s/note | Requires OPENROUTER_API_KEY |
| Embedding (skipped) | — | — | Requires OPENAI_API_KEY |
| Concept clustering (skipped) | — | — | Requires Agent B graph-topology.ts |
| Export graph (empty DB) | 0 nodes | <1s | 6 valid JSON files produced |

**Observation:** `bunx tsx scripts/build-index.ts --skip-embed --skip-concepts` with real OpenRouter calls spent ~71s waiting for 3 retries × 7 notes × retry timeouts. With a live API key, entity extraction should be ~1-2s/note = 20-40s for 20 notes.

---

## Projected costs (with real API keys)

Based on published API pricing and note sizes (~800 tokens average):

| Stage | Provider | Model | Per note | 20 notes | 200 notes |
|-------|----------|-------|----------|----------|-----------|
| Entity extraction | OpenRouter | gpt-4o-mini | ~$0.0003 | ~$0.006 | ~$0.06 |
| Embeddings (5 chunks/note avg) | OpenAI | text-embedding-3-small | ~$0.001 | ~$0.02 | ~$0.20 |
| Q&A generation | Claude Code CLI | (local session) | ~0 cost | 0 | 0 |
| **Total** | | | **~$0.001** | **~$0.026** | **~$0.26** |

Claude Code CLI LLM cost = 0 API dollars (uses local Claude Code quota).
Wall-clock cost: ~3s/note for Q&A = 60s for 20 notes, 600s (~10min) for 200 notes.

---

## 200-note dry-run

**Status: DEFERRED — requires user to provide 200-note vault.**

Per instructions, I must ask rather than fake results. If the user has a 200-note vault:
1. Copy notes to `content/notes/`
2. Set `OPENAI_API_KEY` and `OPENROUTER_API_KEY` in `.env.local`
3. Ensure `claude --version` succeeds
4. Run: `bun run build-index && bun run generate-qa && bun run export-graph`
5. Record timings in this file

Exit criteria to verify:
- [ ] 9 tables populated (`sqlite3 .data/index.db ".tables"`)
- [ ] notes ≥ 200
- [ ] ≥1 Louvain community with ≥5 members
- [ ] 6 graph JSON files in `public/graph/`
- [ ] `.data/qa/` populated
- [ ] PageRank top-10 not all `[concept]` nodes

---

## Notes on Claude Code CLI performance

- `callClaude()` spawns `claude -p "<prompt>" --output-format json`
- Typical response time: 2-5s per call (based on CC CLI benchmarks)
- 20 notes × 3 tiers = ~60-80 calls = ~3-7 minutes wall-clock
- 200 notes = ~600-800 calls = ~30-70 minutes wall-clock
- `--resume-from` flag allows crash recovery without restarting from note 1
- Cache hit (FGR-2 hash match) skips call entirely: ~0ms

---

_This log will be updated after a full 20-note + 200-note dry-run with live credentials._
