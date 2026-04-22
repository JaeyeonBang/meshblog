---
title: Project Log — meshblog
tags: [journal, project]
---

## 2024-01-10

Forked the meshblog template and started configuring the vault path. The `/init` skill asked for the vault absolute path and the GitHub repository name, then opened `http://localhost:4321/meshblog/` automatically.

## 2024-01-12

First wikilink resolution working end-to-end. `[[plain-wikilink-target]]` now renders as an anchor. Previously it was being stripped by the old `strip-wikilinks.ts` shim.

## 2024-01-14

Found the trailing-space bug: `[[ spaced-target ]]` was rendering as a missing-span because the resolver was not trimming the raw target. Fixed in `resolve-wikilinks.ts` by calling `.trim()` on `rawTarget`. The [[spaced-target]] note covers this.

## 2024-01-15

Cross-directory links now working. Updated `runBuildIndex` to accept a `baseDirs` array. See [[cross-dir-concept]] and [[daily-review-2024-01-15]].

## 2024-01-20

Added unicode support. Korean filenames like [[한글-노트]] and emoji filenames like [[émoji-🚀]] now survive the full pipeline without encoding errors.

## 2024-01-22

Draft exclusion verified. [[draft-note]] is excluded at the `build-index` stage; no row appears in the `notes` table. Same for [[private-note]] with `public: false`.
