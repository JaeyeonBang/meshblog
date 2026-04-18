---
title: "Technical Writing for Developers: Notes from Practice"
tags: [writing, documentation, communication, developer-experience]
date: 2026-01-19
---

Good technical writing is a superpower. Clear docs, meaningful error messages, and well-commented code multiply your team's effectiveness.

## The Structure That Works

**Conclusion first**: Lead with what the reader needs to know. Explanation second.

```
BAD:  "Given the architectural constraints and the fact that we're using 
       SQLite rather than PostgreSQL, and considering that WAL mode helps 
       with concurrent reads, you should probably enable WAL."

GOOD: "Enable WAL mode. It allows concurrent reads and prevents write 
       lock timeouts."
```

## Error Messages

An error message should contain:
1. **What happened**: `OPENAI_API_KEY not set`
2. **Why it matters**: `Embeddings require the OpenAI API`
3. **How to fix it**: `Add OPENAI_API_KEY=sk-... to .env.local`

```typescript
throw new Error(
  "Problem: OPENAI_API_KEY is not set.\n" +
  "Cause: The embeddings stage calls the OpenAI API.\n" +
  "Fix: Get a key from platform.openai.com/api-keys and add it to .env.local"
)
```

## README Structure

Every project needs:
1. **One-sentence description**: What is this?
2. **Quick start**: How do I run it right now?
3. **Required configuration**: What env vars/keys do I need?
4. **Command reference**: What can I do with it?
5. **Troubleshooting**: What goes wrong and how do I fix it?

## Comments in Code

Comment the *why*, not the *what*:

```typescript
// BAD: Loop over chunks and insert each one
// GOOD: WAL journal makes concurrent reads safe but only one writer at a time;
//        insert chunks sequentially to avoid SQLITE_BUSY errors
for (const chunk of chunks) {
  insertChunk(db, chunk)
}
```

## Analogies for Complex Concepts

A well-chosen analogy makes the difference between understanding and memorizing:

> "Cosine similarity is like measuring the angle between two compass needles. 
>  Zero degrees = identical direction = same meaning. 
>  90 degrees = perpendicular = unrelated topics."
