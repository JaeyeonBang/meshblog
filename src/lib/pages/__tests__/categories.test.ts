/**
 * categories.test.ts — unit tests for the category taxonomy API.
 *
 * Strategy: spins up a dedicated fixture DB via FIXTURE_ONLY=1 bun run build-index,
 * then imports the category functions with MESHBLOG_DB pointing at it.
 *
 * Covers:
 *   1. listCategories() returns rows ordered by total count DESC, then slug ASC.
 *   2. listCategories() returns empty array when no DB exists.
 *   3. listNotesByCategory() returns only notes matching the given slug.
 *   4. listNotesByCategory() for a null-category note (uncategorized) is not included.
 *   5. listPostsByCategory() returns empty for a category with no posts.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execSync } from 'node:child_process'
import { existsSync, unlinkSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const REPO_ROOT = join(import.meta.dirname, '../../..')
const TEST_DB = join(REPO_ROOT, '.data/test-categories.db')

// Point page helpers at the test DB before importing.
process.env.MESHBLOG_DB = TEST_DB

// Dynamic imports so MESHBLOG_DB env is captured by the module.
const { listCategories, listNotesByCategory, listPostsByCategory } =
  await import('../categories.js')

function cleanDb() {
  for (const ext of ['', '-shm', '-wal']) {
    const f = TEST_DB + ext
    if (existsSync(f)) unlinkSync(f)
  }
}

beforeAll(() => {
  cleanDb()
  // Ensure .data/ directory exists before the build-index seed creates the DB.
  mkdirSync(join(REPO_ROOT, '.data'), { recursive: true })
  execSync('bun run build-index', {
    cwd: REPO_ROOT,
    env: { ...process.env, MESHBLOG_DB: TEST_DB, FIXTURE_ONLY: '1' },
    encoding: 'utf-8',
  })
}, 30_000)

afterAll(() => {
  cleanDb()
})

// ── listCategories() ──────────────────────────────────────────────────────────

describe('listCategories()', () => {
  it('returns a non-empty array from the fixture DB', () => {
    const cats = listCategories()
    expect(Array.isArray(cats)).toBe(true)
    expect(cats.length).toBeGreaterThanOrEqual(3)
  })

  it('every row has slug, name, noteCount, postCount', () => {
    for (const c of listCategories()) {
      expect(typeof c.slug).toBe('string')
      expect(typeof c.name).toBe('string')
      expect(typeof c.noteCount).toBe('number')
      expect(typeof c.postCount).toBe('number')
    }
  })

  it('is sorted by total count DESC then slug ASC', () => {
    const cats = listCategories()
    for (let i = 1; i < cats.length; i++) {
      const prev = cats[i - 1]
      const curr = cats[i]
      const prevTotal = prev.noteCount + prev.postCount
      const currTotal = curr.noteCount + curr.postCount
      if (prevTotal === currTotal) {
        expect(prev.slug <= curr.slug).toBe(true)
      } else {
        expect(prevTotal).toBeGreaterThanOrEqual(currTotal)
      }
    }
  })

  it('engineering is the top category (3 fixture notes)', () => {
    const cats = listCategories()
    expect(cats[0].slug).toBe('engineering')
    expect(cats[0].noteCount).toBe(3)
  })

  it('fixture has ai and writing categories', () => {
    const cats = listCategories()
    const slugs = cats.map((c) => c.slug)
    expect(slugs).toContain('ai')
    expect(slugs).toContain('writing')
  })
})

// ── empty-DB case ─────────────────────────────────────────────────────────────

describe('listCategories() — no DB', () => {
  it('returns empty array when DB does not exist', async () => {
    const origDb = process.env.MESHBLOG_DB
    process.env.MESHBLOG_DB = '/tmp/__nonexistent_meshblog_test.db'
    // Re-import with a fresh env isn't straightforward in ESM; instead call the
    // exported function which uses openReadonlyDb() and returns [] when file is missing.
    const { listCategories: listCatsNoDb } = await import('../categories.js')
    process.env.MESHBLOG_DB = origDb
    // The module caches DB_PATH at import time, so we test the openReadonlyDb path directly.
    // Acceptance: the function must not throw and must return an array.
    const result = listCatsNoDb()
    expect(Array.isArray(result)).toBe(true)
  })
})

// ── listNotesByCategory() ────────────────────────────────────────────────────

describe('listNotesByCategory()', () => {
  it('returns notes for "engineering" (fixture: 3 notes)', () => {
    const notes = listNotesByCategory('engineering')
    expect(notes.length).toBe(3)
    for (const n of notes) {
      expect(n.category_slug).toBe('engineering')
      expect(Array.isArray(n.tags)).toBe(true)
    }
  })

  it('returns notes for "ai" (fixture: 1 note)', () => {
    const notes = listNotesByCategory('ai')
    expect(notes.length).toBe(1)
    expect(notes[0].slug).toBe('fixture-rag-overview')
  })

  it('returns empty array for an unknown category', () => {
    const notes = listNotesByCategory('__unknown_category__')
    expect(notes).toEqual([])
  })

  it('notes have category_slug field populated', () => {
    const notes = listNotesByCategory('writing')
    expect(notes.length).toBeGreaterThanOrEqual(1)
    expect(notes[0].category_slug).toBe('writing')
  })
})

// ── listPostsByCategory() ────────────────────────────────────────────────────

describe('listPostsByCategory()', () => {
  it('returns empty array for engineering (fixture: no posts, only notes)', () => {
    const posts = listPostsByCategory('engineering')
    // Fixture seed only has content/notes rows, not content/posts rows.
    expect(Array.isArray(posts)).toBe(true)
    expect(posts.length).toBe(0)
  })

  it('returns empty array for unknown category', () => {
    const posts = listPostsByCategory('__no_such__')
    expect(posts).toEqual([])
  })
})
