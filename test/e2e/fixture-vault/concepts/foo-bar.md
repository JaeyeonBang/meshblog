---
title: Foo Bar
tags: [concept]
---

This note is the target of a case-collision wikilink test: `[[foo-bar]]` and `[[Foo-Bar]]` both resolve here.

The build pipeline normalises targets by lowercasing before slug-map lookup, so `foo-bar` and `Foo-Bar` are treated identically regardless of original casing. On case-insensitive filesystems (Windows NTFS, macOS HFS+) duplicate filenames cannot exist; on Linux ext4 they can coexist but the resolver picks the first inserted.

## Practical implication

Authors should not rely on case distinctions in note filenames if they want portability across operating systems.
