---
title: Table with Wikilinks
tags: [concept]
---

This note mixes a Markdown table with wikilinks inside cells.

| Concept | See Also |
|---|---|
| Plain links | [[plain-wikilink-target]] |
| Aliased links | [[aliased-note|the alias form]] |
| Unicode | [[한글-노트]] |
| Missing | [[does-not-exist-either]] |

Tables with wikilinks are common in Obsidian reference sheets. The pipeline's wikilink regex operates on the raw content string, so it finds links inside table cells as well as in prose paragraphs.
