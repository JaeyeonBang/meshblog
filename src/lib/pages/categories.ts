// categories.ts — category taxonomy reader
//
// Categories are aggregated at build-index time from the `category_slug` column
// on the notes table (which covers both notes and posts by folder_path).
//
// A note with no `category` frontmatter field gets a category derived from its
// tags at index time (via TAG_TO_CATEGORY in build-index.ts). Notes that match
// no tag in the map remain NULL (uncategorized) and are excluded from the
// categories table.

import { openReadonlyDb } from './db'
import { loadMeshblogConfig, getL3NoteSlugs, filterL3 } from '../config'

export type CategoryRow = {
  slug: string
  name: string
  noteCount: number
  postCount: number
}

export type NoteRow = {
  id: string
  slug: string
  title: string
  content: string
  tags: string[]
  created_at: string
  updated_at: string
  level_pin: number | null
  category_slug: string | null
}

export type PostRow = {
  id: string
  slug: string
  title: string
  content: string
  tags: string[]
  created_at: string
  updated_at: string
  level_pin: number | null
  category_slug: string | null
}

function parseNoteRow(row: any): NoteRow {
  return {
    ...row,
    tags: row.tags ? JSON.parse(row.tags) : [],
  }
}

/**
 * List all categories ordered by total count (notes + posts) DESC, then slug ASC.
 * Returns an empty array when the DB does not exist or is empty.
 */
export function listCategories(): CategoryRow[] {
  const db = openReadonlyDb()
  if (!db) return []
  try {
    const rows = db
      .prepare(
        `SELECT slug, name, note_count, post_count
         FROM categories
         ORDER BY (note_count + post_count) DESC, slug ASC`
      )
      .all() as Array<{ slug: string; name: string; note_count: number; post_count: number }>
    return rows.map((r) => ({
      slug: r.slug,
      name: r.name,
      noteCount: r.note_count,
      postCount: r.post_count,
    }))
  } finally {
    db.close()
  }
}

/**
 * List notes (folder_path = 'content/notes') that belong to the given category,
 * ordered by updated_at DESC.
 */
export function listNotesByCategory(slug: string): NoteRow[] {
  const db = openReadonlyDb()
  if (!db) return []
  try {
    const rows = db
      .prepare(
        `SELECT id, slug, title, content, tags, created_at, updated_at, level_pin, category_slug
         FROM notes
         WHERE folder_path = 'content/notes'
           AND category_slug = ?
         ORDER BY updated_at DESC`
      )
      .all(slug) as any[]
    const parsed = rows.map(parseNoteRow)
    const { l3Visibility } = loadMeshblogConfig()
    if (l3Visibility === 'full') return parsed
    const l3 = getL3NoteSlugs(db)
    return filterL3(parsed, l3Visibility, l3)
  } finally {
    db.close()
  }
}

/**
 * List posts (folder_path = 'content/posts') that belong to the given category,
 * ordered by created_at DESC.
 */
export function listPostsByCategory(slug: string): PostRow[] {
  const db = openReadonlyDb()
  if (!db) return []
  try {
    const rows = db
      .prepare(
        `SELECT id, slug, title, content, tags, created_at, updated_at, level_pin, category_slug
         FROM notes
         WHERE folder_path = 'content/posts'
           AND category_slug = ?
         ORDER BY created_at DESC`
      )
      .all(slug) as any[]
    return rows.map(parseNoteRow)
  } finally {
    db.close()
  }
}
