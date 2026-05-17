/**
 * scripts/__tests__/new-bilingual-post.test.ts
 *
 * Tests for the /new-bilingual-post skill scaffolder.
 *
 * Tests:
 *  1. buildKorTemplate (post mode, default) — post frontmatter, has_en: true, draft: true
 *  2. buildKorTemplate (note mode) — legacy note frontmatter
 *  3. buildEnTemplate  — correct YAML frontmatter, draft: true (same in both modes)
 *  4. createBilingualPost — writes both files with correct frontmatter (post mode)
 *  5. No-overwrite guard — errors when KOR file already exists
 *  6. No-overwrite guard — errors when EN companion already exists
 *  7. CLI smoke test — default writes to content/posts/
 *  8. CLI smoke test --as=note — writes to content/notes/
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execSync } from 'node:child_process'
import matter from 'gray-matter'

import { buildKorTemplate, buildEnTemplate, createBilingualPost, slugify } from '../new-bilingual-post.ts'

// ── buildKorTemplate (post mode — default) ────────────────────────────────────

describe('buildKorTemplate (post mode, default)', () => {
  it('sets title correctly', () => {
    const md = buildKorTemplate('샘플 글')
    const parsed = matter(md)
    expect(parsed.data.title).toBe('샘플 글')
  })

  it('sets has_en: true', () => {
    const parsed = matter(buildKorTemplate('테스트'))
    expect(parsed.data.has_en).toBe(true)
  })

  it('sets draft: true', () => {
    const parsed = matter(buildKorTemplate('테스트'))
    expect(parsed.data.draft).toBe(true)
  })

  it('sets tags to empty array', () => {
    const parsed = matter(buildKorTemplate('테스트'))
    expect(Array.isArray(parsed.data.tags)).toBe(true)
    expect(parsed.data.tags).toHaveLength(0)
  })

  it('includes a date field (YYYY-MM-DD)', () => {
    const parsed = matter(buildKorTemplate('날짜 테스트'))
    expect(parsed.data.date).toBeTruthy()
    const dateStr = parsed.data.date instanceof Date
      ? parsed.data.date.toISOString().slice(0, 10)
      : String(parsed.data.date)
    expect(dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('includes an image path referencing /meshblog/og/posts/', () => {
    const md = buildKorTemplate('이미지 테스트', 'image-test')
    const parsed = matter(md)
    expect(parsed.data.image).toContain('/meshblog/og/posts/')
    expect(parsed.data.image).toContain('image-test')
  })

  it('does NOT set aliases or level_pin in post mode', () => {
    const parsed = matter(buildKorTemplate('포스트 필드'))
    expect(parsed.data.aliases).toBeUndefined()
    expect(parsed.data.level_pin).toBeUndefined()
  })

  it('includes H1 heading in body', () => {
    const md = buildKorTemplate('한국어 제목')
    const parsed = matter(md)
    expect(parsed.content.trim()).toContain('# 한국어 제목')
  })

  it('escapes double-quotes in title', () => {
    const md = buildKorTemplate('She said "hello"')
    const parsed = matter(md)
    expect(parsed.data.title).toBe('She said "hello"')
  })
})

// ── buildKorTemplate (note mode — legacy --as=note) ───────────────────────────

describe('buildKorTemplate (note mode)', () => {
  it('sets title correctly', () => {
    const md = buildKorTemplate('샘플 글', undefined, 'note')
    const parsed = matter(md)
    expect(parsed.data.title).toBe('샘플 글')
  })

  it('sets has_en: true', () => {
    const parsed = matter(buildKorTemplate('테스트', undefined, 'note'))
    expect(parsed.data.has_en).toBe(true)
  })

  it('sets draft: true', () => {
    const parsed = matter(buildKorTemplate('테스트', undefined, 'note'))
    expect(parsed.data.draft).toBe(true)
  })

  it('sets tags to empty array', () => {
    const parsed = matter(buildKorTemplate('테스트', undefined, 'note'))
    expect(Array.isArray(parsed.data.tags)).toBe(true)
    expect(parsed.data.tags).toHaveLength(0)
  })

  it('sets level_pin to null', () => {
    const parsed = matter(buildKorTemplate('테스트', undefined, 'note'))
    expect(parsed.data.level_pin).toBeNull()
  })

  it('includes H1 heading in body', () => {
    const md = buildKorTemplate('한국어 제목', undefined, 'note')
    const parsed = matter(md)
    expect(parsed.content.trim()).toContain('# 한국어 제목')
  })

  it('escapes double-quotes in title', () => {
    const md = buildKorTemplate('She said "hello"', undefined, 'note')
    const parsed = matter(md)
    expect(parsed.data.title).toBe('She said "hello"')
  })
})

// ── buildEnTemplate ───────────────────────────────────────────────────────────

describe('buildEnTemplate', () => {
  it('sets title correctly', () => {
    const md = buildEnTemplate('Sample post')
    const parsed = matter(md)
    expect(parsed.data.title).toBe('Sample post')
  })

  it('sets draft: true', () => {
    const parsed = matter(buildEnTemplate('Sample post'))
    expect(parsed.data.draft).toBe(true)
  })

  it('does NOT set has_en (companion carries no bilingual flag)', () => {
    const parsed = matter(buildEnTemplate('Sample post'))
    expect(parsed.data.has_en).toBeUndefined()
  })

  it('includes H1 heading in body', () => {
    const md = buildEnTemplate('English Title')
    const parsed = matter(md)
    expect(parsed.content.trim()).toContain('# English Title')
  })
})

// ── createBilingualPost (post mode — default) ─────────────────────────────────

describe('createBilingualPost (post mode, default)', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = join(tmpdir(), `bilingual-test-${Date.now()}`)
    mkdirSync(tmpDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('writes both files with correct frontmatter', async () => {
    const titleKo = '테스트 글'
    const titleEn = 'Test post'
    const slug = slugify(titleKo)

    const { korPath, enPath } = await createBilingualPost(titleKo, titleEn, tmpDir)

    expect(existsSync(korPath)).toBe(true)
    expect(existsSync(enPath)).toBe(true)

    const kor = matter(readFileSync(korPath, 'utf-8'))
    expect(kor.data.title).toBe(titleKo)
    expect(kor.data.has_en).toBe(true)
    expect(kor.data.draft).toBe(true)
    // post mode fields
    expect(kor.data.image).toContain('/meshblog/og/posts/')

    const en = matter(readFileSync(enPath, 'utf-8'))
    expect(en.data.title).toBe(titleEn)
    expect(en.data.draft).toBe(true)

    // KOR file name is <slug>.md
    expect(korPath.endsWith(`${slug}.md`)).toBe(true)
    // EN companion is <slug>.en.md
    expect(enPath.endsWith(`${slug}.en.md`)).toBe(true)
  })

  it('errors when KOR file already exists — does not overwrite', async () => {
    const titleKo = '충돌 글'
    const titleEn = 'Collision post'
    const slug = slugify(titleKo)
    const korPath = join(tmpDir, `${slug}.md`)

    writeFileSync(korPath, '# existing\n', 'utf-8')

    await expect(createBilingualPost(titleKo, titleEn, tmpDir))
      .rejects
      .toThrow(/already exists/)

    // EN companion should NOT have been created
    const enPath = join(tmpDir, `${slug}.en.md`)
    expect(existsSync(enPath)).toBe(false)
  })

  it('errors when EN companion already exists — does not overwrite', async () => {
    const titleKo = '동반 글'
    const titleEn = 'Companion post'
    const slug = slugify(titleKo)
    const enPath = join(tmpDir, `${slug}.en.md`)

    writeFileSync(enPath, '# existing en\n', 'utf-8')

    await expect(createBilingualPost(titleKo, titleEn, tmpDir))
      .rejects
      .toThrow(/already exists/)
  })
})

// ── CLI smoke tests ───────────────────────────────────────────────────────────

describe('new-bilingual-post CLI smoke — default (posts/)', () => {
  const REPO_ROOT = join(import.meta.dirname, '../..')
  const realPostsDir = join(REPO_ROOT, 'content', 'posts')

  it('creates both files in content/posts/ with correct frontmatter, then cleans up', () => {
    const uid = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const titleKo = `bilingual-smoke-ko-${uid}`
    const titleEn = `bilingual-smoke-en-${uid}`
    const slug = slugify(titleKo)
    const korPath = join(realPostsDir, `${slug}.md`)
    const enPath = join(realPostsDir, `${slug}.en.md`)

    if (existsSync(korPath)) rmSync(korPath)
    if (existsSync(enPath)) rmSync(enPath)

    try {
      execSync(`bun run scripts/new-bilingual-post.ts "${titleKo}" "${titleEn}"`, {
        cwd: REPO_ROOT,
        encoding: 'utf-8',
        stdio: 'pipe',
      })

      expect(existsSync(korPath)).toBe(true)
      expect(existsSync(enPath)).toBe(true)

      const kor = matter(readFileSync(korPath, 'utf-8'))
      expect(kor.data.title).toBe(titleKo)
      expect(kor.data.has_en).toBe(true)
      expect(kor.data.draft).toBe(true)
      expect(kor.data.image).toContain('/meshblog/og/posts/')

      const en = matter(readFileSync(enPath, 'utf-8'))
      expect(en.data.title).toBe(titleEn)
      expect(en.data.draft).toBe(true)
    } finally {
      if (existsSync(korPath)) rmSync(korPath)
      if (existsSync(enPath)) rmSync(enPath)
    }
  })
})

describe('new-bilingual-post CLI smoke — --as=note (notes/)', () => {
  const REPO_ROOT = join(import.meta.dirname, '../..')
  const realNotesDir = join(REPO_ROOT, 'content', 'notes')

  it('creates both files in content/notes/ with note frontmatter, then cleans up', () => {
    const uid = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const titleKo = `bilingual-note-smoke-ko-${uid}`
    const titleEn = `bilingual-note-smoke-en-${uid}`
    const slug = slugify(titleKo)
    const korPath = join(realNotesDir, `${slug}.md`)
    const enPath = join(realNotesDir, `${slug}.en.md`)

    if (existsSync(korPath)) rmSync(korPath)
    if (existsSync(enPath)) rmSync(enPath)

    try {
      execSync(`bun run scripts/new-bilingual-post.ts "${titleKo}" "${titleEn}" --as=note`, {
        cwd: REPO_ROOT,
        encoding: 'utf-8',
        stdio: 'pipe',
      })

      expect(existsSync(korPath)).toBe(true)
      expect(existsSync(enPath)).toBe(true)

      const kor = matter(readFileSync(korPath, 'utf-8'))
      expect(kor.data.title).toBe(titleKo)
      expect(kor.data.has_en).toBe(true)
      expect(kor.data.draft).toBe(true)
      // note mode: no image, has level_pin + aliases
      expect(kor.data.image).toBeUndefined()
      expect(kor.data.level_pin).toBeNull()
      expect(kor.data.aliases).toBeDefined()

      const en = matter(readFileSync(enPath, 'utf-8'))
      expect(en.data.title).toBe(titleEn)
      expect(en.data.draft).toBe(true)
    } finally {
      if (existsSync(korPath)) rmSync(korPath)
      if (existsSync(enPath)) rmSync(enPath)
    }
  })
})
