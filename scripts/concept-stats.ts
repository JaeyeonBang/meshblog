/**
 * concept-stats.ts — print before/after metrics for /re-extract.
 *
 * Reads .data/index.db + public/graph/concept-l3.json and prints:
 *   - median entities/post
 *   - median concepts/post
 *   - inter-concept edge count in the global graph
 *   - per-post concept/edge breakdown for the 6 sampled posts QA tracks
 *
 * Use as a baseline before /re-extract and re-run after to confirm impact.
 */
import { readFileSync, existsSync } from "node:fs"
import Database from "better-sqlite3"

const DB_PATH = process.env.MESHBLOG_DB ?? ".data/index.db"
const GRAPH_PATH = "public/graph/concept-l3.json"

// Posts that triggered the original sparse-graph QA finding. Worth tracking
// on every re-extract until they consistently show ≥ 2 concepts.
const TRACKED_POSTS = [
  "11-rlpr",
  "12-transformer-self-attention",
  "10-deepseek-math",
  "09-ppo",
  "08-lora",
  "07-agentic-llms-survey-interacting",
]

function median(nums: number[]): number {
  if (nums.length === 0) return 0
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

function main(): void {
  if (!existsSync(DB_PATH)) {
    console.error(`[concept-stats] DB not found: ${DB_PATH}`)
    process.exit(1)
  }

  const db = new Database(DB_PATH, { readonly: true })

  const entitiesPerPost = db
    .prepare<[]>(
      `SELECT note_id, COUNT(*) AS c FROM note_entities GROUP BY note_id`,
    )
    .all() as Array<{ note_id: string; c: number }>

  const conceptsPerPost = db
    .prepare<[]>(
      `SELECT ne.note_id, COUNT(DISTINCT ce.concept_id) AS c
       FROM note_entities ne
       JOIN concept_entities ce ON ce.entity_id = ne.entity_id
       GROUP BY ne.note_id`,
    )
    .all() as Array<{ note_id: string; c: number }>

  const totals = {
    notes: (db.prepare(`SELECT COUNT(*) AS c FROM notes`).get() as { c: number }).c,
    entities: (db.prepare(`SELECT COUNT(*) AS c FROM entities`).get() as { c: number }).c,
    note_entities: (db.prepare(`SELECT COUNT(*) AS c FROM note_entities`).get() as { c: number }).c,
    concepts: (db.prepare(`SELECT COUNT(*) AS c FROM concepts`).get() as { c: number }).c,
  }
  db.close()

  const eCounts = entitiesPerPost.map((r) => r.c)
  const cCounts = conceptsPerPost.map((r) => r.c)

  let interConceptEdges = 0
  let conceptNodeCount = 0
  if (existsSync(GRAPH_PATH)) {
    const graph = JSON.parse(readFileSync(GRAPH_PATH, "utf-8")) as {
      nodes: Array<{ id: string; type?: string }>
      links: Array<{ source: string; target: string; type?: string }>
    }
    const conceptIds = new Set(
      graph.nodes.filter((n) => n.type === "concept").map((n) => n.id),
    )
    conceptNodeCount = conceptIds.size
    interConceptEdges = graph.links.filter(
      (l) => conceptIds.has(l.source) && conceptIds.has(l.target),
    ).length
  }

  const eByNote = new Map(entitiesPerPost.map((r) => [r.note_id, r.c]))
  const cByNote = new Map(conceptsPerPost.map((r) => [r.note_id, r.c]))

  console.log("─── concept-stats ─────────────────────────────────────────")
  console.log(`notes:         ${totals.notes}`)
  console.log(`entities:      ${totals.entities}`)
  console.log(`note_entities: ${totals.note_entities}`)
  console.log(`concepts:      ${totals.concepts}`)
  console.log(`graph nodes:   ${conceptNodeCount} concept nodes`)
  console.log(`graph edges:   ${interConceptEdges} concept↔concept edges`)
  console.log(`median entities / post: ${median(eCounts)}`)
  console.log(`median concepts / post: ${median(cCounts)}`)
  console.log(`mean entities / post:   ${(eCounts.reduce((a, b) => a + b, 0) / Math.max(eCounts.length, 1)).toFixed(1)}`)
  console.log(`mean concepts / post:   ${(cCounts.reduce((a, b) => a + b, 0) / Math.max(cCounts.length, 1)).toFixed(1)}`)
  console.log()
  console.log("tracked posts (must reach ≥ 2 concepts to show toggle):")
  for (const slug of TRACKED_POSTS) {
    const e = eByNote.get(slug) ?? 0
    const c = cByNote.get(slug) ?? 0
    const ok = c >= 2 ? "✓" : "✗"
    console.log(`  ${ok} ${slug.padEnd(40)}  ${e} entities, ${c} concepts`)
  }
  console.log("───────────────────────────────────────────────────────────")
}

main()
