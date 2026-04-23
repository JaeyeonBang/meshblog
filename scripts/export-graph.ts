/**
 * export-graph.ts — Build Note Graph + Concept Graph, assign PageRank levels,
 * and write 6 JSON files: note-l1/l2/l3 + concept-l1/l2/l3.
 *
 * Patch C (PageRank + level_pin) + Amendment E (0-edge guard + neighbor promotion).
 * Amendment E: L2 includes L1+L2 nodes (inclusive). L3 = all nodes.
 */
import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import Graph from "graphology"
import pagerank from "graphology-metrics/centrality/pagerank"
import { createDb, queryMany, queryOne, execute, type Database } from "../src/lib/db/index.ts"

const DB_PATH = process.env.MESHBLOG_DB ?? ".data/index.db"
const GRAPH_DIR = "public/graph"

// Configurable thresholds
const NOTE_EDGE_MIN_SHARED = parseInt(process.env.MESHBLOG_NOTE_EDGE_MIN ?? "1", 10)
const CONCEPT_EDGE_MIN_SHARED = parseInt(process.env.MESHBLOG_CONCEPT_EDGE_MIN ?? "1", 10)

type NodeAttrs = {
  label: string
  type: string
  level?: number
  pagerank?: number
  pinned?: boolean
}

type GraphJson = {
  nodes: Array<{ id: string } & NodeAttrs>
  links: Array<{ source: string; target: string; weight?: number; type?: string }>
}

// ── Graph builders ────────────────────────────────────────────────────────────

export function buildNoteGraph(db: Database.Database): Graph {
  const g = new Graph({ type: "undirected", allowSelfLoops: false })

  const notes = queryMany<{ id: string; title: string }>(
    db,
    "SELECT id, title FROM notes WHERE graph_status='done'",
    [],
  )
  for (const n of notes) {
    g.addNode(n.id, { label: n.title, type: "note" })
  }

  if (notes.length < 2) return g

  // Edges: two notes sharing ≥N entities
  const pairs = queryMany<{ a: string; b: string; shared: number }>(
    db,
    `SELECT a.note_id AS a, b.note_id AS b, COUNT(*) AS shared
     FROM note_entities a
     JOIN note_entities b ON a.entity_id = b.entity_id AND a.note_id < b.note_id
     GROUP BY a.note_id, b.note_id
     HAVING shared >= ?`,
    [NOTE_EDGE_MIN_SHARED],
  )
  for (const p of pairs) {
    if (g.hasNode(p.a) && g.hasNode(p.b)) {
      g.addEdge(p.a, p.b, { weight: p.shared })
    }
  }

  return g
}

export function buildConceptGraph(db: Database.Database): Graph {
  const g = new Graph({ type: "undirected", allowSelfLoops: false })

  const concepts = queryMany<{ id: string; name: string }>(
    db,
    "SELECT id, name FROM concepts",
    [],
  )
  for (const c of concepts) {
    g.addNode(c.id, { label: c.name, type: "concept" })
  }

  if (concepts.length < 2) return g

  // Edges: two concepts co-occurring in ≥M notes (via shared entities)
  const pairs = queryMany<{ a: string; b: string; shared: number }>(
    db,
    `SELECT ce1.concept_id AS a, ce2.concept_id AS b, COUNT(DISTINCT ne.note_id) AS shared
     FROM concept_entities ce1
     JOIN concept_entities ce2 ON ce1.entity_id = ce2.entity_id AND ce1.concept_id < ce2.concept_id
     JOIN note_entities ne ON ne.entity_id = ce1.entity_id
     GROUP BY ce1.concept_id, ce2.concept_id
     HAVING shared >= ?`,
    [CONCEPT_EDGE_MIN_SHARED],
  )
  for (const p of pairs) {
    if (g.hasNode(p.a) && g.hasNode(p.b)) {
      g.addEdge(p.a, p.b, { weight: p.shared })
    }
  }

  return g
}

/**
 * addCrossEdgesToConceptGraph — Option B implementation.
 *
 * For each (concept_id, note_id) pair in note_entities (bridged via entities),
 * inject the referencing note as a node (type='note') and an edge of type
 * 'mentions' (concept→note). Deduplicates note nodes.
 *
 * Only notes with graph_status='done' are included so orphan/draft notes don't
 * pollute the graph. To keep the augmented graph compact, each concept retains
 * at most MAX_MENTIONS_PER_CONCEPT edges (ranked by confidence DESC, then
 * mention_count DESC).
 */
const MAX_MENTIONS_PER_CONCEPT = 10

export function addCrossEdgesToConceptGraph(
  g: Graph,
  db: Database.Database,
): void {
  // Fetch cross-edge candidates: concepts that have entity memberships linked
  // to notes (via concept_entities → entities → note_entities).
  // entity_count = how many shared entities link the concept to the note
  // (acts as a proxy for relevance when confidence/mention_count are absent).
  const rows = queryMany<{
    concept_id: string
    note_id: string
    note_title: string
    entity_count: number
  }>(
    db,
    `SELECT
       ce.concept_id,
       ne.note_id,
       n.title AS note_title,
       COUNT(DISTINCT ce.entity_id) AS entity_count
     FROM concept_entities ce
     JOIN note_entities ne ON ne.entity_id = ce.entity_id
     JOIN notes n ON n.id = ne.note_id AND n.graph_status = 'done'
     WHERE ce.concept_id IN (SELECT id FROM concepts)
     GROUP BY ce.concept_id, ne.note_id
     ORDER BY ce.concept_id, entity_count DESC`,
    [],
  )

  if (rows.length === 0) {
    console.log("[export-graph] no concept↔note cross-edges found (note_entities empty or no concepts)")
    return
  }

  // Group by concept, cap at MAX_MENTIONS_PER_CONCEPT
  const perConcept = new Map<string, typeof rows>()
  for (const row of rows) {
    const list = perConcept.get(row.concept_id) ?? []
    if (list.length < MAX_MENTIONS_PER_CONCEPT) {
      list.push(row)
      perConcept.set(row.concept_id, list)
    }
  }

  // Track which note nodes we already added (dedup across concepts)
  const addedNoteNodes = new Set<string>()

  let edgeCount = 0
  for (const [conceptId, edges] of perConcept) {
    if (!g.hasNode(conceptId)) continue   // should never happen, but guard anyway

    for (const row of edges) {
      // Add note node if not present
      if (!g.hasNode(row.note_id)) {
        g.addNode(row.note_id, { label: row.note_title, type: "note" })
        addedNoteNodes.add(row.note_id)
      }

      // Add cross-edge: undirected graph so we check both directions
      if (!g.hasEdge(conceptId, row.note_id) && !g.hasEdge(row.note_id, conceptId)) {
        g.addEdge(conceptId, row.note_id, {
          weight: row.entity_count,
          edgeType: "mentions",  // stored on graph edge attrs
        })
        edgeCount++
      }
    }
  }

  console.log(
    `[export-graph] cross-edges: ${edgeCount} mentions edges, ${addedNoteNodes.size} note nodes injected into concept graph`,
  )
}

// ── Level assignment ──────────────────────────────────────────────────────────

export function assignLevels(
  g: Graph,
  db: Database.Database,
  graphType: "note" | "concept",
): void {
  const nodeCount = g.order

  if (nodeCount === 0) {
    console.log(`[export-graph] ${graphType} graph is empty — skipping level assignment`)
    return
  }

  // Amendment E: if 0 edges, skip pagerank (it degenerates) — assign all L3
  const hasEdges = g.size > 0
  let ranks: Record<string, number>

  if (!hasEdges) {
    console.warn(
      `[export-graph] ${graphType} graph has no edges. Assigning all nodes to level 3.`,
    )
    ranks = {}
    g.forEachNode((id) => {
      ranks[id] = 0
    })
  } else {
    ranks = pagerank(g)
  }

  const entries = Object.entries(ranks).sort(([, a], [, b]) => b - a)
  const n = entries.length
  const l1End = Math.ceil(n * 0.2)   // top 20% = level 1
  const l2End = Math.ceil(n * 0.5)   // next 30% = level 2, rest = level 3

  const levelMap: Map<string, number> = new Map()

  for (let i = 0; i < n; i++) {
    const [nodeId, rank] = entries[i]
    let level = i < l1End ? 1 : i < l2End ? 2 : 3

    // Override: frontmatter level_pin (note graph only)
    let pinned = false
    if (graphType === "note") {
      const row = queryOne<{ level_pin: number | null }>(
        db,
        "SELECT level_pin FROM notes WHERE id = ? AND level_pin IS NOT NULL",
        [nodeId],
      )
      if (row?.level_pin != null) {
        level = row.level_pin as number
        pinned = true
      }
    }

    levelMap.set(nodeId, level)
    g.setNodeAttribute(nodeId, "level", level)
    g.setNodeAttribute(nodeId, "pagerank", rank)
    g.setNodeAttribute(nodeId, "pinned", pinned)

    execute(
      db,
      `INSERT INTO graph_levels (graph_type, node_id, level, pagerank, pinned)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(graph_type, node_id) DO UPDATE SET
         level    = excluded.level,
         pagerank = excluded.pagerank,
         pinned   = excluded.pinned`,
      [graphType, nodeId, level, rank, pinned ? 1 : 0],
    )
  }

  // Handle isolated nodes not in pagerank result (Amendment E: include at L3)
  g.forEachNode((id) => {
    if (!levelMap.has(id)) {
      g.setNodeAttribute(id, "level", 3)
      g.setNodeAttribute(id, "pagerank", 0)
      g.setNodeAttribute(id, "pinned", false)
      execute(
        db,
        `INSERT INTO graph_levels (graph_type, node_id, level, pagerank, pinned)
         VALUES (?, ?, 3, 0, 0)
         ON CONFLICT(graph_type, node_id) DO UPDATE SET level=3, pagerank=0, pinned=0`,
        [graphType, id],
      )
    }
  })

  // ── Neighbor promotion (Amendment E / Eng F7) ──────────────────────────────
  // For each level-1 node: if it has ≥3 level-3 neighbors, promote up to 2 of
  // them (highest edge weight) to level-2 so display continuity is preserved.
  g.forEachNode((nodeId, attrs) => {
    if ((attrs.level as number) !== 1) return
    const level3Neighbors: Array<{ id: string; weight: number }> = []

    g.forEachNeighbor(nodeId, (neighborId, _nAttrs) => {
      if ((g.getNodeAttribute(neighborId, "level") as number) === 3) {
        const edgeAttrs = g.getEdgeAttributes(g.edge(nodeId, neighborId)!)
        level3Neighbors.push({ id: neighborId, weight: (edgeAttrs.weight as number) ?? 1 })
      }
    })

    if (level3Neighbors.length >= 3) {
      level3Neighbors.sort((a, b) => b.weight - a.weight)
      const toPromote = level3Neighbors.slice(0, 2)
      for (const neighbor of toPromote) {
        g.setNodeAttribute(neighbor.id, "level", 2)
        execute(
          db,
          `UPDATE graph_levels SET level=2 WHERE graph_type=? AND node_id=?`,
          [graphType, neighbor.id],
        )
        console.log(`[export-graph] promoted ${neighbor.id} from L3→L2 (neighbor of L1 node ${nodeId})`)
      }
    }
  })
}

// ── Export ────────────────────────────────────────────────────────────────────

export function exportLevel(
  g: Graph,
  maxLevel: 1 | 2 | 3,
  outPath: string,
): GraphJson {
  const json: GraphJson = { nodes: [], links: [] }

  // Inclusive: L2 contains L1+L2, L3 = all
  const includedNodes = new Set<string>()
  g.forEachNode((id, attrs) => {
    const level = (attrs.level as number) ?? 3
    if (level <= maxLevel) {
      includedNodes.add(id)
      json.nodes.push({ id, ...attrs } as { id: string } & NodeAttrs)
    }
  })

  g.forEachEdge((_edge, attrs, src, dst) => {
    if (includedNodes.has(src) && includedNodes.has(dst)) {
      const link: { source: string; target: string; weight: number; type?: string } = {
        source: src,
        target: dst,
        weight: attrs.weight as number,
      }
      if (attrs.edgeType) link.type = attrs.edgeType as string
      json.links.push(link)
    }
  })

  writeFileSync(outPath, JSON.stringify(json, null, 2))
  console.log(`[export-graph] ${outPath}: ${json.nodes.length} nodes, ${json.links.length} links`)
  return json
}

// ── Exported runner (for tests) ───────────────────────────────────────────────

export async function runExportGraph(
  db: Database.Database,
  outputDir: string = GRAPH_DIR,
): Promise<void> {
  mkdirSync(outputDir, { recursive: true })

  // Note Graph
  const noteGraph = buildNoteGraph(db)
  console.log(`[export-graph] note graph: ${noteGraph.order} nodes, ${noteGraph.size} edges`)
  assignLevels(noteGraph, db, "note")
  exportLevel(noteGraph, 1, join(outputDir, "note-l1.json"))
  exportLevel(noteGraph, 2, join(outputDir, "note-l2.json"))
  exportLevel(noteGraph, 3, join(outputDir, "note-l3.json"))

  // Concept Graph + cross-edges (Option B: note nodes injected into concept graph)
  const conceptGraph = buildConceptGraph(db)
  console.log(`[export-graph] concept graph: ${conceptGraph.order} nodes, ${conceptGraph.size} edges`)
  addCrossEdgesToConceptGraph(conceptGraph, db)
  console.log(`[export-graph] concept graph after cross-edges: ${conceptGraph.order} nodes, ${conceptGraph.size} edges`)
  assignLevels(conceptGraph, db, "concept")
  exportLevel(conceptGraph, 1, join(outputDir, "concept-l1.json"))
  exportLevel(conceptGraph, 2, join(outputDir, "concept-l2.json"))
  exportLevel(conceptGraph, 3, join(outputDir, "concept-l3.json"))
}

// ── CLI entry ─────────────────────────────────────────────────────────────────

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("export-graph.ts")

if (isMainModule) {
  const db = createDb(DB_PATH)
  runExportGraph(db, GRAPH_DIR)
    .then(() => {
      db.close()
      console.log("[export-graph] done")
    })
    .catch((err) => {
      db.close()
      console.error("[export-graph] FATAL:", err)
      process.exit(1)
    })
}
