---
title: Trailing Space Test
tags: [journal]
---

This note links to another note with trailing spaces inside the wikilink brackets.

Link with leading space: [[ spaced-target ]] — should resolve to the note with slug `spaced-target`.

Link with trailing space: [[spaced-target ]] — also resolves after right-trim.

Link with both: [[ spaced-target ]] — resolves after both-trim.

All three forms above should produce a row in the `wikilinks` table with `target_raw = 'spaced-target'` and a non-null `target_id`.
