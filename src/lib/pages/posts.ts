// posts.ts — public blog post reader
//
// "Posts" are notes whose folder_path matches the posts directory.
// Convention (from seed.sql and plan §Task 1 Step 2):
//   folder_path = 'content/posts'  (vault-relative, no leading slash)
// If a vault uses a leading slash ('/posts'), that variant is NOT matched here.
// Adjust POSTS_FOLDER if your Obsidian vault uses a different path.
//
// level_pin: also present on the schema (INTEGER, frontmatter override 1|2|3|NULL)
// but posts vs notes is primarily discriminated by folder_path, not level_pin.
// level_pin drives display prominence within posts (L1 = featured), not inclusion.

import { openReadonlyDb } from './db'

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
  has_en: number
  body_en: string | null
  title_en: string | null
}

const POSTS_FOLDER = 'content/posts'

function parseRow(row: any): PostRow {
  return {
    ...row,
    tags: row.tags ? JSON.parse(row.tags) : [],
  }
}

export function listPosts(): PostRow[] {
  const db = openReadonlyDb()
  if (!db) return []
  try {
    const rows = db
      .prepare(
        `SELECT id, slug, title, content, tags, created_at, updated_at, level_pin, category_slug, has_en, body_en, title_en
         FROM notes
         WHERE folder_path = ?
         ORDER BY created_at DESC`
      )
      .all(POSTS_FOLDER) as any[]
    return rows.map(parseRow)
  } finally {
    db.close()
  }
}

/**
 * listTopTags — aggregate tag counts across a posts array (pure in-memory, no DB).
 *
 * Normalization: each tag is trimmed + lowercased for COUNTING, but the most-common
 * original casing is preserved for display. Sorted by count desc, ties alphabetically.
 * Capped at `limit` (default 16 — visual budget for ~4 rows in a 240px sidebar column).
 */
export function listTopTags(
  posts: PostRow[],
  limit = 16
): Array<{ tag: string; count: number }> {
  // counts keyed by normalized (trimmed + lowercase) form
  const countByNorm = new Map<string, number>()
  // best original casing: first occurrence wins unless a later casing appears more often
  const canonByNorm = new Map<string, Map<string, number>>()

  for (const post of posts) {
    for (const raw of post.tags ?? []) {
      const norm = raw.trim().toLowerCase()
      if (!norm) continue
      // count
      countByNorm.set(norm, (countByNorm.get(norm) ?? 0) + 1)
      // track per-casing frequency for display
      if (!canonByNorm.has(norm)) canonByNorm.set(norm, new Map())
      const casingMap = canonByNorm.get(norm)!
      const trimmed = raw.trim()
      casingMap.set(trimmed, (casingMap.get(trimmed) ?? 0) + 1)
    }
  }

  // Build result: pick the most-frequent original casing for each norm key
  const result: Array<{ tag: string; count: number }> = []
  for (const [norm, count] of countByNorm) {
    const casingMap = canonByNorm.get(norm)!
    // most common original casing; tie-break by the casing string itself (stable)
    let bestCasing = norm
    let bestCasingCount = 0
    for (const [casing, casingCount] of casingMap) {
      if (casingCount > bestCasingCount || (casingCount === bestCasingCount && casing < bestCasing)) {
        bestCasing = casing
        bestCasingCount = casingCount
      }
    }
    result.push({ tag: bestCasing, count })
  }

  // Sort by count desc, ties alphabetically (case-insensitive)
  result.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count
    return a.tag.toLowerCase().localeCompare(b.tag.toLowerCase())
  })

  return result.slice(0, limit)
}

export function getPostBySlug(slug: string): PostRow | null {
  const db = openReadonlyDb()
  if (!db) return null
  try {
    const row = db
      .prepare(
        `SELECT id, slug, title, content, tags, created_at, updated_at, level_pin, category_slug, has_en, body_en, title_en
         FROM notes
         WHERE slug = ? AND folder_path = ?
         LIMIT 1`
      )
      .get(slug, POSTS_FOLDER) as any
    return row ? parseRow(row) : null
  } finally {
    db.close()
  }
}
