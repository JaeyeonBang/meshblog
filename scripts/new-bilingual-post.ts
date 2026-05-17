#!/usr/bin/env tsx
/**
 * scripts/new-bilingual-post.ts
 * Scaffold a bilingual post pair in content/posts/ (default) or content/notes/:
 *   <slug>.md    — KOR primary (has_en: true, draft: true)
 *   <slug>.en.md — ENG companion (title only, draft: true)
 *
 * Usage:
 *   bun run new-bilingual-post "한국어 제목" "English title"          # → content/posts/
 *   bun run new-bilingual-post "한국어 제목" "English title" --as=note # → content/notes/ (legacy)
 *   tsx scripts/new-bilingual-post.ts "한국어 제목" "English title"
 *
 * The slug is derived from the KOR title. Both files are draft:true by
 * default so they won't appear in production until the author flips the flag.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline'

/**
 * Convert a free-form title to a URL-safe kebab-case slug.
 * Duplicated from new-post.ts to avoid triggering that module's main() side-effect on import.
 */
export function slugify(title: string): string {
  return title
    .normalize('NFC')
    .replace(/[\u{1F000}-\u{10FFFF}]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9À-ɏ]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'untitled'
}

// ── exported helpers (used by tests) ─────────────────────────────────────────

/**
 * Build the KOR primary frontmatter + body template.
 * @param titleKo  Korean title.
 * @param slug     URL slug (used to derive OG image path in post mode).
 * @param mode     'post' (default) or 'note' (legacy).
 */
export function buildKorTemplate(titleKo: string, slug?: string, mode: 'post' | 'note' = 'post'): string {
  if (mode === 'note') {
    return `---
title: "${titleKo.replace(/"/g, '\\"')}"
has_en: true
draft: true
tags: []
aliases: []
level_pin: null
---

# ${titleKo}

`
  }

  // Post mode: include date, category, image placeholder
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const imageSlug = slug ?? slugify(titleKo)
  // NOTE: OG image must be generated separately (e.g. bun run build-og).
  // The path below is a placeholder — the file won't exist until you run that step.
  return `---
title: "${titleKo.replace(/"/g, '\\"')}"
date: ${today}
has_en: true
draft: true
tags: []
category: ""
image: "/meshblog/og/posts/${imageSlug}.png"
---

# ${titleKo}

`
}

/**
 * Build the ENG companion frontmatter + body template.
 * @param titleEn  English title.
 * @param mode     'post' (default) or 'note' (legacy). Companion always stays minimal.
 */
export function buildEnTemplate(titleEn: string, mode: 'post' | 'note' = 'post'): string {
  return `---
title: "${titleEn.replace(/"/g, '\\"')}"
draft: true
---

# ${titleEn}

`
}

// ── main ──────────────────────────────────────────────────────────────────────

async function promptLine(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

export async function createBilingualPost(
  titleKo: string,
  titleEn: string,
  targetDir: string,
  mode: 'post' | 'note' = 'post',
): Promise<{ korPath: string; enPath: string }> {
  const slug = slugify(titleKo)
  const korPath = join(targetDir, `${slug}.md`)
  const enPath = join(targetDir, `${slug}.en.md`)

  if (existsSync(korPath)) {
    throw new Error(`KOR file already exists — ${korPath}\nRename the existing file or choose a different title.`)
  }
  if (existsSync(enPath)) {
    throw new Error(`EN companion already exists — ${enPath}\nRename the existing file or choose a different title.`)
  }

  mkdirSync(targetDir, { recursive: true })
  writeFileSync(korPath, buildKorTemplate(titleKo, slug, mode), 'utf-8')
  writeFileSync(enPath, buildEnTemplate(titleEn, mode), 'utf-8')

  return { korPath, enPath }
}

async function main(): Promise<void> {
  const ROOT = new URL('..', import.meta.url).pathname

  // Parse --as=note flag (any position in argv)
  const args = process.argv.slice(2)
  const asNoteFlag = args.includes('--as=note')
  const mode: 'post' | 'note' = asNoteFlag ? 'note' : 'post'
  const positional = args.filter((a) => !a.startsWith('--'))

  const targetDir = join(ROOT, 'content', mode === 'note' ? 'notes' : 'posts')

  let titleKo = positional[0]?.trim() ?? ''
  let titleEn = positional[1]?.trim() ?? ''

  if (!titleKo) {
    titleKo = await promptLine('Korean title (한국어 제목): ')
  }
  if (!titleKo) {
    console.error('[new-bilingual-post] ERROR: Korean title cannot be empty')
    process.exit(1)
  }

  if (!titleEn) {
    titleEn = await promptLine('English title: ')
  }
  if (!titleEn) {
    console.error('[new-bilingual-post] ERROR: English title cannot be empty')
    process.exit(1)
  }

  try {
    const { korPath, enPath } = await createBilingualPost(titleKo, titleEn, targetDir, mode)
    console.log(`[new-bilingual-post] created KOR: ${korPath}`)
    console.log(`[new-bilingual-post] created  EN: ${enPath}`)
  } catch (err) {
    console.error(`[new-bilingual-post] ERROR: ${(err as Error).message}`)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('[new-bilingual-post] fatal:', err)
  process.exit(1)
})
