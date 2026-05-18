---
name: suggest-links
description: Propose wikilink and related-frontmatter additions for a draft post by comparing it against existing published posts in the index DB. Never modifies files — prints suggestions to stdout only. Triggers — "suggest links for this post", "what should I link here?", "find related posts for <draft>".
---

# /suggest-links

Read a draft markdown file, compare it against all published posts in `.data/index.db`, and have the LLM propose two kinds of connections:

- **wikilink** — insert `[[slug|surface]]` at a specific sentence in the body
- **related** — add `slug` to the `related:` frontmatter array (thematically adjacent, not directly cited)

The skill prints suggestions to stdout and never modifies any file.

## What it does

1. Parse the target `.md` file — frontmatter title/tags + body.
2. Load all published posts from `.data/index.db` where `folder_path = 'content/posts'`, excluding the target itself. Each candidate is represented by its slug, title, tags, and a 500-char excerpt.
3. Build an LLM prompt (`claude -p`) that instructs the model to prefer `wikilink` only when a topic is directly mentioned in a specific sentence, and `related` for adjacent topics not cited inline.
4. Validate the response with Zod (`suggestionsArraySchema`). Reject suggestions whose `target_slug` isn't in the DB.
5. Print formatted suggestions (or `--json` for machine output). Retry once on validation failure.

## Run

```bash
bun run suggest-links content/posts/my-draft.md

# Flags
--json       Machine-readable JSON array output
--limit=N    Cap suggestions at N (default 8)
```

## Output format (pretty)

```
[suggest-links] 2 suggestion(s) for content/posts/my-draft.md

  WIKILINK  [[09-ppo|PPO]]
  Anchor:   PPO의 clipping은 정책 변화를 제어한다.
  Why:      Body directly discusses PPO clipping, which 09-ppo explains in depth.

  RELATED   11-rlpr
  Why:      Adjacent reward-free RL topic; useful context for the reader.

  (1 wikilink, 1 related)
```

## Output format (--json)

```json
[
  {
    "type": "wikilink",
    "target_slug": "09-ppo",
    "surface": "PPO",
    "rationale": "...",
    "anchor": "PPO의 clipping은..."
  },
  {
    "type": "related",
    "target_slug": "11-rlpr",
    "rationale": "..."
  }
]
```

## Prerequisites

- `.data/index.db` must exist with at least one published post. Run `bun run build-index --skip-embed` (or full `bun run refresh`) first.
- Posts must be published (not `draft: true`) to appear as candidates. Run `/promote` on notes before using them as comparison targets.
- `claude` CLI must be available (`claude --version` to verify).

## What it will NOT do

- Modify the input file. Ever.
- Write to `content/posts/` or anywhere else on disk.
- Suggest slugs not present in `.data/index.db`.
- Fill a quota with low-confidence guesses — the prompt instructs the model to return fewer high-quality suggestions rather than padding.

## Cost

Each run makes one `claude -p` call (plus one retry on validation failure). On Claude Pro/Max the marginal monetary cost is zero. Wall time is ~10-30s depending on the number of candidates.

## Customising the inference rules

The system prompt style block is user-editable. Create `prompts/suggest-links.md` to override the style/inference rules. The JSON output contract is TS-locked and always appended, so overrides cannot break the schema.
