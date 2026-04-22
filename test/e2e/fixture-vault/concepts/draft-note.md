---
title: Draft Note (must be excluded)
draft: true
tags: [draft]
---

This note is marked `draft: true` and must NOT appear in the `notes` table after `runBuildIndex` runs.

The build pipeline's skip logic is in `build-index.ts` at the frontmatter check: `if (fm.public === false || fm.draft === true)`.

If this note appears in the DB, the draft-exclusion test will fail.
