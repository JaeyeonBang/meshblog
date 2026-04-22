---
title: Obsidian Setup Guide
tags: [journal, guide]
---

A practical guide to setting up an Obsidian vault that works well with the meshblog pipeline.

## Vault structure

Organise notes into at least two directories:

- `concepts/` — evergreen notes on topics, ideas, and frameworks. These are the nodes in your knowledge graph.
- `journal/` — time-stamped entries: daily reviews, project logs, reading notes.

This mirrors the fixture vault layout in `test/e2e/fixture-vault/`.

## Frontmatter conventions

Every note should have at minimum:

```yaml
---
title: Your Note Title
tags: [tag1, tag2]
---
```

Optional fields:

- `draft: true` — exclude from the public build.
- `public: false` — alternative exclusion flag.
- `aliases: [alt-name]` — alternate names for the note (v2 resolution).
- `level_pin: 1` — force the note into the L1 graph tier.

## Linking conventions

Use exact slug or title when linking:

- `[[plain-wikilink-target]]` — links by slug (filename stem).
- `[[Plain Wikilink Target]]` — links by title (case-insensitive).
- `[[plain-wikilink-target|See here]]` — aliased link with custom display text.

Avoid: spaces inside brackets (`[[ foo ]]` is valid but non-idiomatic). The pipeline handles it, but it signals a copy-paste error.
