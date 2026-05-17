#!/usr/bin/env tsx
/**
 * scripts/new-post.ts
 * Scaffold a new post in content/posts/ with standard frontmatter.
 * New posts are draft:true by default so they won't appear in production
 * until the author explicitly flips the flag.
 *
 * Usage:
 *   bun run new-post "My Post Title"          # → content/posts/<slug>.md
 *   bun run new-post "My Post Title" --as=note # → content/notes/<slug>.md (legacy)
 *   tsx scripts/new-post.ts "My Post Title"
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
 * Build the frontmatter + body template string for a new post.
 * @param title  Human-readable post title.
 * @param slug   URL slug (used to derive the OG image path).
 * @param mode   'post' (default) writes post frontmatter; 'note' writes note frontmatter.
 */
export function buildTemplate(title: string, slug?: string, mode: 'post' | 'note' = 'post'): string {
  if (mode === 'note') {
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

  // Post mode: include date, category, image placeholder
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const imageSlug = slug ?? slugify(title)
  // NOTE: OG image must be generated separately (e.g. bun run build-og).
  // The path below is a placeholder — the file won't exist until you run that step.
  return `---
title: "${title.replace(/"/g, '\\"')}"
date: ${today}
draft: true
tags: []
category: ""
image: "/meshblog/og/posts/${imageSlug}.png"
---

# ${title}

`
}

// ── main ──────────────────────────────────────────────────────────────────────

async function promptTitle(): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question('Post title: ', (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

async function main(): Promise<void> {
  const ROOT = new URL('..', import.meta.url).pathname

  // Parse --as=note flag (any position in argv)
  const args = process.argv.slice(2)
  const asNoteFlag = args.includes('--as=note')
  const mode: 'post' | 'note' = asNoteFlag ? 'note' : 'post'
  const positional = args.filter((a) => !a.startsWith('--'))

  // Accept title as first positional arg, otherwise prompt interactively
  let title = positional[0]?.trim() ?? ''
  if (!title) {
    title = await promptTitle()
  }
  if (!title) {
    console.error('[new-post] ERROR: title cannot be empty')
    process.exit(1)
  }

  const slug = slugify(title)
  const targetDir = join(ROOT, 'content', mode === 'note' ? 'notes' : 'posts')
  const outPath = join(targetDir, `${slug}.md`)

  if (existsSync(outPath)) {
    console.error(`[new-post] ERROR: file already exists — ${outPath}`)
    console.error('[new-post] Rename the existing file or choose a different title.')
    process.exit(1)
  }

  mkdirSync(targetDir, { recursive: true })
  writeFileSync(outPath, buildTemplate(title, slug, mode), 'utf-8')
  console.log(`[new-post] created ${outPath}`)
}

main().catch((err) => {
  console.error('[new-post] fatal:', err)
  process.exit(1)
})
