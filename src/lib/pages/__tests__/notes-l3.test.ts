/**
 * notes-l3.test.ts — L3 visibility filtering for listNotes(), listAllNoteSlugs(),
 * listNotesByCategory() across all three modes.
 *
 * Fixture: 3 L1 + 3 L2 + 4 L3 notes seeded into a temp DB.
 * Back-compat regression: missing config file → identical to 'full' behaviour.
 *
 * Config isolation: use process.chdir() to a real temp dir and write/omit
 * meshblog.config.json there — same pattern as config.test.ts (Lane A).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { join } from 'node:path'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, existsSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { createDb, execute } from '../../db/index.ts'
import { __resetConfigCache } from '../../config.ts'

// ── Constants ─────────────────────────────────────────────────────────────────

const REPO_ROOT = join(import.meta.dirname, '../../..')
const TEST_DB = join(REPO_ROOT, '.data/test-notes-l3.db')
mkdirSync(join(REPO_ROOT, '.data'), { recursive: true })

// Set MESHBLOG_DB before importing page modules (DB_PATH is captured at module load)
process.env.MESHBLOG_DB = TEST_DB

const { listNotes, listAllNoteSlugs } = await import('../notes.js')
const { listNotesByCategory } = await import('../categories.js')

// ── Fixture data ──────────────────────────────────────────────────────────────

const L1_SLUGS = ['note-l1-a', 'note-l1-b', 'note-l1-c']
const L2_SLUGS = ['note-l2-a', 'note-l2-b', 'note-l2-c']
const L3_SLUGS = ['note-l3-a', 'note-l3-b', 'note-l3-c', 'note-l3-d']
const ALL_SLUGS = [...L1_SLUGS, ...L2_SLUGS, ...L3_SLUGS]

function cleanDb(): void {
  for (const ext of ['', '-shm', '-wal']) {
    const f = TEST_DB + ext
    if (existsSync(f)) unlinkSync(f)
  }
}

function buildDb(): void {
  cleanDb()
  const db = createDb(TEST_DB)
  for (const slug of ALL_SLUGS) {
    execute(db,
      `INSERT OR REPLACE INTO notes
         (id, slug, title, content, content_hash, folder_path, category_slug, graph_status)
       VALUES (?, ?, ?, ?, ?, 'content/notes', 'engineering', 'done')`,
      [slug, slug, `Title ${slug}`, 'some content', `hash-${slug}`]
    )
  }
  const insert = db.prepare(
    `INSERT OR IGNORE INTO graph_levels (graph_type, node_id, level, pagerank) VALUES (?, ?, ?, ?)`
  )
  for (const s of L1_SLUGS) insert.run('note', s, 1, 0.9)
  for (const s of L2_SLUGS) insert.run('note', s, 2, 0.5)
  for (const s of L3_SLUGS) insert.run('note', s, 3, 0.1)
  db.close()
}

// ── Config dir per test ───────────────────────────────────────────────────────

let savedCwd: string
let tmpConfigDir: string

beforeEach(() => {
  buildDb()
  savedCwd = process.cwd()
  tmpConfigDir = mkdtempSync(join(tmpdir(), 'meshblog-notes-l3-test-'))
  process.chdir(tmpConfigDir)
  __resetConfigCache()
})

afterEach(() => {
  process.chdir(savedCwd)
  cleanDb()
  try { rmSync(tmpConfigDir, { recursive: true, force: true }) } catch { /* ok */ }
  vi.restoreAllMocks()
  __resetConfigCache()
})

// ── listNotes() ───────────────────────────────────────────────────────────────

describe('listNotes() — full mode', () => {
  it('returns all 10 notes', () => {
    writeFileSync(join(tmpConfigDir, 'meshblog.config.json'), JSON.stringify({ l3Visibility: 'full' }))
    const notes = listNotes()
    expect(notes.length).toBe(10)
  })
})

describe('listNotes() — keyword-only mode', () => {
  it('returns 6 notes (L3 stripped)', () => {
    writeFileSync(join(tmpConfigDir, 'meshblog.config.json'), JSON.stringify({ l3Visibility: 'keyword-only' }))
    const notes = listNotes()
    expect(notes.length).toBe(6)
    const slugs = notes.map((n) => n.slug)
    for (const s of L3_SLUGS) expect(slugs).not.toContain(s)
    for (const s of [...L1_SLUGS, ...L2_SLUGS]) expect(slugs).toContain(s)
  })
})

describe('listNotes() — hidden mode', () => {
  it('returns 6 notes (L3 excluded)', () => {
    writeFileSync(join(tmpConfigDir, 'meshblog.config.json'), JSON.stringify({ l3Visibility: 'hidden' }))
    const notes = listNotes()
    expect(notes.length).toBe(6)
    const slugs = notes.map((n) => n.slug)
    for (const s of L3_SLUGS) expect(slugs).not.toContain(s)
  })
})

describe('listNotes() — REGRESSION: missing config file → full behaviour', () => {
  it('returns all 10 notes when config file is absent (back-compat)', () => {
    // tmpConfigDir has no meshblog.config.json — loadMeshblogConfig falls back to 'full'
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const notes = listNotes()
    expect(notes.length).toBe(10)
    // Confirm warn was emitted (proves fallback path ran)
    expect(warnSpy).toHaveBeenCalled()
    expect(warnSpy.mock.calls[0][0]).toContain('not found')
  })
})

// ── listAllNoteSlugs() ────────────────────────────────────────────────────────

describe('listAllNoteSlugs() — ignores l3Visibility', () => {
  it('returns 10 slugs in full mode', () => {
    writeFileSync(join(tmpConfigDir, 'meshblog.config.json'), JSON.stringify({ l3Visibility: 'full' }))
    const slugs = listAllNoteSlugs()
    expect(slugs.length).toBe(10)
  })

  it('returns 10 slugs in keyword-only mode', () => {
    writeFileSync(join(tmpConfigDir, 'meshblog.config.json'), JSON.stringify({ l3Visibility: 'keyword-only' }))
    const slugs = listAllNoteSlugs()
    expect(slugs.length).toBe(10)
  })

  it('returns 10 slugs in hidden mode', () => {
    writeFileSync(join(tmpConfigDir, 'meshblog.config.json'), JSON.stringify({ l3Visibility: 'hidden' }))
    const slugs = listAllNoteSlugs()
    expect(slugs.length).toBe(10)
  })
})

// ── listNotesByCategory() ─────────────────────────────────────────────────────

describe('listNotesByCategory("engineering")', () => {
  it('full mode — returns all 10 notes in engineering', () => {
    writeFileSync(join(tmpConfigDir, 'meshblog.config.json'), JSON.stringify({ l3Visibility: 'full' }))
    const notes = listNotesByCategory('engineering')
    expect(notes.length).toBe(10)
  })

  it('keyword-only mode — returns 6 notes (L3 stripped)', () => {
    writeFileSync(join(tmpConfigDir, 'meshblog.config.json'), JSON.stringify({ l3Visibility: 'keyword-only' }))
    const notes = listNotesByCategory('engineering')
    expect(notes.length).toBe(6)
    const slugs = notes.map((n) => n.slug)
    for (const s of L3_SLUGS) expect(slugs).not.toContain(s)
  })

  it('hidden mode — returns 6 notes (L3 excluded)', () => {
    writeFileSync(join(tmpConfigDir, 'meshblog.config.json'), JSON.stringify({ l3Visibility: 'hidden' }))
    const notes = listNotesByCategory('engineering')
    expect(notes.length).toBe(6)
  })
})
