---
title: Reading Notes — Graph Algorithms
tags: [journal, reading]
---

Notes from reading about graph algorithms as they relate to the meshblog knowledge graph.

## Louvain community detection

The Louvain algorithm partitions a graph into communities by maximising modularity. In meshblog, it groups note entities into concepts: see [[level-pinned-concept]] for how this manifests in the UI.

## PageRank

PageRank assigns importance scores to nodes based on how many high-importance nodes link to them. In the note graph, a note referenced by many other notes gets a higher PageRank and is promoted to the L1 tier.

Notes like [[long-note-many-links]] link to many targets, making those targets more important in the graph.

## Backlinks as directed edges

Each `[[wikilink]]` creates a directed edge from the source note to the target note. The `wikilinks` table stores these edges including unresolved ones (where `target_id IS NULL`).

The graph view's Backlinks mode uses these edges to show inbound references: click any node to see which notes point to it.
