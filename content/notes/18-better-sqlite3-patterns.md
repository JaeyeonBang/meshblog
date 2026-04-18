---
title: "better-sqlite3: Patterns for TypeScript Projects"
tags: [better-sqlite3, sqlite, typescript, database]
date: 2026-01-18
---

`better-sqlite3` is the most popular SQLite library for Node.js. It's synchronous (unlike other SQLite bindings), which makes it simpler to use correctly.

## Core API

```typescript
import Database from "better-sqlite3"

const db = new Database(".data/app.db")
db.pragma("journal_mode = WAL")  // Enable WAL mode for better concurrency
db.pragma("foreign_keys = ON")   // Enforce FK constraints

// Prepare once, execute many times
const stmt = db.prepare("SELECT * FROM notes WHERE id = ?")
const row = stmt.get("my-slug")  // Returns one row or undefined
const rows = stmt.all()           // Returns all rows

// Execute without returning rows
const result = db.prepare("INSERT INTO notes (...) VALUES (...)").run(...)
console.log(result.lastInsertRowid)  // The new row's ID
console.log(result.changes)          // Number of rows affected
```

## Transactions

Transactions in better-sqlite3 are synchronous and simple:

```typescript
const insertMany = db.transaction((items: Item[]) => {
  for (const item of items) {
    stmt.run(item)
  }
})

insertMany(myItems)  // All or nothing
```

## WAL Mode

WAL (Write-Ahead Logging) mode enables:
- Multiple concurrent readers
- One writer at a time
- Better crash recovery

Always enable WAL for application databases.

## Type Safety

better-sqlite3 returns `unknown` types. Cast to your expected shape:

```typescript
const row = db.prepare("SELECT id, title FROM notes WHERE id = ?").get(slug) as
  { id: string; title: string } | undefined
```

## RETURNING Clause

SQLite 3.38+ supports `RETURNING`:

```typescript
const row = db.prepare(
  "INSERT INTO entities (name) VALUES (?) RETURNING id"
).get(name) as { id: number }
```

Use `.get()` not `.run()` for RETURNING queries — `.run()` discards the result.
