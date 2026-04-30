import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

import { readFileSync } from "node:fs"
import { basename, extname } from "node:path"
import { createHash, randomUUID } from "node:crypto"
import matter from "gray-matter"
import { createDb, queryOne, queryMany, execute, type Database } from "../src/lib/db/index.ts"
import { extractEntities } from "../src/lib/rag/graph.ts"
import { generateEmbedding, chunkText, embeddingToBlob } from "../src/lib/rag/embed.ts"
import { discoverMarkdown } from "../src/lib/content/discover.ts"

export type { DiscoveredFile } from "../src/lib/content/discover.ts"
export { discoverMarkdown }

const DB_PATH = process.env.MESHBLOG_DB ?? ".data/index.db"
const CONTENT_DIRS = ["content/posts", "content/notes"]

// ── Tag-to-category fallback map ─────────────────────────────────────────────
// When a note has no `category` frontmatter field, the first matching tag wins.
// Future notes can override this by adding `category: <slug>` to their frontmatter.
// Extend this map as new content domains appear in the vault.
const TAG_TO_CATEGORY: Record<string, string> = {
  // ── ai / ml / nlp / rl / agents (umbrella)
  // All AI-flavoured tags route to a single "ai" category to avoid spawning
  // empty taxonomies (nlp, rl, agent, fine-tuning, paper) that have no
  // post-facing presence.
  nlp: "ai",
  transformer: "ai",
  attention: "ai",
  "self-attention": "ai",
  "multi-head": "ai",
  "positional-encoding": "ai",
  seq2seq: "ai",
  rnn: "ai",
  "encoder-decoder": "ai",
  "masked-attention": "ai",
  rl: "ai",
  ppo: "ai",
  "deep-rl": "ai",
  rlhf: "ai",
  rlpr: "ai",
  agent: "ai",
  "ai-agent": "ai",
  "agent-ai": "ai",
  "ai agent": "ai",
  agentic: "ai",
  "fine-tuning": "ai",
  finetuning: "ai",
  lora: "ai",
  peft: "ai",
  "paper-review": "ai",
  paper: "ai",
  survey: "ai",
  rag: "ai",
  llm: "ai",
  embeddings: "ai",
  openai: "ai",
  "machine-learning": "ai",
  "deep-learning": "ai",
  "neural-network": "ai",
  // ── engineering / dev
  typescript: "engineering",
  generics: "engineering",
  "type-system": "engineering",
  sqlite: "engineering",
  database: "engineering",
  node: "engineering",
  graph: "engineering",
  algorithms: "engineering",
  graphology: "engineering",
  pagerank: "engineering",
  // ── writing / knowledge
  writing: "writing",
  글쓰기: "writing",
  문서화: "writing",
  지식관리: "writing",
}

/** Derive a category slug from a list of tags using TAG_TO_CATEGORY. */
function deriveCategoryFromTags(tags: string[]): string | null {
  for (const tag of tags) {
    const cat = TAG_TO_CATEGORY[tag.toLowerCase()]
    if (cat) return cat
  }
  return null
}

/** Acronyms that render in ALL-CAPS in the legend instead of title-case. */
const ACRONYMS = new Set([
  "ai", "ml", "rl", "nlp", "llm", "rag", "rnn", "cnn", "gpu", "cpu",
  "api", "css", "js", "ts", "ui", "ux", "ci", "cd", "qa", "seo",
  "rlhf", "ppo", "lora", "peft",
])

/** Convert a kebab-case slug to a display name.
 *  Acronyms render UPPERCASE; everything else title-cases. */
function slugToName(slug: string): string {
  return slug
    .split("-")
    .map((w) => {
      const lower = w.toLowerCase()
      if (ACRONYMS.has(lower)) return lower.toUpperCase()
      return w.charAt(0).toUpperCase() + w.slice(1)
    })
    .join(" ")
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex")
}

/** Strip script-like injection vectors from note content. */
function sanitizeContent(content: string): string {
  return content
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "[script removed]")
    .replace(/javascript:/gi, "[js:]")
    .replace(/data:text\/html/gi, "[data-uri removed]")
}

export type BuildIndexStats = {
  embed_calls: number
  embed_tokens: number
  embed_errors: number
}

export type BuildIndexOptions = {
  dbPath?: string
  baseDirs?: string[]
  skipEmbed?: boolean
  skipConcepts?: boolean
  /**
   * Re-extract entities even when content_hash is unchanged. Used by
   * `/re-extract` skill after model swap, when DB has notes from a previous
   * build but the LLM model has changed and we want fresh entities.
   */
  force?: boolean
  extract?: (
    db: ReturnType<typeof createDb>,
    id: string,
    content: string,
  ) => Promise<{ entities: unknown[]; relationships: unknown[] }>
  embedNote?: (
    db: Database.Database,
    noteId: string,
    content: string,
    stats: BuildIndexStats,
  ) => Promise<void>
}

async function defaultEmbedNote(
  db: Database.Database,
  noteId: string,
  content: string,
  stats: BuildIndexStats,
): Promise<void> {
  const cleaned = sanitizeContent(content)
  const chunks = chunkText(cleaned)
  for (let i = 0; i < chunks.length; i++) {
    try {
      const emb = await generateEmbedding(chunks[i])
      stats.embed_calls++
      stats.embed_tokens += Math.ceil(chunks[i].length / 4) // approx token count
      execute(
        db,
        `INSERT INTO note_embeddings (id, note_id, chunk_index, chunk_text, embedding)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(note_id, chunk_index) DO UPDATE SET
           chunk_text = excluded.chunk_text,
           embedding  = excluded.embedding`,
        [randomUUID(), noteId, i, chunks[i], embeddingToBlob(emb)],
      )
    } catch (err) {
      stats.embed_errors++
      console.error(`[build-index] embed chunk ${i} for "${noteId}" failed:`, (err as Error).message)
      // Continue with remaining chunks — partial embeddings are better than none.
    }
  }
}

export async function runBuildIndex(options: BuildIndexOptions = {}) {
  const dbPath = options.dbPath ?? DB_PATH
  const baseDirs = options.baseDirs ?? CONTENT_DIRS
  const skipEmbed = options.skipEmbed ?? false
  const skipConcepts = options.skipConcepts ?? false
  const force = options.force ?? false
  const extract = options.extract ?? extractEntities
  const embedNote = options.embedNote ?? defaultEmbedNote

  // Fail-fast env check when using real OpenAI embeddings (Amendment C)
  if (!skipEmbed && !options.embedNote) {
    if (!process.env.OPENAI_API_KEY) {
      console.error(
        "[build-index] FATAL: OPENAI_API_KEY is not set.\n" +
        "  Problem: embeddings stage requires OpenAI API.\n" +
        "  Cause:   OPENAI_API_KEY missing from environment.\n" +
        "  Fix:     Add OPENAI_API_KEY=sk-... to .env.local (get from platform.openai.com/api-keys).\n" +
        "           Or pass --skip-embed to skip the embeddings stage.",
      )
      process.exit(1)
    }
  }

  console.log(`[build-index] DB: ${dbPath}`)
  const db = createDb(dbPath)

  const stats: BuildIndexStats = { embed_calls: 0, embed_tokens: 0, embed_errors: 0 }

  // ── Stage 1: Extract entities ─────────────────────────────────────────────
  const files = discoverMarkdown(baseDirs)
  console.log(`[build-index] found ${files.length} markdown files`)

  const changedNoteIds: string[] = []
  let processed = 0
  let skipped = 0

  for (const { path, folder } of files) {
    const raw = readFileSync(path, "utf-8")
    const { data: fm, content } = matter(raw)

    if (fm.public === false || fm.draft === true) {
      const reason = fm.draft === true ? "draft:true" : "public:false"
      const prev = queryOne<{ id: string }>(db, "SELECT id FROM notes WHERE id = ?", [basename(path, extname(path))])
      if (prev) {
        execute(db, "DELETE FROM notes WHERE id = ?", [prev.id])
        console.log(`[build-index] deleted stale data for ${reason} note: ${path}`)
      }
      console.log(`[build-index] skip (${reason}): ${path}`)
      continue
    }

    const slug = basename(path, extname(path))
    const id = slug
    const title = (fm.title as string) ?? slug
    const rawTags: string[] = fm.tags ?? []
    const tags = JSON.stringify(rawTags)
    const levelPin = (fm.level_pin as number | undefined) ?? null
    const hash = sha256(content)

    // Resolve category: frontmatter `category` field wins; otherwise derive from tags.
    const categorySlug: string | null =
      (fm.category as string | undefined)?.toLowerCase().trim() ??
      deriveCategoryFromTags(rawTags)

    const existing = queryOne<{ content_hash: string }>(
      db,
      "SELECT content_hash FROM notes WHERE id = ?",
      [id],
    )

    execute(
      db,
      `INSERT INTO notes (id, slug, title, content, content_hash, folder_path, tags, level_pin, category_slug)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title         = excluded.title,
         content       = excluded.content,
         content_hash  = excluded.content_hash,
         folder_path   = excluded.folder_path,
         tags          = excluded.tags,
         level_pin     = excluded.level_pin,
         category_slug = excluded.category_slug,
         updated_at    = datetime('now')`,
      [id, slug, title, content, hash, folder, tags, levelPin, categorySlug],
    )

    const hashChanged = !existing || existing.content_hash !== hash

    if (!hashChanged && !force) {
      console.log(`[build-index] (${++processed}/${files.length}) "${title}" → skipped (unchanged)`)
      skipped++
      // Still may need embeddings if they were deleted (reconcile separately below)
      continue
    }
    if (force && !hashChanged) {
      console.log(`[build-index] (${++processed}/${files.length}) "${title}" → re-extracting (--force)`)
    }

    console.log(`[build-index] (${++processed}/${files.length}) extracting entities for "${title}"`)
    const result = await extract(db, id, content)
    console.log(`  → ${result.entities.length} entities, ${result.relationships.length} relationships`)
    changedNoteIds.push(id)
  }

  // ── Stage 2: Embeddings (Amendment C — reconcile missing even for hash-skipped) ──
  if (!skipEmbed) {
    // Find notes that need embeddings: changed OR no embedding rows yet
    const allNeedEmbed = queryMany<{ id: string; content: string }>(
      db,
      `SELECT id, content FROM notes n
       WHERE graph_status = 'done'
         AND NOT EXISTS (SELECT 1 FROM note_embeddings e WHERE e.note_id = n.id)`,
      [],
    )

    // Also re-embed changed notes (content changed, so chunks may differ)
    const changedSet = new Set(changedNoteIds)
    const changedForEmbed = changedNoteIds.length > 0
      ? queryMany<{ id: string; content: string }>(
          db,
          `SELECT id, content FROM notes WHERE id IN (${changedNoteIds.map(() => "?").join(",")})`,
          changedNoteIds,
        )
      : []

    const toEmbed = [
      ...allNeedEmbed.filter((n) => !changedSet.has(n.id)),
      ...changedForEmbed,
    ]

    if (toEmbed.length > 0) {
      console.log(`[build-index] embedding ${toEmbed.length} notes...`)
      for (let i = 0; i < toEmbed.length; i++) {
        const note = toEmbed[i]
        console.log(`[build-index] [embed ${i + 1}/${toEmbed.length}] ${note.id}`)
        await embedNote(db, note.id, note.content, stats)
      }
    } else {
      console.log(`[build-index] embeddings up to date, skipping embed stage`)
    }
  } else {
    console.log(`[build-index] --skip-embed: embeddings stage skipped`)
  }

  // ── Stage 3: Concepts (Louvain clustering) ────────────────────────────────
  // Agent B owns src/lib/rag/graph-topology.ts — load dynamically to avoid
  // hard failure if Agent B hasn't landed yet.
  let conceptsCreated = 0
  let conceptsUpdated = 0

  if (!skipConcepts) {
    try {
      const { computeEntityCommunities } = await import("../src/lib/rag/graph-topology.ts")
      const { buildConceptsFromCommunities } = await import("../src/lib/rag/concepts.ts")
      const communities = computeEntityCommunities(db)
      const result = await buildConceptsFromCommunities(db, communities)
      conceptsCreated = result.created
      conceptsUpdated = result.updated
      console.log(`[build-index] concepts: ${conceptsCreated} created, ${conceptsUpdated} updated`)
    } catch (err) {
      const msg = (err as Error).message
      if (msg.includes("Cannot find module") || msg.includes("ERR_MODULE_NOT_FOUND")) {
        console.warn(
          "[build-index] concept stage skipped: graph-topology.ts or concepts.ts not yet available.\n" +
          "  Run with --skip-concepts to suppress this warning.",
        )
      } else {
        console.error("[build-index] concept stage failed:", msg)
      }
    }
  } else {
    console.log(`[build-index] --skip-concepts: concept stage skipped`)
  }

  // ── Stage 4: Backlinks (D4) ───────────────────────────────────────────────
  try {
    const { runBuildBacklinks } = await import("./build-backlinks.ts")
    const allNotes = queryMany<{ id: string; title: string; content: string }>(
      db,
      "SELECT id, title, content FROM notes",
      [],
    )
    runBuildBacklinks({ db, notes: allNotes })
  } catch (err) {
    const msg = (err as Error).message
    if (msg.includes("Cannot find module") || msg.includes("ERR_MODULE_NOT_FOUND")) {
      console.warn("[build-index] backlinks stage skipped: build-backlinks.ts not yet available.")
    } else {
      console.error("[build-index] backlinks stage failed:", msg)
    }
  }

  // ── Stage 5: Categories (aggregate category_slug across notes + posts) ──────
  try {
    // Rebuild categories table from current notes data.
    // note_count = notes in content/notes/, post_count = notes in content/posts/.
    const categoryRows = db
      .prepare(
        `SELECT
           category_slug                             AS slug,
           SUM(CASE WHEN folder_path = 'content/notes' THEN 1 ELSE 0 END) AS note_count,
           SUM(CASE WHEN folder_path = 'content/posts' THEN 1 ELSE 0 END) AS post_count
         FROM notes
         WHERE category_slug IS NOT NULL
         GROUP BY category_slug`,
      )
      .all() as Array<{ slug: string; note_count: number; post_count: number }>

    // Replace all category rows atomically.
    execute(db, "DELETE FROM categories", [])
    for (const row of categoryRows) {
      execute(
        db,
        `INSERT INTO categories (slug, name, note_count, post_count)
         VALUES (?, ?, ?, ?)`,
        [row.slug, slugToName(row.slug), row.note_count, row.post_count],
      )
    }
    console.log(`[build-index] categories: ${categoryRows.length} distinct categories`)
  } catch (err) {
    console.error("[build-index] categories stage failed:", (err as Error).message)
  }

  // ── Final counts ──────────────────────────────────────────────────────────
  const counts = db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM notes)             AS notes,
        (SELECT COUNT(*) FROM entities)          AS entities,
        (SELECT COUNT(*) FROM note_entities)     AS note_entities,
        (SELECT COUNT(*) FROM entity_relationships) AS relationships,
        (SELECT COUNT(*) FROM note_embeddings)   AS embeddings,
        (SELECT COUNT(*) FROM concepts)          AS concepts,
        (SELECT COUNT(*) FROM qa_cards)          AS qa_cards,
        (SELECT COUNT(*) FROM categories)        AS categories`,
    )
    .get() as Record<string, number>

  console.log(`[build-index] done. skipped: ${skipped}/${files.length}. counts:`, counts)
  console.log(`[build-index] embed stats:`, stats)
  db.close()
  return { counts, skipped, processed, stats }
}

// ── CLI entry ─────────────────────────────────────────────────────────────────
const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("build-index.ts")

if (isMainModule) {
  // ── FIXTURE_ONLY mode: seed DB from canned fixtures, skip all LLM calls ──
  if (process.env.FIXTURE_ONLY === "1") {
    console.log("[build-index] FIXTURE_ONLY=1 — seeding from test/fixtures/seed.sql")
    const db = createDb(DB_PATH)
    const seed = readFileSync(
      new URL("../test/fixtures/seed.sql", import.meta.url),
      "utf-8",
    )
    db.exec(seed)
    console.log("[build-index] fixture seed complete")
    db.close()
    process.exit(0)
  }

  const args = process.argv.slice(2)
  const opts: BuildIndexOptions = {
    skipEmbed: args.includes("--skip-embed"),
    skipConcepts: args.includes("--skip-concepts"),
    force: args.includes("--force"),
  }
  runBuildIndex(opts).catch((err) => {
    console.error("[build-index] FATAL:", err)
    process.exit(1)
  })
}
