#!/usr/bin/env tsx
/**
 * scripts/new-bilingual-post.ts
 * Scaffold a bilingual note pair in content/notes/:
 *   <slug>.md    — KOR primary (has_en: true, draft: true)
 *   <slug>.en.md — ENG companion (title only, draft: true)
 *
 * Usage:
 *   bun run new-bilingual-post "한국어 제목" "English title"
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
 */
export function buildKorTemplate(titleKo: string): string {
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

/**
 * Build the ENG companion frontmatter + body template.
 */
export function buildEnTemplate(titleEn: string): string {
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
  notesDir: string,
): Promise<{ korPath: string; enPath: string }> {
  const slug = slugify(titleKo)
  const korPath = join(notesDir, `${slug}.md`)
  const enPath = join(notesDir, `${slug}.en.md`)

  if (existsSync(korPath)) {
    throw new Error(`KOR file already exists — ${korPath}\nRename the existing file or choose a different title.`)
  }
  if (existsSync(enPath)) {
    throw new Error(`EN companion already exists — ${enPath}\nRename the existing file or choose a different title.`)
  }

  mkdirSync(notesDir, { recursive: true })
  writeFileSync(korPath, buildKorTemplate(titleKo), 'utf-8')
  writeFileSync(enPath, buildEnTemplate(titleEn), 'utf-8')

  return { korPath, enPath }
}

async function main(): Promise<void> {
  const ROOT = new URL('..', import.meta.url).pathname
  const notesDir = join(ROOT, 'content', 'notes')

  let titleKo = process.argv[2]?.trim() ?? ''
  let titleEn = process.argv[3]?.trim() ?? ''

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
    const { korPath, enPath } = await createBilingualPost(titleKo, titleEn, notesDir)
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
