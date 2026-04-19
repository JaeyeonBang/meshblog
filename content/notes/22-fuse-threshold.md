---
title: "Fuse.js Threshold Tuning"
tags: [search, fuse, fuzzy-matching, threshold]
date: 2026-04-19
---

TL;DR: Fuse threshold ranges 0 (exact match) to 1 (match anything). Set to 0.4 for QA search (balances false negatives with recall), test with recall@k fixtures.

## What Threshold Does

Fuse.js returns search results ranked by distance score. Threshold is the score cutoff: results below threshold are discarded.

- **threshold: 0** = only exact matches
- **threshold: 0.5** = moderate fuzziness
- **threshold: 1.0** = accept anything (useless)

Higher threshold = more results, higher recall (also more noise). Lower threshold = fewer results, higher precision.

## Score Interpretation

Fuse computes a "distance" between query and document. Score 0 = perfect match, 1 = no match. Threshold acts as a gate:

```
score < threshold: include in results
score >= threshold: exclude
```

Example: query "emebd" against "embedding":
- Fuse distance: ~0.3 (close match)
- threshold: 0.4 → included
- threshold: 0.3 → excluded

## Why 0.4 for meshblog QA Search

Meshblog's note graph is small (~50-500 notes). Users tolerate typos and synonyms. Testing with recall@k fixtures shows:

- threshold 0.3: too strict, misses typos and near-matches (false negatives)
- threshold 0.4: catches typos, few false positives
- threshold 0.5+: too permissive, noise drowns signal

Set keys: `minMatchCharLength: 3` (ignore 1-2 char matches) + threshold 0.4.

## Evaluation Pattern

Create fixtures: query + expected note IDs.

```typescript
const fixtures = [
  { query: "emebd", expected: [3, 5] },  // typo for embedding
  { query: "graph algos", expected: [6, 8] },  // synonym for PageRank
]

const recalls = fixtures.map(({ query, expected }) => {
  const results = fuse.search(query, { limit: 10 })
  const found = results.map(r => r.refIndex)
  const hit = expected.every(id => found.includes(id))
  return hit ? 1 : 0
})
const recallAt10 = recalls.reduce((a, b) => a + b) / recalls.length
console.log(`Recall@10: ${recallAt10}`) // aim for 0.95+
```

Adjust threshold until recall@10 > 0.95 on your fixtures.

## Tradeoff

Higher recall (higher threshold) = more noise. Balance with `limit` parameter: if 50% are noise but top-5 are good, users ignore junk below the fold. Test with actual users typing real queries.
