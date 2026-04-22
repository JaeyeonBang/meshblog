---
title: Missing Target Demo
tags: [journal]
---

This note deliberately links to a note that does not exist: [[this-note-does-not-exist]].

The link above should produce a `<span class="wikilink wikilink--missing">` element in the rendered HTML. In the backlinks database, it should produce a row with `target_id = NULL`.

A second missing target: [[another-ghost-note]].

Missing-target handling is important for Obsidian vaults in progress. Authors often write `[[future-note]]` as a placeholder while planning, before the actual note exists.

## What should happen

- The pipeline should not crash.
- The build should complete successfully.
- The `wikilinks` table should have rows for both missing links with `target_id = NULL`.
- The rendered HTML should show the missing-span form with the tooltip.
