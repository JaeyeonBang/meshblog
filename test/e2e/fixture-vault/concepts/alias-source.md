---
title: Alias Source Note
tags: [concept]
---

This note links to another note via one of its registered aliases: [[aliased-note|see here]].

The alias `an-alias` is declared in `aliased-note.md`'s frontmatter. However, alias-based resolution (looking up frontmatter `aliases` during wikilink lookup) is scoped to v2. The current v1 pipeline resolves by slug only.

For the v1 test, `[[aliased-note]]` (using the exact slug) must resolve; `[[an-alias]]` (using the frontmatter alias) will produce a missing-target span until v2.
