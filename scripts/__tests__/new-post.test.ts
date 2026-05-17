/**
 * scripts/__tests__/new-post.test.ts
 * Unit tests for scripts/new-post.ts helpers.
 *
 * Tests:
 *  1. slugify — spaces, unicode, emoji, punctuation
 *  2. buildTemplate (post mode, default) — correct YAML frontmatter
 *  3. buildTemplate (note mode, --as=note) — legacy note frontmatter
 *  4. No-overwrite guard — exits 1 when target file already exists
 *  5. CLI default writes to content/posts/
 *  6. CLI --as=note writes to content/notes/
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execSync } from 'node:child_process'
import matter from 'gray-matter'

import { slugify, buildTemplate } from '../new-post.ts'

// ── slugify ───────────────────────────────────────────────────────────────────

describe('slugify', () => {
  it('lowercases and hyphenates spaces', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })

  it('strips leading and trailing hyphens', () => {
    expect(slugify('  -- Spaces Around --  ')).toBe('spaces-around')
  })

  it('collapses multiple separators into one hyphen', () => {
    expect(slugify('foo   bar---baz')).toBe('foo-bar-baz')
  })

  it('removes emoji', () => {
    expect(slugify('Hello 🌍 World')).toBe('hello-world')
  })

  it('removes emoji-only title → "untitled"', () => {
    expect(slugify('🎉🎊')).toBe('untitled')
  })

  it('handles punctuation (strips it)', () => {
    expect(slugify("It's a test! (really)")).toBe('it-s-a-test-really')
  })

  it('preserves ASCII digits', () => {
    expect(slugify('Part 2: The Sequel')).toBe('part-2-the-sequel')
  })

  it('handles empty string → "untitled"', () => {
    expect(slugify('')).toBe('untitled')
  })

  it('handles unicode latin characters', () => {
    const result = slugify('Über die Straße')
    // Should not crash; should produce a non-empty slug
    expect(result.length).toBeGreaterThan(0)
    expect(result).not.toMatch(/^-|-$/)
  })
})

// ── buildTemplate (post mode — default) ──────────────────────────────────────

describe('buildTemplate (post mode, default)', () => {
  it('produces valid YAML frontmatter parseable by gray-matter', () => {
    const md = buildTemplate('My Test Post')
    const parsed = matter(md)
    expect(parsed.data.title).toBe('My Test Post')
  })

  it('sets draft: true', () => {
    const parsed = matter(buildTemplate('Draft Post'))
    expect(parsed.data.draft).toBe(true)
  })

  it('sets tags to an empty array', () => {
    const parsed = matter(buildTemplate('Tag Test'))
    expect(Array.isArray(parsed.data.tags)).toBe(true)
    expect(parsed.data.tags).toHaveLength(0)
  })

  it('includes a date field (YYYY-MM-DD)', () => {
    const parsed = matter(buildTemplate('Date Test'))
    expect(parsed.data.date).toBeTruthy()
    // gray-matter parses YAML dates into Date objects
    const dateStr = parsed.data.date instanceof Date
      ? parsed.data.date.toISOString().slice(0, 10)
      : String(parsed.data.date)
    expect(dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('includes an image path referencing /meshblog/og/posts/', () => {
    const md = buildTemplate('Image Test', 'image-test')
    const parsed = matter(md)
    expect(parsed.data.image).toContain('/meshblog/og/posts/')
    expect(parsed.data.image).toContain('image-test')
  })

  it('falls back to slugifying title when slug not provided', () => {
    const md = buildTemplate('No Slug Given')
    const parsed = matter(md)
    expect(parsed.data.image).toContain('no-slug-given')
  })

  it('includes H1 heading in body', () => {
    const md = buildTemplate('Heading Test')
    const parsed = matter(md)
    expect(parsed.content.trim()).toContain('# Heading Test')
  })

  it('escapes double-quotes in title', () => {
    const md = buildTemplate('She said "hello"')
    const parsed = matter(md)
    expect(parsed.data.title).toBe('She said "hello"')
  })

  it('does NOT set aliases or level_pin in post mode', () => {
    const parsed = matter(buildTemplate('Post Fields'))
    expect(parsed.data.aliases).toBeUndefined()
    expect(parsed.data.level_pin).toBeUndefined()
  })
})

// ── buildTemplate (note mode — legacy --as=note) ──────────────────────────────

describe('buildTemplate (note mode)', () => {
  it('produces valid YAML frontmatter parseable by gray-matter', () => {
    const md = buildTemplate('My Test Note', undefined, 'note')
    const parsed = matter(md)
    expect(parsed.data.title).toBe('My Test Note')
  })

  it('sets draft: true', () => {
    const parsed = matter(buildTemplate('Draft Note', undefined, 'note'))
    expect(parsed.data.draft).toBe(true)
  })

  it('sets tags to an empty array', () => {
    const parsed = matter(buildTemplate('Tag Test', undefined, 'note'))
    expect(Array.isArray(parsed.data.tags)).toBe(true)
    expect(parsed.data.tags).toHaveLength(0)
  })

  it('sets aliases to an empty array', () => {
    const parsed = matter(buildTemplate('Alias Test', undefined, 'note'))
    expect(Array.isArray(parsed.data.aliases)).toBe(true)
    expect(parsed.data.aliases).toHaveLength(0)
  })

  it('sets level_pin to null', () => {
    const parsed = matter(buildTemplate('Level Test', undefined, 'note'))
    expect(parsed.data.level_pin).toBeNull()
  })

  it('includes H1 heading in body', () => {
    const md = buildTemplate('Heading Test', undefined, 'note')
    const parsed = matter(md)
    expect(parsed.content.trim()).toContain('# Heading Test')
  })

  it('escapes double-quotes in title', () => {
    const md = buildTemplate('She said "hello"', undefined, 'note')
    const parsed = matter(md)
    expect(parsed.data.title).toBe('She said "hello"')
  })
})

// ── no-overwrite guard ────────────────────────────────────────────────────────

describe('new-post.ts CLI — no-overwrite guard', () => {
  let tmpDir: string
  const REPO_ROOT = join(import.meta.dirname, '../..')

  beforeEach(() => {
    tmpDir = join(tmpdir(), `new-post-test-${Date.now()}`)
    mkdirSync(tmpDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('exits 1 when target file already exists (default posts/ dir)', () => {
    const slug = 'existing-post'
    // Create the collision in content/posts/
    const realPostsDir = join(REPO_ROOT, 'content', 'posts')
    mkdirSync(realPostsDir, { recursive: true })
    const realTarget = join(realPostsDir, `${slug}.md`)
    const alreadyExisted = existsSync(realTarget)
    if (!alreadyExisted) {
      writeFileSync(realTarget, '# collision\n', 'utf-8')
    }

    try {
      let threw = false
      try {
        execSync(`bun run scripts/new-post.ts "Existing Post"`, {
          cwd: REPO_ROOT,
          encoding: 'utf-8',
          stdio: 'pipe',
        })
      } catch (err: any) {
        threw = true
        expect(err.status).toBe(1)
        expect(err.stderr).toContain('already exists')
      }
      expect(threw).toBe(true)
    } finally {
      if (!alreadyExisted && existsSync(realTarget)) {
        rmSync(realTarget)
      }
    }
  })

  it('exits 0 and creates file in content/posts/ for a fresh title (default)', () => {
    const realPostsDir = join(REPO_ROOT, 'content', 'posts')
    mkdirSync(realPostsDir, { recursive: true })
    const slug = `new-post-test-${Date.now()}`
    const target = join(realPostsDir, `${slug}.md`)

    if (existsSync(target)) rmSync(target)

    try {
      const title = slug
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())

      execSync(`bun run scripts/new-post.ts "${title}"`, {
        cwd: REPO_ROOT,
        encoding: 'utf-8',
        stdio: 'pipe',
      })

      expect(existsSync(target)).toBe(true)

      const parsed = matter(readFileSync(target, 'utf-8'))
      expect(parsed.data.draft).toBe(true)
      expect(parsed.data.title).toBe(title)
      // post-mode fields
      expect(parsed.data.image).toContain('/meshblog/og/posts/')
    } finally {
      if (existsSync(target)) rmSync(target)
    }
  })

  it('exits 0 and creates file in content/notes/ when --as=note', () => {
    const realNotesDir = join(REPO_ROOT, 'content', 'notes')
    mkdirSync(realNotesDir, { recursive: true })
    const slug = `new-note-test-${Date.now()}`
    const target = join(realNotesDir, `${slug}.md`)

    if (existsSync(target)) rmSync(target)

    try {
      const title = slug
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())

      execSync(`bun run scripts/new-post.ts "${title}" --as=note`, {
        cwd: REPO_ROOT,
        encoding: 'utf-8',
        stdio: 'pipe',
      })

      expect(existsSync(target)).toBe(true)

      const parsed = matter(readFileSync(target, 'utf-8'))
      expect(parsed.data.draft).toBe(true)
      expect(parsed.data.title).toBe(title)
      // note-mode fields (no image, has aliases + level_pin)
      expect(parsed.data.aliases).toBeDefined()
      expect(parsed.data.level_pin).toBeNull()
      expect(parsed.data.image).toBeUndefined()
    } finally {
      if (existsSync(target)) rmSync(target)
    }
  })
})
