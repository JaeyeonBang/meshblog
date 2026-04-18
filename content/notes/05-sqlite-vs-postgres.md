---
title: "SQLite vs PostgreSQL: Choosing the Right Database"
tags: [sqlite, postgresql, database, architecture]
date: 2026-01-05
---

Choosing between SQLite and PostgreSQL is a fundamental architectural decision that affects your entire stack.

## When to Use SQLite

SQLite is ideal for:
- **Single-user applications** — no concurrent writes from multiple processes
- **Embedded systems** — mobile apps, desktop tools, CLI tools
- **Development environments** — fast iteration, no server required
- **Static site generators** — build-time databases (like this blog's RAG index)
- **Small-to-medium datasets** — works well up to a few GB

SQLite stores everything in a single file, making deployment trivially simple.

## When to Use PostgreSQL

PostgreSQL shines for:
- **Multi-user applications** — handles concurrent writes safely via MVCC
- **Complex queries** — advanced SQL, CTEs, window functions, JSON operators
- **Large datasets** — partitioning, advanced indexing, pgvector for AI
- **High availability** — replication, failover, connection pooling

## Key Differences

| Feature | SQLite | PostgreSQL |
|---------|--------|------------|
| Concurrency | Limited (WAL mode helps) | Excellent (MVCC) |
| Data types | Dynamic typing | Strict typing |
| JSON support | Basic | Excellent (jsonb) |
| Vector search | Via extension | pgvector native |
| Deployment | Single file | Server process |

## The meshblog Choice

For meshblog, SQLite is perfect. It's a single-developer tool with build-time writes and read-only production access. No server needed, deployable to any static host.
