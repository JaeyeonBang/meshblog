---
title: "OpenAI Embeddings: text-embedding-3-small Deep Dive"
tags: [openai, embeddings, vector-search, nlp]
date: 2026-01-07
---

Text embeddings convert prose into numerical vectors that capture semantic meaning. Two semantically similar sentences will have vectors pointing in similar directions.

## text-embedding-3-small

OpenAI's `text-embedding-3-small` model produces 1536-dimensional vectors. Key properties:
- **Cost**: ~$0.02 per 1M tokens (very cheap)
- **Speed**: Fast, typically < 500ms per call
- **Quality**: Excellent for semantic similarity, knowledge retrieval

## Using the API

```typescript
import OpenAI from "openai"

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const response = await client.embeddings.create({
  model: "text-embedding-3-small",
  input: "Your text here",
})

const embedding = response.data[0].embedding // number[1536]
```

## Storing Embeddings

In SQLite, we store embeddings as `BLOB` (Float32Array bytes) rather than JSON:
- JSON: 1536 floats × ~8 chars = ~12KB per row
- BLOB: 1536 × 4 bytes = 6KB per row (2x smaller, faster reads)

## Cosine Similarity

The standard way to compare embeddings is cosine similarity:
- Returns 1.0 for identical vectors
- Returns 0.0 for unrelated content
- Returns -1.0 for opposite meaning

For small datasets (<1000 notes), we compute cosine in JavaScript memory — no vector database needed.

## Chunking Strategy

Long documents need to be split into chunks before embedding. Each chunk should:
- Fit within the model's context window
- Preserve complete sentences
- Overlap slightly with adjacent chunks (for continuity)
