---
title: Multi-Link Paragraph
tags: [concept]
---

This note has a paragraph with three or more wikilinks in a single sentence: see [[plain-wikilink-target]], [[aliased-note|the aliased one]], and [[spaced-target]] for the core cases.

Multi-link parsing is an important correctness check because a naive regex with `lastIndex` bugs can skip matches after the first resolved link.

## Additional links

- Concepts directory: [[cross-dir-concept]]
- Journal side: [[daily-review-2024-01-15]]
- Missing target for completeness: [[does-not-exist]]

Each link above should be independently parsed and resolved (or marked missing) without interfering with adjacent links.
