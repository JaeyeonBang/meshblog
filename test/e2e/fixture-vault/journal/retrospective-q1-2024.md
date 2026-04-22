---
title: Q1 2024 Retrospective
tags: [journal, retrospective]
---

## What shipped

- Wikilink resolution pipeline: handles all edge cases from [[trailing-space-test]], [[unicode-link-test]], [[case-collision-test]], and [[missing-target-demo]].
- Fixture vault: 30+ notes covering every shape the pipeline must handle.
- Draft safety net: [[draft-note]] and [[private-note]] are reliably excluded.

## What didn't ship

- Frontmatter alias resolution (v2 scope). The [[alias-source]] note documents the current v1 behaviour.
- Real-time vault sync without a full rebuild.

## Key decision: flat `discoverMarkdown`

The `discoverMarkdown` function is intentionally non-recursive: it reads one directory level. Subdirectory support is achieved by passing multiple `baseDirs` entries. This keeps the discovery logic simple and makes the directory structure explicit in the pipeline configuration.

## Carry-forward to Q2

- Add the emoji-filename round-trip test end-to-end (currently parse-level only).
- Investigate alias resolution cost/benefit for v2.
- Write the cross-directory backlinks integration test.
