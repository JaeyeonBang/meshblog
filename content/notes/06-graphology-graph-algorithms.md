---
title: "Graph Algorithms with Graphology: PageRank and Louvain"
tags: [graphology, graph-algorithms, pagerank, louvain, javascript]
date: 2026-01-06
---

Graphology is a robust JavaScript graph library that powers meshblog's knowledge graph engine.

## What is Graphology?

Graphology provides a rich API for creating and manipulating graphs in JavaScript and TypeScript. Unlike d3-force (which focuses on visualization), graphology focuses on graph data structures and algorithms.

## PageRank

PageRank was originally developed by Google to rank web pages. The intuition: a node is important if other important nodes link to it.

```typescript
import { pagerank } from "graphology-metrics/centrality/pagerank"

const ranks = pagerank(graph)
// Returns { nodeId: rankScore } for each node
```

In meshblog, we use PageRank to assign importance levels (L1/L2/L3) to notes and concepts.

## Louvain Community Detection

Louvain is a fast algorithm for detecting communities (clusters) in graphs. It optimizes modularity — the degree to which the graph is divided into dense groups.

```typescript
import louvain from "graphology-communities-louvain"

const communities = louvain(graph)
// Returns { nodeId: communityId }
```

## Application in meshblog

1. **Entity graph**: Entities from notes form an undirected graph (edges = co-occurrence)
2. **Louvain**: Groups related entities into "concepts" (e.g., {React, TypeScript, hooks} → "Frontend")
3. **Note graph**: Notes form a graph based on shared entities
4. **PageRank**: Ranks notes and concepts by centrality

The result: a navigable second-brain structure where importance emerges from content, not manual tagging.
