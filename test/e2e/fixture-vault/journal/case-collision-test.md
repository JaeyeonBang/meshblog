---
title: Case Collision Test
tags: [journal]
---

This note tests case-insensitive wikilink resolution.

Link with lowercase: [[foo-bar]] — should resolve to `foo-bar`.

Link with mixed case: [[Foo-Bar]] — should also resolve to `foo-bar` after lowercasing.

Both links produce a `wikilinks` row. The `target_raw` column stores the lowercased form; the `target_id` points to whichever note with slug `foo-bar` the pipeline ingested.

## Note on the filesystem

On Windows (NTFS) and macOS (HFS+), only one `foo-bar.md` can exist regardless of filename casing. On Linux (ext4), both `foo-bar.md` and `Foo-Bar.md` can coexist. The test fixture uses only `foo-bar.md` to avoid filesystem-specific test failures.
