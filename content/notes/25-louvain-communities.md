---
title: "Louvain Community Detection"
tags: [graph-algorithms, community-detection, modularity, graphology]
date: 2026-04-19
---

TL;DR: Louvain partitions a graph into communities by optimizing modularity (measure of how much edges stay within groups). Better than k-means for dense note graphs. Tune resolution parameter to control community size.

## The Problem

Note graph has edges (links between notes). Which notes belong together? K-means doesn't understand graph structure. Louvain does.

Louvain finds groups where:
- **High density within groups**: lots of edges between notes in the same community
- **Low density between groups**: few edges crossing communities

Metric: *modularity* (how much better than random). Range: -1 to 1. Higher = better partitioning.

## Algorithm Overview

Louvain is greedy + multi-level:

1. **Local move**: Each node tries joining its neighbors' communities
2. **Optimize**: Accept move if modularity increases
3. **Repeat**: Until stable
4. **Aggregate**: Combine nodes into super-nodes, repeat on coarser graph

Result: Fast (linear in edges) and scales to millions of nodes.

## graphology-communities-louvain

meshblog uses `graphology-communities-louvain`:

```typescript
import { louvain } from "graphology-communities-louvain"

const partition = louvain(graph)
// Returns: Map{ nodeId => communityId }

partition.forEach((communityId, nodeId) => {
  console.log(`Note ${nodeId} is in community ${communityId}`)
})
```

Default settings work well for most graphs. Tweak via options.

## Resolution Parameter

Controls how fine-grained communities are:

```typescript
const partition = louvain(graph, { resolution: 1.0 })
// resolution: 0.1 → few large communities
// resolution: 1.0 → medium communities (default)
// resolution: 2.0 → many small communities
```

Mental model: Higher resolution = "split communities into smaller ones."

For meshblog (100-500 notes):
- resolution 0.8: 5-10 large topics
- resolution 1.0: 10-15 medium clusters
- resolution 1.5: 20+ fine-grained subcategories

Pick by inspection: run with 1.0, visualize communities, adjust if too coarse/fine.

## Modularity Validation

Check partition quality:

```typescript
import { modularity } from "graphology-metrics"

const q = modularity(graph, partition)
console.log(`Modularity: ${q.toFixed(3)}`)
// 0.3-0.5 = good
// > 0.5 = excellent
// < 0.2 = weak (graph is random-like)
```

Meshblog note graphs typically have modularity 0.35-0.55 (notes cluster around topics naturally).

## Why Louvain Beats K-Means

- K-means needs k (number of clusters) upfront. Louvain finds it automatically.
- K-means optimizes sum-of-squared-distances (Euclidean). Louvain optimizes graph structure (edges).
- K-means treats nodes as points. Louvain treats edges as relationships.

For note graphs: Louvain finds that "Embeddings, Vectors, Similarity Search" cluster together; k-means might split them.

## Meshblog Application

Use Louvain to:
1. Group notes by topic (auto-suggest tags)
2. Recommend notes in same community
3. Visualize knowledge graph with colored clusters
4. Detect orphaned notes (single-node communities)

```typescript
const partition = louvain(noteGraph, { resolution: 1.0 })
const communities = groupBy(Array.from(partition.entries()), ([, cid]) => cid)

communities.forEach((members, communityId) => {
  console.log(`Community ${communityId}: ${members.length} notes`)
})
```

Run monthly to update clustering as vault grows.
