---
title: "Content Hashing for Cache Invalidation"
tags: [cache, hashing, content-hash, pipeline]
date: 2026-04-19
---

TL;DR: Hash (SHA-256) the frontmatter + body, store in DB. Skip re-processing if hash unchanged. Cuts LLM pipeline cost by skipping stale notes.

## The Pattern

When processing notes through expensive pipelines (embeddings, summarization, LLM classification), compute a hash of the source content. Store hash + result in DB:

```typescript
import crypto from "crypto"

function hashContent(frontmatter: string, body: string): string {
  const full = frontmatter + body
  return crypto.createHash("sha256").update(full).digest("hex")
}

// Insert/update
const contentHash = hashContent(yaml, markdown)
const existing = db.query("SELECT * FROM notes WHERE id = ?", [id])

if (existing.length > 0 && existing[0].contentHash === contentHash) {
  console.log("Skipped (content unchanged)")
  return
}

// Process
const embedding = await embed(markdown)
const summary = await llmSummarize(markdown)

db.exec(
  `INSERT INTO notes (id, contentHash, embedding, summary) 
   VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET ...`,
  [id, contentHash, embedding, summary]
)
```

## Why It Works

- **One-way hash**: Different content always different hash (collision risk is negligible with SHA-256)
- **Fast comparison**: Compare 64-char strings instead of re-processing
- **Partial updates**: Edit one note, skip 499 others

## Schema

```typescript
// Table
CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  contentHash TEXT NOT NULL,
  embedding BLOB,
  summary TEXT,
  updatedAt INTEGER
)

// Index for bulk checks
CREATE INDEX idx_notes_hash ON notes(contentHash)
```

## Meshblog Application

Vault has 100 notes. Each embedding costs $0.0001. Re-processing all 100 notes on every refresh costs $0.01. With hashing:

```typescript
const batch = await readVault()
const toBatch = batch.filter(note => {
  const hash = hashContent(note.frontmatter, note.body)
  const existing = db.query("SELECT contentHash FROM notes WHERE id = ?", [note.id])
  return existing.length === 0 || existing[0].contentHash !== hash
})

// Only process toBatch
const embeddings = await batchEmbed(toBatch)
```

Expected: 1-2 notes changed per refresh → 99% cost savings.

## Hash Collision Risk

SHA-256 is 256 bits. Collision probability is effectively zero for content hashing (would require processing trillions of variations). Don't overthink it; use SHA-256.

## Gotchas

- Hash encoding matters: always use `.digest("hex")` or `.toString("base64")` consistently
- Store both frontmatter hash and body hash separately if you want to detect structure-only changes
- Clear hash table when changing pipeline (new embedding model = reprocess everything)
