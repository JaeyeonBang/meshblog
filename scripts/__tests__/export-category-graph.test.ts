/**
 * export-category-graph.test.ts — Task K taxonomy JSON export
 */
import { describe, it, expect, beforeEach } from "vitest"
import { existsSync, readFileSync, unlinkSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { createDb, execute } from "../../src/lib/db/index.ts"
import {
  buildCategoryGraph,
  runExportCategoryGraph,
  type CategoryGraphJson,
} from "../export-category-graph.ts"

const TMP_DIR = ".data/test-export-category-graph"
const TMP_DB = join(TMP_DIR, "cat-graph.db")

function seedFixture(db: ReturnType<typeof createDb>) {
  // Categories
  execute(db, `INSERT OR IGNORE INTO categories (slug, name, note_count, post_count) VALUES ('engineering', 'Engineering', 3, 1)`, [])
  execute(db, `INSERT OR IGNORE INTO categories (slug, name, note_count, post_count) VALUES ('ai', 'AI', 2, 0)`, [])
  execute(db, `INSERT OR IGNORE INTO categories (slug, name, note_count, post_count) VALUES ('writing', 'Writing', 1, 1)`, [])

  // Notes (content/notes)
  for (const [slug, title, cat] of [
    ['ts-generics', 'TS Generics', 'engineering'],
    ['sqlite-patterns', 'SQLite Patterns', 'engineering'],
    ['graph-algorithms', 'Graph Algorithms', 'engineering'],
    ['rag-overview', 'RAG Overview', 'ai'],
    ['llm-patterns', 'LLM Patterns', 'ai'],
    ['writing-philosophy', 'Writing Philosophy', 'writing'],
  ]) {
    execute(db, `
      INSERT OR IGNORE INTO notes (id, slug, title, content, content_hash, folder_path, category_slug, graph_status)
      VALUES (?, ?, ?, 'content', 'hash', 'content/notes', ?, 'done')
    `, [slug, slug, title, cat])
  }

  // Post (content/posts)
  execute(db, `
    INSERT OR IGNORE INTO notes (id, slug, title, content, content_hash, folder_path, category_slug, graph_status)
    VALUES ('post-eng', 'post-eng', 'Engineering Post', 'content', 'hashp1', 'content/posts', 'engineering', 'done')
  `, [])
  execute(db, `
    INSERT OR IGNORE INTO notes (id, slug, title, content, content_hash, folder_path, category_slug, graph_status)
    VALUES ('post-writing', 'post-writing', 'Writing Post', 'content', 'hashp2', 'content/posts', 'writing', 'done')
  `, [])
}

describe("export-category-graph", () => {
  let db: ReturnType<typeof createDb>

  beforeEach(() => {
    mkdirSync(TMP_DIR, { recursive: true })
    if (existsSync(TMP_DB)) unlinkSync(TMP_DB)
    db = createDb(TMP_DB)
    seedFixture(db)
  })

  it("buildCategoryGraph returns 3 categories sorted by count desc", () => {
    const result = buildCategoryGraph(db)
    expect(result.categories).toHaveLength(3)
    // engineering has 4 total (3+1), ai has 2, writing has 2
    expect(result.categories[0].id).toBe('engineering')
    expect(result.categories[0].noteCount).toBe(3)
    expect(result.categories[0].postCount).toBe(1)
  })

  it("notesByCategory contains notes under correct slugs", () => {
    const result = buildCategoryGraph(db)
    expect(result.notesByCategory['engineering']).toHaveLength(3)
    expect(result.notesByCategory['ai']).toHaveLength(2)
    expect(result.notesByCategory['writing']).toHaveLength(1)
  })

  it("postsByCategory contains posts under correct slugs", () => {
    const result = buildCategoryGraph(db)
    expect(result.postsByCategory['engineering']).toHaveLength(1)
    expect(result.postsByCategory['engineering'][0].id).toBe('post-eng')
    expect(result.postsByCategory['writing']).toHaveLength(1)
    expect(result.postsByCategory['ai']).toBeUndefined()
  })

  it("runExportCategoryGraph writes categories.json", async () => {
    const outDir = join(TMP_DIR, "graph-out")
    await runExportCategoryGraph(db, outDir)

    const filePath = join(outDir, "categories.json")
    expect(existsSync(filePath)).toBe(true)

    const json = JSON.parse(readFileSync(filePath, "utf-8")) as CategoryGraphJson
    expect(Array.isArray(json.categories)).toBe(true)
    expect(typeof json.postsByCategory).toBe('object')
    expect(typeof json.notesByCategory).toBe('object')
    expect(json.categories.length).toBe(3)
  })

  it("empty vault: categories.json has empty arrays/objects", async () => {
    const emptyDb = createDb(join(TMP_DIR, "empty.db"))
    const outDir = join(TMP_DIR, "graph-out-empty")
    await runExportCategoryGraph(emptyDb, outDir)
    emptyDb.close()

    const json = JSON.parse(readFileSync(join(outDir, "categories.json"), "utf-8")) as CategoryGraphJson
    expect(json.categories).toEqual([])
    expect(json.postsByCategory).toEqual({})
    expect(json.notesByCategory).toEqual({})
  })

  it("each category node has id, label, noteCount, postCount", () => {
    const result = buildCategoryGraph(db)
    for (const cat of result.categories) {
      expect(cat).toHaveProperty('id')
      expect(cat).toHaveProperty('label')
      expect(typeof cat.noteCount).toBe('number')
      expect(typeof cat.postCount).toBe('number')
    }
  })
})
