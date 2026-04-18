---
title: "TypeScript Generics: A Practical Guide"
tags: [typescript, generics, type-system]
date: 2026-01-04
---

TypeScript generics allow you to write reusable, type-safe code without sacrificing flexibility.

## Basic Generic Functions

The simplest generic is a function that preserves the type of its input:

```typescript
function identity<T>(arg: T): T {
  return arg
}
```

This is more useful than `any` because TypeScript can infer the return type.

## Generic Constraints

Use `extends` to constrain what types are accepted:

```typescript
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key]
}
```

This prevents accessing properties that don't exist on the type.

## Generic Interfaces

Interfaces can be generic too:

```typescript
interface Repository<T> {
  findById(id: string): Promise<T | null>
  save(entity: T): Promise<T>
  delete(id: string): Promise<void>
}
```

This pattern is common in domain-driven design.

## Utility Types

TypeScript ships with built-in generic utility types:
- `Partial<T>` — makes all properties optional
- `Required<T>` — makes all properties required
- `Pick<T, K>` — selects a subset of properties
- `Omit<T, K>` — removes specific properties
- `Record<K, V>` — creates an object type with specified keys and values

Generics are fundamental to writing maintainable TypeScript code.
