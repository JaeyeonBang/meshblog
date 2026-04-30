import { describe, it, expect } from "vitest"
import { extractionResultSchema, extractJsonObject } from "../graph.ts"

describe("extractionResultSchema (Zod robustness)", () => {
  it("parses valid LLM output", () => {
    const data = {
      entities: [{ name: "React", type: "technology", description: "UI lib" }],
      relationships: [{ source: "React", target: "JS", relationship: "uses" }],
    }
    const parsed = extractionResultSchema.parse(data)
    expect(parsed.entities).toHaveLength(1)
    expect(parsed.relationships).toHaveLength(1)
  })

  it("defaults missing arrays to []", () => {
    const parsed = extractionResultSchema.parse({})
    expect(parsed.entities).toEqual([])
    expect(parsed.relationships).toEqual([])
  })

  it("coerces unknown entity type to 'other'", () => {
    const parsed = extractionResultSchema.parse({
      entities: [{ name: "X", type: "unknown_type", description: "" }],
    })
    expect(parsed.entities[0].type).toBe("other")
  })

  it("rejects malformed entities (missing name)", () => {
    expect(() =>
      extractionResultSchema.parse({
        entities: [{ type: "technology", description: "" }],
      })
    ).toThrow()
  })

  it("accepts up to 25 entities (Haiku-era cap)", () => {
    const data = {
      entities: Array.from({ length: 25 }, (_, i) => ({
        name: `Entity${i}`,
        type: "technology",
        description: "",
      })),
    }
    const parsed = extractionResultSchema.parse(data)
    expect(parsed.entities).toHaveLength(25)
  })

  it("rejects more than 25 entities", () => {
    const data = {
      entities: Array.from({ length: 26 }, (_, i) => ({
        name: `Entity${i}`,
        type: "technology",
        description: "",
      })),
    }
    expect(() => extractionResultSchema.parse(data)).toThrow()
  })
})

describe("extractJsonObject (Haiku output robustness)", () => {
  it("returns plain JSON unchanged", () => {
    const raw = '{"entities":[],"relationships":[]}'
    expect(extractJsonObject(raw)).toBe(raw)
  })

  it("strips ```json fences", () => {
    const raw = '```json\n{"entities":[]}\n```'
    expect(extractJsonObject(raw)).toBe('{"entities":[]}')
  })

  it("strips prose prefix (Haiku-style)", () => {
    const raw = "Here's the extraction result:\n\n{\"entities\":[],\"relationships\":[]}"
    expect(extractJsonObject(raw)).toBe('{"entities":[],"relationships":[]}')
  })

  it("strips trailing prose", () => {
    const raw = '{"entities":[]}\n\nLet me know if you need more.'
    expect(extractJsonObject(raw)).toBe('{"entities":[]}')
  })

  it("strips both prefix + suffix", () => {
    const raw = "Sure! {\"entities\":[]} — done."
    expect(extractJsonObject(raw)).toBe('{"entities":[]}')
  })

  it("falls back gracefully on missing braces", () => {
    expect(extractJsonObject("no json here")).toBe("no json here")
  })
})
