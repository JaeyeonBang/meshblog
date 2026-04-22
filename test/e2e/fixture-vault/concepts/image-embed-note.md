---
title: Image Embed Note
tags: [concept]
---

This note tests image-embed wikilink syntax.

Here is a plain image embed: ![[hero.png]]

And here is one with alt-text pipe syntax: ![[diagrams/flow.svg|Flow diagram]]

Image embeds must be converted to standard Markdown `![alt](src)` form during preprocessing and must not be treated as regular wikilinks that go into the `wikilinks` table.

## Notes on the placeholder files

The `hero.png` and `diagrams/flow.svg` files in this fixture are zero-byte placeholders. This is a parse-level test — the renderer is not invoked, so file existence matters only for the filesystem check, not for pixel content.
