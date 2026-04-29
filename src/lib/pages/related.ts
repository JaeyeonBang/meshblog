// related.ts — entity-overlap based related notes
//
// Schema: note_entities(note_id, entity_id) — junction table.
// Strategy: for a given note, find other notes that share the most entities,
// ranked by shared entity count descending, then by updated_at descending.
// The input note itself is excluded via the JOIN predicate.
//
// Tag-overlap fallback: when entity overlap returns 0 results, pivot the
// JSON-encoded `notes.tags` column via SQLite JSON1 and return up to `limit`
// notes ordered by shared-tag-count DESC, updated_at DESC.

import Database from 'better-sqlite3'
import { openReadonlyDb } from './db'

export type RelatedNote = {
  id: string
  slug: string
  title: string
  score: number  // shared entity count (or shared tag count for the fallback)
}

type DatabaseInstance = Database.Database

/**
 * Tag-overlap fallback query.
 *
 * Uses SQLite JSON1 (`json_each`) to pivot the JSON-encoded `tags` column.
 * Returns notes ordered by shared-tag-count DESC, then updated_at DESC.
 *
 * If `db` is provided the caller is responsible for closing it; otherwise
 * this function opens its own connection and closes it in `finally`.
 *
 * Degrades gracefully to `[]` when:
 * - The DB file does not exist (openReadonlyDb returns null)
 * - JSON1 is not compiled into the SQLite build (prepare/all throws)
 * - The source note has no tags
 */
export function getTagOverlapNeighbors(
  noteId: string,
  limit: number,
  db?: DatabaseInstance,
): RelatedNote[] {
  const ownDb = !db
  const conn = db ?? openReadonlyDb()
  if (!conn) return []
  try {
    const rows = conn
      .prepare(
        `SELECT n.id, n.slug, n.title, COUNT(DISTINCT t2.value) AS score
         FROM notes src,
              json_each(src.tags) t1
         JOIN notes n
         JOIN json_each(n.tags) t2 ON LOWER(t2.value) = LOWER(t1.value)
         WHERE src.id = ?
           AND n.id != src.id
           AND n.tags IS NOT NULL
         GROUP BY n.id
         ORDER BY score DESC, n.updated_at DESC
         LIMIT ?`
      )
      .all(noteId, limit) as RelatedNote[]
    return rows
  } catch (e) {
    console.warn('tag-overlap fallback failed:', e)
    return []
  } finally {
    if (ownDb) conn.close()
  }
}

export function getRelatedNotes(noteId: string, limit = 3): RelatedNote[] {
  const db = openReadonlyDb()
  if (!db) return []
  try {
    const rows = db
      .prepare(
        `SELECT n.id, n.slug, n.title, COUNT(DISTINCT ne2.entity_id) AS score
         FROM note_entities ne1
         JOIN note_entities ne2
           ON ne1.entity_id = ne2.entity_id
          AND ne2.note_id != ne1.note_id
         JOIN notes n ON n.id = ne2.note_id
         WHERE ne1.note_id = ?
         GROUP BY n.id
         ORDER BY score DESC, n.updated_at DESC
         LIMIT ?`
      )
      .all(noteId, limit) as RelatedNote[]

    if (rows.length === 0) {
      return getTagOverlapNeighbors(noteId, limit, db)
    }
    return rows
  } finally {
    db.close()
  }
}
