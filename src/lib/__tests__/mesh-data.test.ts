/**
 * mesh-data.test.ts
 *
 * Tests for getNoteMeshNodes — the two-tier (wikilink → entity) fallback.
 *
 * Strategy:
 *  - Mock `node:fs` so loadJson returns controlled backlinks.json content.
 *  - Mock `./pages/db` (openReadonlyDb) to return an in-memory SQLite DB.
 *  - Each test case populates the in-memory DB with the fixture it needs.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import Database from 'better-sqlite3'

// ── Hoisted mocks (must be declared before importing the module under test) ──

// We'll swap the return value of openReadonlyDb per-test via this variable.
let __mockDb: ReturnType<typeof Database> | null = null

vi.mock('../pages/db', () => ({
  openReadonlyDb: () => __mockDb,
  DB_PATH: ':memory:',
}))

// We'll swap loadJson output by controlling existsSync + readFileSync.
let __backlinkJson: string | null = null

vi.mock('node:fs', () => ({
  existsSync: (p: string) => {
    if (p.includes('backlinks.json')) return __backlinkJson !== null
    return false
  },
  readFileSync: (p: string) => {
    if (p.includes('backlinks.json') && __backlinkJson !== null) return __backlinkJson
    throw new Error(`readFileSync mock: unexpected path ${p}`)
  },
}))

// Import AFTER mocks are registered.
import { getNoteMeshNodes } from '../mesh-data'

// ── Helper: create an in-memory SQLite DB with the minimal schema ─────────────

function makeDb(): ReturnType<typeof Database> {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE notes (
      id   TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE entities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    );
    CREATE TABLE note_entities (
      note_id   TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      PRIMARY KEY (note_id, entity_id)
    );
  `)
  return db
}

function insertNote(
  db: ReturnType<typeof Database>,
  id: string,
  slug: string,
  title: string,
  content: string = `Body of ${title}.`,
) {
  db.prepare('INSERT INTO notes (id, slug, title, content) VALUES (?, ?, ?, ?)').run(id, slug, title, content)
}

function insertEntity(db: ReturnType<typeof Database>, id: number, name: string) {
  db.prepare('INSERT INTO entities (id, name) VALUES (?, ?)').run(id, name)
}

function insertNoteEntity(db: ReturnType<typeof Database>, noteId: string, entityId: number) {
  db.prepare('INSERT INTO note_entities (note_id, entity_id) VALUES (?, ?)').run(noteId, entityId)
}

function wb(p: string) {
  return `/meshblog${p}`
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  __backlinkJson = null
  __mockDb = null
})

describe('getNoteMeshNodes', () => {
  // ── Case A: wikilinks present → primary path ──────────────────────────────
  describe('Case A: wikilinks present → primary path used', () => {
    it('returns center + neighbors from backlinks.json when inbound edges exist', () => {
      __backlinkJson = JSON.stringify({
        nodes: [
          { id: 'note-a', title: 'Note A' },
          { id: 'note-b', title: 'Note B' },
          { id: 'note-c', title: 'Note C' },
        ],
        edges: [
          { source: 'note-b', target: 'note-a' }, // inbound to note-a
          { source: 'note-c', target: 'note-a' }, // inbound to note-a
        ],
      })
      // DB should NOT be queried (entity fallback skipped when wikilinks found)
      __mockDb = null

      const nodes = getNoteMeshNodes({
        noteId: 'note-a',
        noteTitle: 'Note A',
        withBase: wb,
      })

      expect(nodes).toHaveLength(3) // center + 2 neighbors
      expect(nodes[0]).toMatchObject({ label: 'Note A', kind: 'selected' })
      expect(nodes[0].href).toBeUndefined()
      expect(nodes[1]).toMatchObject({ label: 'Note B', kind: 'note', href: '/meshblog/notes/note-b' })
      expect(nodes[2]).toMatchObject({ label: 'Note C', kind: 'note', href: '/meshblog/notes/note-c' })
    })

    it('also picks up outbound edges when inbound are absent for a note', () => {
      __backlinkJson = JSON.stringify({
        nodes: [
          { id: 'note-x', title: 'Note X' },
          { id: 'note-y', title: 'Note Y' },
        ],
        edges: [
          { source: 'note-x', target: 'note-y' }, // outbound from note-x
        ],
      })
      __mockDb = null

      const nodes = getNoteMeshNodes({
        noteId: 'note-x',
        noteTitle: 'Note X',
        withBase: wb,
      })

      expect(nodes).toHaveLength(2)
      expect(nodes[0]).toMatchObject({ label: 'Note X', kind: 'selected' })
      expect(nodes[1]).toMatchObject({ label: 'Note Y', kind: 'note', href: '/meshblog/notes/note-y' })
    })

    // ── New tests: enrichNeighborsFromDb code paths ───────────────────────────

    it('enriches wikilink neighbors with excerpt + readingMinutes when DB has content', () => {
      const body = 'This is the body of note B. '.repeat(10) // ~280 chars
      __backlinkJson = JSON.stringify({
        nodes: [
          { id: 'note-a', title: 'Note A' },
          { id: 'note-b', title: 'Note B' },
        ],
        edges: [
          { source: 'note-b', target: 'note-a' }, // inbound to note-a
        ],
      })
      const db = makeDb()
      insertNote(db, 'note-b', 'note-b', 'Note B', body)
      __mockDb = db

      const nodes = getNoteMeshNodes({
        noteId: 'note-a',
        noteTitle: 'Note A',
        withBase: wb,
      })

      expect(nodes).toHaveLength(2)
      const neighbor = nodes[1]
      expect(neighbor.kind).toBe('note')
      expect(typeof neighbor.excerpt).toBe('string')
      expect(neighbor.excerpt!.length).toBeGreaterThan(0)
      expect(neighbor.excerpt!.length).toBeLessThanOrEqual(160)
      expect(typeof neighbor.readingMinutes).toBe('number')
      expect(neighbor.readingMinutes!).toBeGreaterThan(0)

      db.close()
    })

    it('marks neighbor as kind="stub" when DB row exists with empty content', () => {
      __backlinkJson = JSON.stringify({
        nodes: [
          { id: 'note-a', title: 'Note A' },
          { id: 'note-c', title: 'Note C' },
        ],
        edges: [
          { source: 'note-c', target: 'note-a' }, // inbound to note-a
        ],
      })
      const db = makeDb()
      insertNote(db, 'note-c', 'note-c', 'Note C', '') // empty content → stub
      __mockDb = db

      const nodes = getNoteMeshNodes({
        noteId: 'note-a',
        noteTitle: 'Note A',
        withBase: wb,
      })

      expect(nodes).toHaveLength(2)
      const neighbor = nodes[1]
      expect(neighbor.kind).toBe('stub')
      expect(neighbor.excerpt).toBeUndefined()

      db.close()
    })

    it('falls back to kind="note" when DB row missing (graceful for fixture-mode/test envs)', () => {
      __backlinkJson = JSON.stringify({
        nodes: [
          { id: 'note-a', title: 'Note A' },
          { id: 'note-d', title: 'Note D' },
        ],
        edges: [
          { source: 'note-d', target: 'note-a' },
        ],
      })
      // DB exists but note-d row is absent — simulates fixture mode missing the note
      const db = makeDb()
      // note-d intentionally NOT inserted
      __mockDb = db

      const nodes = getNoteMeshNodes({
        noteId: 'note-a',
        noteTitle: 'Note A',
        withBase: wb,
      })

      expect(nodes).toHaveLength(2)
      const neighbor = nodes[1]
      expect(neighbor.kind).toBe('note') // no row → not a stub
      expect(neighbor.excerpt).toBeUndefined()

      db.close()
    })

    it('populates backlinks count from inboundMap', () => {
      __backlinkJson = JSON.stringify({
        nodes: [
          { id: 'note-a', title: 'Note A' },
          { id: 'note-b', title: 'Note B' },
          { id: 'note-e', title: 'Note E' },
          { id: 'note-f', title: 'Note F' },
        ],
        edges: [
          { source: 'note-b', target: 'note-a' }, // note-b is a neighbor of note-a
          { source: 'note-e', target: 'note-b' }, // inbound to note-b
          { source: 'note-f', target: 'note-b' }, // inbound to note-b → 2 total
        ],
      })
      const db = makeDb()
      insertNote(db, 'note-b', 'note-b', 'Note B', 'Content of note B.')
      __mockDb = db

      const nodes = getNoteMeshNodes({
        noteId: 'note-a',
        noteTitle: 'Note A',
        withBase: wb,
      })

      expect(nodes).toHaveLength(2)
      const neighbor = nodes[1]
      expect(neighbor.backlinks).toBe(2)

      db.close()
    })

    it('relationship is "backlink" for inbound edges and "outbound" for outbound edges', () => {
      __backlinkJson = JSON.stringify({
        nodes: [
          { id: 'center', title: 'Center' },
          { id: 'src-note', title: 'Source Note' },  // points AT center → backlink
          { id: 'dst-note', title: 'Dest Note' },    // center points to it → outbound
        ],
        edges: [
          { source: 'src-note', target: 'center' },  // inbound
          { source: 'center',   target: 'dst-note' }, // outbound
        ],
      })
      __mockDb = null

      const nodes = getNoteMeshNodes({
        noteId: 'center',
        noteTitle: 'Center',
        withBase: wb,
      })

      expect(nodes).toHaveLength(3)
      const backlinker = nodes.find((n) => n.label === 'Source Note')!
      const outbounder = nodes.find((n) => n.label === 'Dest Note')!
      expect(backlinker.relationship).toBe('backlink')
      expect(outbounder.relationship).toBe('outbound')
    })
  })

  // ── Case B: no wikilinks, entities shared → fallback returns neighbors ─────
  describe('Case B: no wikilinks, shared entities → entity fallback', () => {
    it('returns center + entity-related notes ordered by overlap count descending', () => {
      // No backlinks.json
      __backlinkJson = null

      const db = makeDb()
      insertNote(db, 'center-note', 'center-note', 'Center Note')
      insertNote(db, 'sibling-1',  'sibling-1',  'Sibling One')  // shares 2 entities
      insertNote(db, 'sibling-2',  'sibling-2',  'Sibling Two')  // shares 1 entity

      insertEntity(db, 1, 'entity-alpha')
      insertEntity(db, 2, 'entity-beta')
      insertEntity(db, 3, 'entity-gamma')

      // center: entities 1, 2, 3
      insertNoteEntity(db, 'center-note', 1)
      insertNoteEntity(db, 'center-note', 2)
      insertNoteEntity(db, 'center-note', 3)
      // sibling-1: shares entities 1 and 2 → overlap = 2
      insertNoteEntity(db, 'sibling-1', 1)
      insertNoteEntity(db, 'sibling-1', 2)
      // sibling-2: shares entity 3 only → overlap = 1
      insertNoteEntity(db, 'sibling-2', 3)

      __mockDb = db

      const nodes = getNoteMeshNodes({
        noteId: 'center-note',
        noteTitle: 'Center Note',
        withBase: wb,
      })

      expect(nodes).toHaveLength(3) // center + 2 neighbors
      expect(nodes[0]).toMatchObject({ label: 'Center Note', kind: 'selected' })
      expect(nodes[0].href).toBeUndefined()
      // sibling-1 has higher overlap → comes first
      expect(nodes[1]).toMatchObject({ label: 'Sibling One', kind: 'note', href: '/meshblog/notes/sibling-1' })
      expect(nodes[2]).toMatchObject({ label: 'Sibling Two', kind: 'note', href: '/meshblog/notes/sibling-2' })

      db.close()
    })

    it('caps entity neighbors at MAX_NEIGHBORS (5)', () => {
      __backlinkJson = null

      const db = makeDb()
      insertNote(db, 'hub', 'hub', 'Hub Note')
      for (let i = 1; i <= 7; i++) {
        insertNote(db, `peer-${i}`, `peer-${i}`, `Peer ${i}`)
      }
      insertEntity(db, 1, 'shared-entity')
      insertNoteEntity(db, 'hub', 1)
      for (let i = 1; i <= 7; i++) {
        insertNoteEntity(db, `peer-${i}`, 1)
      }

      __mockDb = db

      const nodes = getNoteMeshNodes({
        noteId: 'hub',
        noteTitle: 'Hub Note',
        withBase: wb,
      })

      // center + max 5 neighbors, even though 7 peers exist
      expect(nodes).toHaveLength(6)
      expect(nodes[0]).toMatchObject({ label: 'Hub Note', kind: 'selected' })

      db.close()
    })

    it('orders ties by note.id alphabetically for determinism', () => {
      __backlinkJson = null

      const db = makeDb()
      insertNote(db, 'anchor', 'anchor', 'Anchor')
      insertNote(db, 'zebra',  'zebra',  'Zebra')   // id: 'zebra'
      insertNote(db, 'alpha',  'alpha',  'Alpha')   // id: 'alpha' → sorts before 'zebra'

      insertEntity(db, 1, 'ent')
      insertNoteEntity(db, 'anchor', 1)
      insertNoteEntity(db, 'zebra',  1) // overlap = 1
      insertNoteEntity(db, 'alpha',  1) // overlap = 1, same as zebra

      __mockDb = db

      const nodes = getNoteMeshNodes({
        noteId: 'anchor',
        noteTitle: 'Anchor',
        withBase: wb,
      })

      expect(nodes).toHaveLength(3)
      // Tie-break: 'alpha' < 'zebra' lexicographically
      expect(nodes[1]).toMatchObject({ label: 'Alpha' })
      expect(nodes[2]).toMatchObject({ label: 'Zebra' })

      db.close()
    })

    it('entity-path neighbors include excerpt and readingMinutes when content is non-empty', () => {
      // insertNote uses `Body of ${title}.` as default content — confirms enrichment.
      __backlinkJson = null

      const db = makeDb()
      insertNote(db, 'hub-note', 'hub-note', 'Hub Note')
      insertNote(db, 'peer-note', 'peer-note', 'Peer Note') // content = 'Body of Peer Note.'

      insertEntity(db, 1, 'shared-ent')
      insertNoteEntity(db, 'hub-note',  1)
      insertNoteEntity(db, 'peer-note', 1)

      __mockDb = db

      const nodes = getNoteMeshNodes({
        noteId: 'hub-note',
        noteTitle: 'Hub Note',
        withBase: wb,
      })

      expect(nodes).toHaveLength(2)
      const neighbor = nodes[1]
      expect(neighbor.relationship).toBe('entity')
      expect(typeof neighbor.excerpt).toBe('string')
      expect(neighbor.excerpt!.length).toBeGreaterThan(0)
      expect(typeof neighbor.readingMinutes).toBe('number')

      db.close()
    })
  })

  // ── Case C: no wikilinks AND no shared entities → center node only ─────────
  describe('Case C: no wikilinks, no shared entities → center node only', () => {
    it('returns just the center node when entity fallback finds nothing', () => {
      __backlinkJson = null

      const db = makeDb()
      insertNote(db, 'lone-note', 'lone-note', 'Lone Note')
      // No entities at all for lone-note
      __mockDb = db

      const nodes = getNoteMeshNodes({
        noteId: 'lone-note',
        noteTitle: 'Lone Note',
        withBase: wb,
      })

      expect(nodes).toHaveLength(1)
      expect(nodes[0]).toMatchObject({ label: 'Lone Note', kind: 'selected' })

      db.close()
    })

    it('returns just the center node when DB is unavailable (null)', () => {
      __backlinkJson = null
      __mockDb = null

      const nodes = getNoteMeshNodes({
        noteId: 'any-note',
        noteTitle: 'Any Note',
        withBase: wb,
      })

      expect(nodes).toHaveLength(1)
      expect(nodes[0]).toMatchObject({ label: 'Any Note', kind: 'selected' })
    })
  })
})
