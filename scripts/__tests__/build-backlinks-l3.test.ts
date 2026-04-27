/**
 * build-backlinks-l3.test.ts — L3 visibility filtering in backlinks.json output.
 *
 * 3 test cases — one per mode (full / keyword-only / hidden).
 * Seed: 2 L1 notes + 2 L3 notes + wikilinks between them.
 * Verifies that nodes/edges in the JSON output respect the mode.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { join } from 'node:path'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { createDb, execute } from '../../src/lib/db/index.ts'
import { __resetConfigCache } from '../../src/lib/config.ts'
import { runBuildBacklinks } from '../build-backlinks.ts'

// ── Temp dir for DB and output files ──────────────────────────────────────────

const TMP_DIR = '.data/test-build-backlinks-l3'
mkdirSync(TMP_DIR, { recursive: true })

// ── Fixture helpers ───────────────────────────────────────────────────────────

const L1_SLUGS = ['l1-alpha', 'l1-beta']
const L3_SLUGS = ['l3-gamma', 'l3-delta']

function buildFixtureDb(dbPath: string): ReturnType<typeof createDb> {
  const db = createDb(dbPath)

  // Seed notes
  for (const slug of [...L1_SLUGS, ...L3_SLUGS]) {
    execute(db,
      `INSERT OR REPLACE INTO notes
         (id, slug, title, content, content_hash, graph_status)
       VALUES (?, ?, ?, ?, ?, 'done')`,
      [slug, slug, `Title ${slug}`, `Content linking to [[l3-gamma]] and [[l3-delta]]`, `hash-${slug}`]
    )
  }

  // L1 notes link to L3 notes (so L3 nodes appear as targets)
  // L3 note l3-gamma also links back to l1-alpha (L3 as source)
  execute(db,
    `UPDATE notes SET content = 'L3 links back to [[l1-alpha]] here.' WHERE id = 'l3-gamma'`,
    []
  )

  // Seed graph_levels
  const insert = db.prepare(
    `INSERT OR IGNORE INTO graph_levels (graph_type, node_id, level, pagerank) VALUES (?, ?, ?, ?)`
  )
  for (const s of L1_SLUGS) insert.run('note', s, 1, 0.9)
  for (const s of L3_SLUGS) insert.run('note', s, 3, 0.1)

  return db
}

// ── Config dir ────────────────────────────────────────────────────────────────

let savedCwd: string
let tmpConfigDir: string
let db: ReturnType<typeof createDb>
let dbPath: string
let outputDir: string

beforeEach(() => {
  const ts = Date.now()
  dbPath = join(TMP_DIR, `test-${ts}.db`)
  outputDir = join(TMP_DIR, `out-${ts}`)
  mkdirSync(outputDir, { recursive: true })
  db = buildFixtureDb(dbPath)

  savedCwd = process.cwd()
  tmpConfigDir = mkdtempSync(join(tmpdir(), 'meshblog-bb-l3-test-'))
  process.chdir(tmpConfigDir)
  __resetConfigCache()
})

afterEach(() => {
  db.close()
  process.chdir(savedCwd)
  try { rmSync(dbPath) } catch { /* ok */ }
  try { rmSync(outputDir, { recursive: true, force: true }) } catch { /* ok */ }
  try { rmSync(tmpConfigDir, { recursive: true, force: true }) } catch { /* ok */ }
  vi.restoreAllMocks()
  __resetConfigCache()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('runBuildBacklinks — full mode', () => {
  it('includes all nodes and edges (L3 nodes present)', () => {
    writeFileSync(join(tmpConfigDir, 'meshblog.config.json'), JSON.stringify({ l3Visibility: 'full' }))

    const json = runBuildBacklinks({ db, outputDir, dryRun: false })

    const nodeIds = json.nodes.map((n) => n.id)
    // All four notes participate in links — all should appear as nodes
    expect(nodeIds).toContain('l3-gamma')
    expect(nodeIds).toContain('l3-delta')
    expect(nodeIds).toContain('l1-alpha')

    // There must be edges involving L3 nodes
    const l3Edges = json.edges.filter(
      (e) => L3_SLUGS.includes(e.source) || L3_SLUGS.includes(e.target)
    )
    expect(l3Edges.length).toBeGreaterThan(0)
  })
})

describe('runBuildBacklinks — keyword-only mode', () => {
  it('includes L3 nodes and edges (same as full — graph still shows them)', () => {
    writeFileSync(join(tmpConfigDir, 'meshblog.config.json'), JSON.stringify({ l3Visibility: 'keyword-only' }))

    const json = runBuildBacklinks({ db, outputDir, dryRun: false })

    const nodeIds = json.nodes.map((n) => n.id)
    expect(nodeIds).toContain('l3-gamma')
    expect(nodeIds).toContain('l3-delta')

    const l3Edges = json.edges.filter(
      (e) => L3_SLUGS.includes(e.source) || L3_SLUGS.includes(e.target)
    )
    expect(l3Edges.length).toBeGreaterThan(0)
  })
})

describe('runBuildBacklinks — hidden mode', () => {
  it('drops L3 nodes and any edges incident to L3 nodes', () => {
    writeFileSync(join(tmpConfigDir, 'meshblog.config.json'), JSON.stringify({ l3Visibility: 'hidden' }))

    const json = runBuildBacklinks({ db, outputDir, dryRun: false })

    const nodeIds = json.nodes.map((n) => n.id)
    // L3 nodes must not appear
    for (const s of L3_SLUGS) {
      expect(nodeIds).not.toContain(s)
    }

    // No edges may touch an L3 node
    for (const edge of json.edges) {
      expect(L3_SLUGS).not.toContain(edge.source)
      expect(L3_SLUGS).not.toContain(edge.target)
    }
  })
})
