---
title: "meshblog Phase 2: Build Pipeline Architecture"
tags: [meshblog, architecture, build-pipeline, second-brain]
date: 2026-01-20
---

meshblog's Phase 2 build pipeline transforms Markdown notes into a searchable, graph-connected second brain.

## Pipeline Overview

```
content/notes/*.md
    ↓ gray-matter (parse frontmatter)
    ↓ extractEntities (OpenRouter/LLM → entities table)
    ↓ generateEmbedding (OpenAI → note_embeddings table)
    ↓ Louvain (graphology → concepts table)
    ↓ callClaude (Claude Code CLI → qa_cards table + .data/qa/)
    ↓ PageRank (graphology → graph_levels table)
    ↓ JSON export (→ public/graph/*.json)
    ↓ astro build (→ dist/)
```

## Stage 1: Entity Extraction

Uses OpenRouter to call GPT-4o-mini. Each note is analyzed for:
- Named entities (people, technologies, concepts, organizations)
- Relationships between entities

Result: `entities`, `note_entities`, `entity_relationships` tables.

## Stage 2: Embeddings

Uses OpenAI `text-embedding-3-small`. Each note is split into chunks (~1500 chars), each chunk embedded into a 1536-dimensional vector.

Stored as BLOB (Float32Array bytes) in `note_embeddings` table. ~6KB per chunk.

## Stage 3: Concept Clustering

Entities are clustered using Louvain community detection. Each community is named by an LLM (Claude or GPT-4o-mini).

Result: `concepts` and `concept_entities` tables.

## Stage 4: Q&A Generation

3-tier FAQ generation via Claude Code CLI subprocess:
- **Note tier**: 5 Q&A per note
- **Concept tier**: 3 Q&A per concept
- **Global tier**: 5 vault-wide questions

Output: `.data/qa/{tier}/{id}.json` + `qa_cards` table.

## Stage 5: Graph Export

PageRank assigns importance levels (L1/L2/L3) to notes and concepts.

Output: `public/graph/note-l{1,2,3}.json` + `public/graph/concept-l{1,2,3}.json`

## Incremental Rebuild

Content hash skip: unchanged notes skip entity extraction and embedding.
Q&A cache: content + prompt version hash prevents redundant Claude calls.
