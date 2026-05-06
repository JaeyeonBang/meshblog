/**
 * build-backlinks.ts — D4a: parse [[wikilinks]] from note content,
 * write rows to the `wikilinks` table, and emit public/graph/backlinks.json.
 *
 * Exports `runBuildBacklinks()` for use by build-index.ts and tests.
 */
import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { createDb, queryMany, type Database } from "../src/lib/db/index.ts"
import { loadMeshblogConfig, getL3NoteSlugs } from "../src/lib/config.ts"
import { buildNoteResolver } from "../src/lib/markdown/wikilink-resolver.ts"

// Reuse the canonical regex from strip-wikilinks.ts (D2).
// We need a fresh RegExp per call (lastIndex is stateful on /g regexes).
function makeWikilinkRe(): RegExp {
  return /\[\[([^\]|]*)(\|([^\]]*))?\]\]/g
}

const DB_PATH = process.env.MESHBLOG_DB ?? ".data/index.db"
const GRAPH_DIR = "public/graph"

// ── Types ──────────────────────────────────────────────────────────────────────

export type NoteStub = {
  id: string
  title: string
  content: string
  category_slug?: string | null
  /** JSON-serialised string[] — e.g. '["PPO","RLHF"]'. Defaults to '[]'. */
  aliases?: string
}

export type BacklinksJson = {
  nodes: Array<{ id: string; title: string; categorySlug?: string }>
  edges: Array<{ source: string; target: string; alias?: string }>
}

// ── Core runner ────────────────────────────────────────────────────────────────

export type BuildBacklinksOptions = {
  db: Database.Database
  notes?: NoteStub[]         // If omitted, all notes are read from DB
  dryRun?: boolean           // If true, skip DB writes + file writes
  outputDir?: string         // Output dir for backlinks.json (default: public/graph)
}

export function runBuildBacklinks(opts: BuildBacklinksOptions): BacklinksJson {
  const { db, dryRun = false } = opts
  const outputDir = opts.outputDir ?? GRAPH_DIR

  // 1. Load all notes if not provided
  const allNotes: NoteStub[] =
    opts.notes ??
    queryMany<NoteStub>(db, "SELECT id, title, content, category_slug, aliases FROM notes", [])

  // 2. Build alias-aware resolver using shared factory
  const notesForResolver = allNotes.map((n) => {
    let aliases: string[] = []
    if (n.aliases) {
      try {
        const parsed = JSON.parse(n.aliases)
        if (Array.isArray(parsed)) aliases = parsed
      } catch {
        aliases = []
      }
    }
    return { slug: n.id, title: n.title, aliases }
  })

  const { resolve, collisions } = buildNoteResolver(notesForResolver)

  // Log any alias collisions to stderr
  for (const c of collisions) {
    process.stderr.write(
      `[build-backlinks] alias collision: "${c.alias}" claimed by [${c.claimers.join(", ")}] — neither resolves\n`,
    )
  }

  // 3. Parse wikilinks from all note content
  type WikilinkRow = {
    source_id: string
    target_id: string | null
    target_raw: string
    alias: string | null
    position: number
  }

  const rows: WikilinkRow[] = []
  const sourceIds = new Set<string>()

  for (const note of allNotes) {
    sourceIds.add(note.id)
    const re = makeWikilinkRe()
    let match: RegExpExecArray | null

    while ((match = re.exec(note.content)) !== null) {
      // Skip image-embed form: ![[...]]
      // Check the char before the opening [[ in the original content
      const offset = match.index
      if (offset > 0 && note.content[offset - 1] === "!") continue

      const rawTarget = match[1] ?? ""
      const alias = match[3] ?? null

      const targetRaw = rawTarget.trim().toLowerCase()
      if (!targetRaw) continue

      // Use shared resolver: bySlug → byTitle → byAlias → null
      const resolved = resolve(rawTarget.trim())
      const resolvedId = resolved?.slug ?? null

      rows.push({
        source_id: note.id,
        target_id: resolvedId,
        target_raw: targetRaw,
        alias: alias ? alias.trim() : null,
        position: offset,
      })
    }
  }

  // 4. Write to DB in a single transaction
  if (!dryRun && sourceIds.size > 0) {
    const sourceIdList = [...sourceIds]
    const placeholders = sourceIdList.map(() => "?").join(",")

    db.transaction(() => {
      // Delete existing wikilinks for these sources first
      db.prepare(
        `DELETE FROM wikilinks WHERE source_id IN (${placeholders})`,
      ).run(...sourceIdList)

      // Insert new rows
      const insert = db.prepare(
        `INSERT INTO wikilinks (source_id, target_id, target_raw, alias, position)
         VALUES (?, ?, ?, ?, ?)`,
      )
      for (const row of rows) {
        insert.run(row.source_id, row.target_id, row.target_raw, row.alias, row.position)
      }
    })()

    console.log(
      `[build-backlinks] wrote ${rows.length} wikilink rows for ${sourceIds.size} notes`,
    )
  } else if (dryRun) {
    console.log(
      `[build-backlinks] dry-run: found ${rows.length} wikilinks across ${sourceIds.size} notes (no writes)`,
    )
  }

  // 5. Build backlinks.json — only resolved edges (target_id IS NOT NULL)
  //    In 'hidden' mode, drop L3 nodes and any edges incident to them.
  const { l3Visibility } = loadMeshblogConfig()
  const l3Slugs = l3Visibility === "hidden" ? getL3NoteSlugs(db) : new Set<string>()

  const nodeSet = new Set<string>()
  const edges: BacklinksJson["edges"] = []

  for (const row of rows) {
    if (row.target_id === null) continue
    // hidden mode: skip any edge that touches an L3 node
    if (l3Visibility === "hidden" && (l3Slugs.has(row.source_id) || l3Slugs.has(row.target_id))) {
      continue
    }
    nodeSet.add(row.source_id)
    nodeSet.add(row.target_id)
    const edge: BacklinksJson["edges"][number] = {
      source: row.source_id,
      target: row.target_id,
    }
    if (row.alias) edge.alias = row.alias
    edges.push(edge)
  }

  // Build title + category maps from allNotes
  const titleMap = new Map(allNotes.map((n) => [n.id, n.title]))
  const categoryMap = new Map(allNotes.map((n) => [n.id, n.category_slug ?? undefined]))

  const nodes: BacklinksJson["nodes"] = [...nodeSet].map((id) => {
    const node: BacklinksJson["nodes"][number] = {
      id,
      title: titleMap.get(id) ?? id,
    }
    const slug = categoryMap.get(id)
    if (slug) node.categorySlug = slug
    return node
  })

  const json: BacklinksJson = { nodes, edges }

  if (!dryRun) {
    mkdirSync(outputDir, { recursive: true })
    const outPath = join(outputDir, "backlinks.json")
    writeFileSync(outPath, JSON.stringify(json, null, 2))
    console.log(
      `[build-backlinks] ${outPath}: ${nodes.length} nodes, ${edges.length} edges`,
    )
  }

  return json
}

// ── CLI entry ─────────────────────────────────────────────────────────────────

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("build-backlinks.ts")

if (isMainModule) {
  const db = createDb(DB_PATH)
  try {
    runBuildBacklinks({ db })
    console.log("[build-backlinks] done")
  } finally {
    db.close()
  }
}
