---
name: promote
description: Flip draft notes or posts to published with a checklist gate (frontmatter parses, tags non-empty, audit passes), set published_at, and trigger refresh so the graph picks up the new content. Triggers — "promote", "publish this note", "ship this draft", "publish drafts".
---

# /promote

Bookend for the `/ingest-raw` and `/draft-post` workflows. Drafts produced by those skills carry `draft: true` so they don't leak into production until reviewed. `/promote` is the deliberate gate that flips them.

## What it does

For each `.md` file under `content/notes/` or `content/posts/`:

1. **Parse frontmatter** (FAIL on parse error)
2. **Tags non-empty** (FAIL if `tags: []` or missing)
3. **`bun run audit` passes** (FAIL — whole-batch check, runs once)
4. If currently `draft: true`:
   - Set `draft: false`
   - Set `published_at: <today UTC>` (skipped if already set)
   - Atomic write (`.tmp` + rename)
5. After all files, run `bun run refresh` so the graph re-extracts entities + concepts.

Idempotent: re-running on an already-published file logs `SKIP` and exits 0 for that file.

## Run

```bash
# single file
bun run promote content/notes/some-paper.md

# directory (all .md files inside)
bun run promote content/notes/

# preview only
bun run promote content/notes/ --dry-run

# skip the post-promote refresh
bun run promote content/notes/x.md --no-refresh
```

## Why a script and not `sed`

A bare `sed -i 's/draft: true/draft: false/' file.md` would:
- Skip the tags check
- Skip the audit gate
- Not set `published_at`
- Leave the graph stale (no automatic refresh)
- Silently flip files whose frontmatter parsed wrong

The script handles each of those without mental overhead. Cost: zero — bash only, no LLM call.

## Why no OG image / wikilink count check (yet)

Phase 1 review proposed those as gates; Opus outer voice in the Phase 3 review cut them as feature creep for a 5-promotions-per-week operation. Add later if real friction shows up.

## Path safety

Refuses paths with `..` segments (rejection happens before any read or write). All operations stay inside the current working directory tree.
