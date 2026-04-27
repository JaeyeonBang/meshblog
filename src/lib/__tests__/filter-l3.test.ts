/**
 * filter-l3.test.ts
 *
 * Tests for filterL3 — 3 cases per plan §5.
 */

import { describe, it, expect } from "vitest"
import { filterL3 } from "../config"

const l3Set = new Set(["draft-fragment", "half-thought"])

const notes = [
  { id: "hub-note" },
  { id: "draft-fragment" },
  { id: "important-post" },
  { id: "half-thought" },
]

describe("filterL3", () => {
  it("'full' mode returns all notes unchanged", () => {
    const result = filterL3(notes, "full", l3Set)
    expect(result).toHaveLength(4)
    expect(result).toBe(notes) // same reference — no copy
  })

  it("'keyword-only' mode strips L3 items from the list", () => {
    const result = filterL3(notes, "keyword-only", l3Set)
    expect(result).toHaveLength(2)
    expect(result.map((n) => n.id)).toEqual(["hub-note", "important-post"])
  })

  it("'hidden' mode strips L3 items from the list", () => {
    const result = filterL3(notes, "hidden", l3Set)
    expect(result).toHaveLength(2)
    expect(result.map((n) => n.id)).toEqual(["hub-note", "important-post"])
  })

  it("works with slug-keyed items (no id field)", () => {
    const slugItems = [
      { slug: "hub-note" },
      { slug: "draft-fragment" },
    ]
    const result = filterL3(slugItems, "hidden", l3Set)
    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe("hub-note")
  })
})
