---
title: "Testing TypeScript Projects with Vitest"
tags: [vitest, testing, typescript, unit-testing]
date: 2026-01-11
---

Vitest is a Vite-native testing framework that provides Jest-compatible APIs with much faster execution.

## Why Vitest over Jest

- **No configuration** for TypeScript or ESM projects
- **Vite-native**: uses the same config as your build tool
- **Faster**: parallel test execution, HMR-like watch mode
- **Compatible**: most Jest APIs work without changes

## Basic Setup

```typescript
// vitest.config.ts (or use vite.config.ts)
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    globals: true,
  }
})
```

## Test Structure

```typescript
import { describe, it, expect, beforeEach } from "vitest"

describe("MyModule", () => {
  it("does the thing", () => {
    expect(myFunction()).toBe(expected)
  })
})
```

## Mocking

Vitest has excellent mock support:

```typescript
import { vi } from "vitest"

const mockFn = vi.fn().mockReturnValue("mocked")
vi.spyOn(module, "method")
vi.mock("./path/to/module")
```

## SQLite Testing Pattern

For database tests, create a fresh in-memory or temp file DB per test:

```typescript
beforeEach(() => {
  if (existsSync(TMP_DB)) unlinkSync(TMP_DB)
  db = createDb(TMP_DB)
})
```

This ensures test isolation without slow database resets.

## Coverage

```bash
vitest run --coverage
```

Target: 80%+ line coverage for critical paths (schema, parsing, exports).
