/**
 * export-category-graph.ts — Build taxonomy-hierarchy JSON for the graph page.
 *
 * Emits public/graph/categories.json with shape:
 *   {
 *     categories: CategoryNode[],
 *     postsByCategory: Record<slug, PostNode[]>,
 *     notesByCategory: Record<slug, NoteNode[]>,
 *   }
 *
 * GraphView.tsx loads this once and filters client-side by current L + selected
 * category slug (Option B — one file, instant drill-down, no refetch).
 *
 * Also keeps the old ${mode}-l{level}.json files untouched — nothing breaks that
 * still consumes those.
 */
import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { createDb, queryMany, type Database } from "../src/lib/db/index.ts"

const DB_PATH = process.env.MESHBLOG_DB ?? ".data/index.db"
const GRAPH_DIR = "public/graph"

export type CategoryNode = {
  id: string          // == slug
  label: string       // display name
  noteCount: number
  postCount: number
}

export type PostNode = {
  id: string          // slug
  label: string       // title
  categorySlug: string
}

export type NoteNode = {
  id: string          // slug
  label: string       // title
  categorySlug: string
}

export type CategoryGraphJson = {
  categories: CategoryNode[]
  postsByCategory: Record<string, PostNode[]>
  notesByCategory: Record<string, NoteNode[]>
}

// ── Builders ──────────────────────────────────────────────────────────────────

export function buildCategoryGraph(db: Database.Database): CategoryGraphJson {
  // L1 — categories
  const catRows = queryMany<{
    slug: string
    name: string
    note_count: number
    post_count: number
  }>(
    db,
    `SELECT slug, name, note_count, post_count
     FROM categories
     ORDER BY (note_count + post_count) DESC, slug ASC`,
    [],
  )

  const categories: CategoryNode[] = catRows.map(r => ({
    id: r.slug,
    label: r.name,
    noteCount: r.note_count,
    postCount: r.post_count,
  }))

  // L2 — posts per category
  const postRows = queryMany<{
    id: string
    slug: string
    title: string
    category_slug: string
  }>(
    db,
    `SELECT id, slug, title, category_slug
     FROM notes
     WHERE folder_path = 'content/posts'
       AND category_slug IS NOT NULL
     ORDER BY created_at DESC`,
    [],
  )

  const postsByCategory: Record<string, PostNode[]> = {}
  for (const r of postRows) {
    const bucket = (postsByCategory[r.category_slug] ??= [])
    bucket.push({
      id: r.slug,
      label: r.title,
      categorySlug: r.category_slug,
    })
  }

  // L3 — notes per category
  const noteRows = queryMany<{
    id: string
    slug: string
    title: string
    category_slug: string
  }>(
    db,
    `SELECT id, slug, title, category_slug
     FROM notes
     WHERE folder_path = 'content/notes'
       AND category_slug IS NOT NULL
     ORDER BY updated_at DESC`,
    [],
  )

  const notesByCategory: Record<string, NoteNode[]> = {}
  for (const r of noteRows) {
    const bucket = (notesByCategory[r.category_slug] ??= [])
    bucket.push({
      id: r.slug,
      label: r.title,
      categorySlug: r.category_slug,
    })
  }

  return { categories, postsByCategory, notesByCategory }
}

// ── Runner (exported for tests) ───────────────────────────────────────────────

export async function runExportCategoryGraph(
  db: Database.Database,
  outputDir: string = GRAPH_DIR,
): Promise<CategoryGraphJson> {
  mkdirSync(outputDir, { recursive: true })

  const json = buildCategoryGraph(db)

  const outPath = join(outputDir, "categories.json")
  writeFileSync(outPath, JSON.stringify(json, null, 2))

  console.log(
    `[export-category-graph] ${outPath}: ` +
    `${json.categories.length} categories, ` +
    `${Object.values(json.postsByCategory).flat().length} posts, ` +
    `${Object.values(json.notesByCategory).flat().length} notes`,
  )

  return json
}

// ── CLI entry ─────────────────────────────────────────────────────────────────

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("export-category-graph.ts")

if (isMainModule) {
  const db = createDb(DB_PATH)
  runExportCategoryGraph(db, GRAPH_DIR)
    .then(() => {
      db.close()
      console.log("[export-category-graph] done")
    })
    .catch((err) => {
      db.close()
      console.error("[export-category-graph] FATAL:", err)
      process.exit(1)
    })
}
