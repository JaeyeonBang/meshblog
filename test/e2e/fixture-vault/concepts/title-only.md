---
title: Title Only Note
---

This note has only a `title` field and no other frontmatter. It tests that the build pipeline does not require optional fields like `tags`, `draft`, `aliases`, or `level_pin` to be present.

The pipeline must treat their absence as equivalent to sensible defaults: empty tags array, `draft: false`, no aliases, no level override.
