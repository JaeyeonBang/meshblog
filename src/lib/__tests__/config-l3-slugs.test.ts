/**
 * config-l3-slugs.test.ts
 *
 * Tests for getL3NoteSlugs — 3 cases per plan §5.
 * Uses better-sqlite3 in-memory DB directly (no mocking needed).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import Database from "better-sqlite3"
import { getL3NoteSlugs, __resetConfigCache } from "../config"

beforeEach(() => {
  __resetConfigCache()
})

afterEach(() => {
  vi.restoreAllMocks()
})

function makeDbWithGraphLevels(rows: Array<{ node_id: string; graph_type: string; level: number }>): Database.Database {
  const db = new Database(":memory:")
  db.exec(`
    CREATE TABLE graph_levels (
      node_id    TEXT NOT NULL,
      graph_type TEXT NOT NULL,
      level      INTEGER NOT NULL,
      PRIMARY KEY (node_id, graph_type)
    )
  `)
  const insert = db.prepare(
    "INSERT INTO graph_levels (node_id, graph_type, level) VALUES (?, ?, ?)",
  )
  for (const row of rows) {
    insert.run(row.node_id, row.graph_type, row.level)
  }
  return db
}

describe("getL3NoteSlugs", () => {
  it("returns Set of L3 note slugs when table is populated", () => {
    const db = makeDbWithGraphLevels([
      { node_id: "ai-chunking", graph_type: "note", level: 3 },
      { node_id: "deno-vs-bun", graph_type: "note", level: 3 },
      { node_id: "hub-note", graph_type: "note", level: 1 },
      { node_id: "concept-foo", graph_type: "concept", level: 3 },
    ])

    const slugs = getL3NoteSlugs(db)

    expect(slugs).toBeInstanceOf(Set)
    expect(slugs.has("ai-chunking")).toBe(true)
    expect(slugs.has("deno-vs-bun")).toBe(true)
    expect(slugs.has("hub-note")).toBe(false)   // level 1 excluded
    expect(slugs.has("concept-foo")).toBe(false) // concept excluded
    expect(slugs.size).toBe(2)

    db.close()
  })

  it("returns empty Set (no warn) when table exists but has no L3 note rows", () => {
    const db = makeDbWithGraphLevels([
      { node_id: "hub-note", graph_type: "note", level: 1 },
    ])
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    const slugs = getL3NoteSlugs(db)

    expect(slugs.size).toBe(0)
    expect(warnSpy).not.toHaveBeenCalled()

    db.close()
  })

  it("returns empty Set + warns when graph_levels table is missing", () => {
    const db = new Database(":memory:")
    // No graph_levels table created
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    const slugs = getL3NoteSlugs(db)

    expect(slugs.size).toBe(0)
    expect(warnSpy).toHaveBeenCalledOnce()
    expect(warnSpy.mock.calls[0][0]).toContain("graph_levels")

    db.close()
  })
})
