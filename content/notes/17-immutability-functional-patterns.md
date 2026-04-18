---
title: "Immutability and Functional Patterns in TypeScript"
tags: [typescript, functional-programming, immutability, patterns]
date: 2026-01-17
---

Immutability means never modifying data in-place. Always create new objects with the changes applied. This makes code easier to reason about and debug.

## The Core Principle

```typescript
// BAD: Mutation
function addTag(note: Note, tag: string): Note {
  note.tags.push(tag)  // modifies original!
  return note
}

// GOOD: Immutability
function addTag(note: Note, tag: string): Note {
  return {
    ...note,
    tags: [...note.tags, tag],  // new array
  }
}
```

## Why It Matters

- **Predictability**: A function that returns a new object never surprises you with side effects
- **Debugging**: When data is immutable, you can track exactly where it changes
- **Concurrency**: Immutable data is inherently thread-safe
- **React**: Immutable state updates trigger re-renders correctly

## Common Immutable Operations

**Update a property**:
```typescript
const updated = { ...original, status: "done" }
```

**Add to array**:
```typescript
const withNew = [...existing, newItem]
```

**Remove from array**:
```typescript
const without = arr.filter((item) => item.id !== targetId)
```

**Map over array**:
```typescript
const transformed = arr.map((item) => ({
  ...item,
  score: computeScore(item),
}))
```

## When Mutation is OK

Inside a function (local scope), mutation is fine:
```typescript
function buildGraph() {
  const nodes: Node[] = []  // local accumulator
  for (const item of items) {
    nodes.push(transform(item))  // mutation ok — local
  }
  return nodes  // returned as immutable
}
```

The rule: never mutate values that came from outside your function.
