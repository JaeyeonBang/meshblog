---
title: Private Note (must be excluded)
public: false
tags: [private]
---

This note is marked `public: false` and must NOT appear in the `notes` table after `runBuildIndex` runs.

The pipeline treats `public: false` as equivalent to `draft: true` for the purposes of build-time exclusion. Both fields are checked in a single condition.

If this note appears in the DB, the public-false exclusion test will fail.
