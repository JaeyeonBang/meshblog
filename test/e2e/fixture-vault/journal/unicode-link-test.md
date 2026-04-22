---
title: Unicode Link Test
tags: [journal]
---

This note links to unicode-filename notes to test end-to-end unicode handling.

Korean target: [[한글-노트]]

Emoji target: [[émoji-🚀]]

Both should produce resolved wikilink rows in the `wikilinks` table (`target_id IS NOT NULL`), assuming the pipeline correctly preserves unicode in slug lookups.

## Why unicode matters

The web is global. An Obsidian user in Seoul writing Korean notes should be able to publish them through meshblog with working backlinks, just like an English-language user.
