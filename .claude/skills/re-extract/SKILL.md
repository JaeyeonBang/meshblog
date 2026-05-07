---
name: re-extract
description: Wipe and re-run entity + concept extraction via the local `claude -p` CLI. Use when concept graphs look sparse, after changing the extraction prompt, or after a large content edit. Does NOT touch CI — this is for local validation.
---

# /re-extract

Force a full re-extraction of entities and concepts from `content/notes/`.
All LLM calls go through `claude -p` (your local Claude Code session), so
no API key is needed beyond `OPENAI_API_KEY` for embeddings.

## When to use

- Concept toggle disappears on most posts (per-post graph degenerate).
- Just changed `src/lib/rag/graph.ts` or `entity-extract.ts` prompt.
- Added many notes and want fresh clustering.
- Want to verify before/after stats locally before pushing.

## Preflight

```bash
which claude                  || { echo "claude CLI not installed (https://docs.anthropic.com/claude-code)"; exit 1; }
[ -n "$OPENAI_API_KEY" ]      || { echo "OPENAI_API_KEY not set (needed for embeddings)"; exit 1; }
git status --short            # confirm clean working tree (or stash first)
bun run scripts/concept-stats.ts > /tmp/concept-stats.before.txt
cat /tmp/concept-stats.before.txt
```

## Run

```bash
bun run build-index -- --force      # re-extract entities for every note (bypasses content_hash skip)
bun run cluster-communities         # re-derive concepts from refreshed entities
bun run export-graph                # rebuild public/graph/concept-l*.json
```

## Verify

```bash
bun run scripts/concept-stats.ts > /tmp/concept-stats.after.txt
diff /tmp/concept-stats.before.txt /tmp/concept-stats.after.txt
```

Acceptance:
- median entities / post ≥ 8 (was ~3 with gpt-4o-mini × cap 10)
- median concepts / post ≥ 2
- ≥ 4 of the 6 tracked posts show ✓ (concept count ≥ 2)
- inter-concept edge count > 5

## Ship

If stats improved:

```bash
bun run build:fixture                # sanity check; exit 0
bunx vitest run                      # all green
git checkout -b reextract-$(date +%Y%m%d)
# Note: do NOT commit .data/index.db or public/graph/*.json — CI regenerates
# them. Only commit source / prompt / skill changes.
git add src/ scripts/ .claude/skills/re-extract/
git commit -m "feat(graph): re-extract concepts with Haiku 4.5 — median entities X→Y"
gh pr create --fill
```

After merge, watch the deploy — CI re-extracts from scratch (no DB cached),
so the fresh model takes effect automatically.

## Rollback

If extraction quality regresses, the levers are:
- The prompt itself (`src/lib/llm/prompts/entity-extract.ts`) — revert via git
- The model your Claude Code session uses — switch model in Claude Code settings
  (the CLI honors whatever your active session has)
