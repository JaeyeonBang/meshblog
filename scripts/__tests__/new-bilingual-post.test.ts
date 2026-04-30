/**
 * scripts/__tests__/new-bilingual-post.test.ts
 *
 * Tests for the /new-bilingual-post skill scaffolder.
 *
 * Tests:
 *  1. buildKorTemplate — correct YAML frontmatter, has_en: true, draft: true
 *  2. buildEnTemplate  — correct YAML frontmatter, draft: true
 *  3. createBilingualPost — writes both files with correct frontmatter
 *  4. No-overwrite guard — errors when KOR file already exists
 *  5. No-overwrite guard — errors when EN companion already exists
 *  6. CLI smoke test — both files created, then deleted
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execSync } from 'node:child_process'
import matter from 'gray-matter'

import { buildKorTemplate, buildEnTemplate, createBilingualPost, slugify } from '../new-bilingual-post.ts'

// ── buildKorTemplate ──────────────────────────────────────────────────────────

describe('buildKorTemplate', () => {
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

  it('sets level_pin to null', () => {
    const parsed = matter(buildKorTemplate('테스트'))
    expect(parsed.data.level_pin).toBeNull()
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

// ── createBilingualPost ───────────────────────────────────────────────────────

describe('createBilingualPost', () => {
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

// ── CLI smoke test ────────────────────────────────────────────────────────────

describe('new-bilingual-post CLI smoke', () => {
  const REPO_ROOT = join(import.meta.dirname, '../..')
  const realNotesDir = join(REPO_ROOT, 'content', 'notes')

  it('creates both files with correct frontmatter, then cleans up', () => {
    // Use timestamp + random suffix to avoid collisions across concurrent runs
    const uid = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    // Use ASCII-safe Korean title so slugify produces a stable slug
    // (Korean chars are stripped; include a unique ASCII suffix for isolation)
    const titleKo = `bilingual-smoke-ko-${uid}`
    const titleEn = `bilingual-smoke-en-${uid}`
    const slug = slugify(titleKo)
    const korPath = join(realNotesDir, `${slug}.md`)
    const enPath = join(realNotesDir, `${slug}.en.md`)

    // Pre-cleanup (guard against previous run leaks)
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

      const en = matter(readFileSync(enPath, 'utf-8'))
      expect(en.data.title).toBe(titleEn)
      expect(en.data.draft).toBe(true)
    } finally {
      if (existsSync(korPath)) rmSync(korPath)
      if (existsSync(enPath)) rmSync(enPath)
    }
  })
})
