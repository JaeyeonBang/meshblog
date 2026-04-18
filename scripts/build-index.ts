import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

import { readdirSync, readFileSync } from "node:fs"
import { join, basename, extname } from "node:path"
import { createHash } from "node:crypto"
import matter from "gray-matter"
import { createDb, queryOne, execute } from "../src/lib/db/index.ts"
import { extractEntities } from "../src/lib/rag/graph.ts"

const DB_PATH = process.env.MESHBLOG_DB ?? ".data/index.db"
const CONTENT_DIRS = ["content/posts", "content/notes"]

export type DiscoveredFile = { path: string; folder: string }

export function discoverMarkdown(baseDirs: string[] = CONTENT_DIRS): DiscoveredFile[] {
  const found: DiscoveredFile[] = []
  for (const dir of baseDirs) {
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      continue
    }
    for (const name of entries) {
      if (name.startsWith("_") || !name.endsWith(".md")) continue
      found.push({ path: join(dir, name), folder: dir })
    }
  }
  return found
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex")
}

export type BuildIndexOptions = {
  dbPath?: string
  baseDirs?: string[]
  extract?: (
    db: ReturnType<typeof createDb>,
    id: string,
    content: string,
  ) => Promise<{ entities: unknown[]; relationships: unknown[] }>
}

export async function runBuildIndex(options: BuildIndexOptions = {}) {
  const dbPath = options.dbPath ?? DB_PATH
  const baseDirs = options.baseDirs ?? CONTENT_DIRS
  const extract = options.extract ?? extractEntities

  console.log(`[build-index] DB: ${dbPath}`)
  const db = createDb(dbPath)

  const files = discoverMarkdown(baseDirs)
  console.log(`[build-index] found ${files.length} markdown files`)

  let processed = 0
  let skipped = 0
  for (const { path, folder } of files) {
    const raw = readFileSync(path, "utf-8")
    const { data: fm, content } = matter(raw)

    if (fm.public === false) {
      console.log(`[build-index] skip (public:false): ${path}`)
      continue
    }

    const slug = basename(path, extname(path))
    const id = slug
    const title = (fm.title as string) ?? slug
    const tags = JSON.stringify(fm.tags ?? [])
    const hash = sha256(content)

    const existing = queryOne<{ content_hash: string }>(
      db,
      "SELECT content_hash FROM notes WHERE id = ?",
      [id],
    )

    execute(
      db,
      `INSERT INTO notes (id, slug, title, content, content_hash, folder_path, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         content = excluded.content,
         content_hash = excluded.content_hash,
         folder_path = excluded.folder_path,
         tags = excluded.tags,
         updated_at = datetime('now')`,
      [id, slug, title, content, hash, folder, tags],
    )

    if (existing && existing.content_hash === hash) {
      console.log(`[build-index] (${++processed}/${files.length}) "${title}" → skipped (unchanged)`)
      skipped++
      continue
    }

    console.log(`[build-index] (${++processed}/${files.length}) extracting entities for "${title}"`)
    const result = await extract(db, id, content)
    console.log(`  → ${result.entities.length} entities, ${result.relationships.length} relationships`)
  }

  const counts = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM notes) AS notes,
      (SELECT COUNT(*) FROM entities) AS entities,
      (SELECT COUNT(*) FROM note_entities) AS note_entities,
      (SELECT COUNT(*) FROM entity_relationships) AS relationships
  `).get() as Record<string, number>

  console.log(`[build-index] done. skipped: ${skipped}/${files.length}. counts:`, counts)
  db.close()
  return { counts, skipped, processed }
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("build-index.ts")

if (isMainModule) {
  runBuildIndex().catch((err) => {
    console.error("[build-index] FATAL:", err)
    process.exit(1)
  })
}
