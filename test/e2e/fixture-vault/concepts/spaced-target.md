---
title: Spaced Target
tags: [concept]
---

This note exists so that `[[ spaced-target ]]` (with spaces inside the brackets) can be resolved after trimming.

It covers the mechanics of whitespace-tolerant wikilink parsing — a common Obsidian edge case where users accidentally add a leading or trailing space inside the double brackets.

## Why it matters

Obsidian trims the target before slug lookup. A compliant renderer must do the same; otherwise a valid link silently degrades to a broken-link span.
