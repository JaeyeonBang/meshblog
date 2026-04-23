/**
 * concept-cross-edges.test.ts — Unit tests for Option B cross-edge injection.
 *
 * Verifies that addCrossEdgesToConceptGraph:
 *   A) adds mention edges + note nodes for concepts with referencing notes
 *   B) leaves orphan concepts unchanged when no notes reference them
 *   C) deduplicates note nodes when the same note references multiple concepts
 */
import { describe, it, expect, beforeEach } from "vitest"
import { mkdirSync, existsSync, unlinkSync } from "node:fs"
import { join } from "node:path"
import Graph from "graphology"
import { createDb, execute } from "../../src/lib/db/index.ts"
import { addCrossEdgesToConceptGraph } from "../export-graph.ts"

const TMP_DIR = ".data/test-concept-cross-edges"
const TMP_DB = join(TMP_DIR, "cross-edges.db")

function seedDb(db: ReturnType<typeof createDb>) {
  // Notes
  for (const [id, title] of [
    ["note-a", "Note Alpha"],
    ["note-b", "Note Beta"],
    ["note-c", "Note Gamma"],
  ]) {
    execute(db,
      `INSERT OR IGNORE INTO notes (id, slug, title, content, content_hash, graph_status)
       VALUES (?, ?, ?, '', 'hash', 'done')`,
      [id, id, title],
    )
  }

  // Entities
  for (let i = 1; i <= 4; i++) {
    db.prepare(`INSERT OR IGNORE INTO entities (id, name, entity_type) VALUES (?, ?, 'technology')`)
      .run(i, `ent-${i}`)
  }

  // Concepts
  for (const [id, name] of [
    ["concept-x", "Concept X"],   // referenced by note-a + note-b
    ["concept-y", "Concept Y"],   // referenced by note-b only
    ["concept-z", "Concept Z"],   // no notes → orphan
  ]) {
    execute(db,
      `INSERT OR IGNORE INTO concepts (id, name, description, confidence) VALUES (?, ?, '', 0.8)`,
      [id, name],
    )
  }

  // concept_entities links
  execute(db, `INSERT OR IGNORE INTO concept_entities (concept_id, entity_id) VALUES ('concept-x', 1)`, [])
  execute(db, `INSERT OR IGNORE INTO concept_entities (concept_id, entity_id) VALUES ('concept-x', 2)`, [])
  execute(db, `INSERT OR IGNORE INTO concept_entities (concept_id, entity_id) VALUES ('concept-y', 3)`, [])
  // concept-z: entity 4 intentionally has no note_entities row

  // note_entities: note-a and note-b share entity-1 (→ concept-x)
  //               note-b also has entity-3 (→ concept-y)
  execute(db, `INSERT OR IGNORE INTO note_entities (note_id, entity_id) VALUES ('note-a', 1)`, [])
  execute(db, `INSERT OR IGNORE INTO note_entities (note_id, entity_id) VALUES ('note-b', 1)`, [])
  execute(db, `INSERT OR IGNORE INTO note_entities (note_id, entity_id) VALUES ('note-b', 3)`, [])
}

describe("addCrossEdgesToConceptGraph", () => {
  let db: ReturnType<typeof createDb>

  beforeEach(() => {
    mkdirSync(TMP_DIR, { recursive: true })
    if (existsSync(TMP_DB)) unlinkSync(TMP_DB)
    db = createDb(TMP_DB)
    seedDb(db)
  })

  it("Case A: concept with 2 referencing notes gets 2 mentions edges and 2 note nodes", () => {
    const g = new Graph({ type: "undirected", allowSelfLoops: false })
    g.addNode("concept-x", { label: "Concept X", type: "concept" })

    addCrossEdgesToConceptGraph(g, db)

    // Should have concept-x + note-a + note-b
    expect(g.hasNode("note-a")).toBe(true)
    expect(g.hasNode("note-b")).toBe(true)
    expect(g.getNodeAttribute("note-a", "type")).toBe("note")
    expect(g.getNodeAttribute("note-b", "type")).toBe("note")

    // Two mentions edges from concept-x
    const mentionEdges = g.edges().filter(e => g.getEdgeAttribute(e, "edgeType") === "mentions")
    expect(mentionEdges.length).toBe(2)
  })

  it("Case B: concept with 0 referencing notes stays an orphan", () => {
    const g = new Graph({ type: "undirected", allowSelfLoops: false })
    g.addNode("concept-z", { label: "Concept Z", type: "concept" })

    const edgesBefore = g.size

    addCrossEdgesToConceptGraph(g, db)

    // No new edges should have been added for concept-z
    const mentionEdges = g.edges().filter(e => g.getEdgeAttribute(e, "edgeType") === "mentions")
    expect(mentionEdges.length).toBe(0)
    expect(g.size).toBe(edgesBefore)
  })

  it("Case C: note appearing in multiple concepts is added only once (dedup)", () => {
    const g = new Graph({ type: "undirected", allowSelfLoops: false })
    g.addNode("concept-x", { label: "Concept X", type: "concept" })
    g.addNode("concept-y", { label: "Concept Y", type: "concept" })

    addCrossEdgesToConceptGraph(g, db)

    // note-b references both concept-x (via ent-1) and concept-y (via ent-3)
    // It should appear exactly once as a node
    expect(g.hasNode("note-b")).toBe(true)
    const noteNodes = g.nodes().filter(n => g.getNodeAttribute(n, "type") === "note")
    const noteBCount = noteNodes.filter(n => n === "note-b").length
    expect(noteBCount).toBe(1)

    // But there should be 2 distinct mentions edges involving note-b
    const noteBEdges = g.edges().filter(e => {
      const [s, t] = g.extremities(e)
      return (s === "note-b" || t === "note-b") && g.getEdgeAttribute(e, "edgeType") === "mentions"
    })
    expect(noteBEdges.length).toBe(2)
  })
})
