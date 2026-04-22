---
title: Emoji Rocket Note
tags: [concept]
---

This note has a unicode emoji filename: `[[émoji-🚀]]`.

Emoji in note slugs stress-test the wikilink resolver's unicode handling. The slug is passed through as-is; only ASCII uppercased letters are lowercased, leaving accented characters and emoji unchanged.

## Why emoji filenames exist in the wild

Some Obsidian users use emoji as visual anchors in their vault folder structure. The pipeline should not crash on these filenames even if the render result degrades gracefully.
