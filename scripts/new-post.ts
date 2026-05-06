#!/usr/bin/env tsx
/**
 * scripts/new-post.ts
 * Scaffold a new note in content/notes/ with standard frontmatter.
 * New notes are draft:true by default so they won't appear in production
 * until the author explicitly flips the flag.
 *
 * Usage:
 *   bun run new-post "My Note Title"
 *   tsx scripts/new-post.ts "My Note Title"
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline'

// ── exported helpers (used by tests) ─────────────────────────────────────────

// slugify lives in `scripts/lib/slugify.ts` so other scripts can import it
// without also triggering this file's `isMainModule` block under Bun's
// resolver. Re-exported here to keep the existing public API intact.
import { slugify } from "./lib/slugify.ts"
export { slugify }

/**
 * Build the frontmatter + body template string for a new note.
 */
export function buildTemplate(title: string): string {
  return `---
title: "${title.replace(/"/g, '\\"')}"
draft: true
tags: []
aliases: []
level_pin: null
---

# ${title}

`
}

// ── main ──────────────────────────────────────────────────────────────────────

async function promptTitle(): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question('Note title: ', (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

async function main(): Promise<void> {
  const ROOT = new URL('..', import.meta.url).pathname

  // Accept title as argv[2], otherwise prompt interactively
  let title = process.argv[2]?.trim() ?? ''
  if (!title) {
    title = await promptTitle()
  }
  if (!title) {
    console.error('[new-post] ERROR: title cannot be empty')
    process.exit(1)
  }

  const slug = slugify(title)
  const notesDir = join(ROOT, 'content', 'notes')
  const outPath = join(notesDir, `${slug}.md`)

  if (existsSync(outPath)) {
    console.error(`[new-post] ERROR: file already exists — ${outPath}`)
    console.error('[new-post] Rename the existing file or choose a different title.')
    process.exit(1)
  }

  mkdirSync(notesDir, { recursive: true })
  writeFileSync(outPath, buildTemplate(title), 'utf-8')
  console.log(`[new-post] created ${outPath}`)
}

main().catch((err) => {
  console.error('[new-post] fatal:', err)
  process.exit(1)
})
