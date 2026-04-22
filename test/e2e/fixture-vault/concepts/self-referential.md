---
title: Self Referential Note
tags: [concept]
level_pin: 1
---

This note links to itself: see [[self-referential]] for more context.

A self-referential wikilink is an edge case that should not cause infinite loops or duplicate wikilink rows. The backlink resolver must detect that `source_id === target_id` and either include it or skip it consistently.

## Why self-links appear in real vaults

Authors sometimes add self-links as a stylistic flourish (e.g., in templates), or accidentally when refactoring note titles. The pipeline should handle them without crashing.
