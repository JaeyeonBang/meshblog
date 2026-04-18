---
title: "gray-matter: Parsing Markdown Frontmatter in Node.js"
tags: [gray-matter, markdown, frontmatter, nodejs]
date: 2026-01-16
---

`gray-matter` is the de facto standard for parsing YAML frontmatter from Markdown files in the JavaScript ecosystem.

## Basic Usage

```typescript
import matter from "gray-matter"
import { readFileSync } from "node:fs"

const raw = readFileSync("note.md", "utf-8")
const { data: frontmatter, content } = matter(raw)

console.log(frontmatter.title)  // "My Note Title"
console.log(content)            // Markdown without the --- block
```

## Supported Formats

gray-matter supports YAML (default), TOML, JSON, and custom delimiters. Most Markdown tools use YAML by default.

## TypeScript Types

gray-matter returns `data` as `Record<string, unknown>`. Cast it to your expected type:

```typescript
const fm = data as {
  title?: string
  tags?: string[]
  date?: string
  public?: boolean
}
```

## Common Patterns in meshblog

```typescript
const { data: fm, content } = matter(raw)

const title = (fm.title as string) ?? slug
const tags = JSON.stringify(fm.tags ?? [])
const isPublic = fm.public !== false  // defaults to true
const levelPin = fm.level_pin as number | undefined
```

## Gotchas

- **Date fields**: YAML parses `date: 2026-01-01` as a JavaScript `Date` object, not a string. Use `String(fm.date)` if you need a string.
- **Boolean fields**: `public: false` is correctly parsed as boolean `false`.
- **Missing fields**: Always use `?? defaultValue` since any field can be undefined.
