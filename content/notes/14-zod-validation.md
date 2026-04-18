---
title: "Zod: Runtime Type Validation for TypeScript"
tags: [zod, typescript, validation, schema]
date: 2026-01-14
---

Zod is a TypeScript-first schema declaration and validation library. It bridges the gap between compile-time TypeScript types and runtime validation.

## The Problem

TypeScript types are erased at runtime. You can declare `type User = { name: string }`, but there's no guarantee that an API response actually conforms to that type.

Zod solves this by defining schemas that validate at runtime AND infer TypeScript types:

```typescript
import { z } from "zod"

const UserSchema = z.object({
  name: z.string(),
  age: z.number().int().min(0).max(150),
  email: z.string().email().optional(),
})

type User = z.infer<typeof UserSchema>  // TypeScript type inferred

const data = UserSchema.parse(apiResponse)  // Runtime validation
```

## Key Features

**Safe parsing**: `.safeParse()` returns `{ success: boolean, data?, error? }` instead of throwing.

**Transformations**: `.transform()` lets you modify data during parsing.

**Coercion**: `.coerce.number()` converts strings to numbers automatically.

**Discriminated unions**: Model sum types cleanly.

## In meshblog

Zod validates LLM outputs, which can be unpredictable:

```typescript
const extractionResultSchema = z.object({
  entities: z.array(entitySchema).max(10).default([]),
  relationships: z.array(relationshipSchema).max(10).default([]),
})
```

The `.default([])` means even if the LLM returns `{}`, we get an empty array rather than a crash.

## Gotcha: Zod v4 Breaking Changes

Zod v4 (released 2025) has several API changes. Check docs before upgrading from v3.
