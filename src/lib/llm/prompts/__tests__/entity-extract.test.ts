import { describe, it, expect } from "vitest"
import { buildEntityExtractionPrompt } from "../entity-extract.ts"

describe("buildEntityExtractionPrompt", () => {
  it("emits a system + user message pair", () => {
    const msgs = buildEntityExtractionPrompt("hello world")
    expect(msgs).toHaveLength(2)
    expect(msgs[0].role).toBe("system")
    expect(msgs[1].role).toBe("user")
  })

  it("system prompt asks for up to 25 entities (Haiku-era cap)", () => {
    const [system] = buildEntityExtractionPrompt("x")
    expect(system.content).toMatch(/up to 25 entities/i)
    expect(system.content).toMatch(/up to 25.*relationships/i)
  })

  it("system prompt requests JSON-only output (no prose)", () => {
    const [system] = buildEntityExtractionPrompt("x")
    expect(system.content).toMatch(/Return ONLY the JSON/i)
  })

  it("strips HTML tags from note content", () => {
    const [, user] = buildEntityExtractionPrompt("<p>hello</p> <b>world</b>")
    expect(user.content).not.toMatch(/</)
    expect(user.content).toContain("hello")
    expect(user.content).toContain("world")
  })

  it("slices content to 16000 chars (Haiku-era cap)", () => {
    const huge = "x".repeat(20000)
    const [, user] = buildEntityExtractionPrompt(huge)
    expect(user.content.length).toBeLessThanOrEqual(16000)
    // Make sure we're using the new cap, not the old 8000
    expect(user.content.length).toBeGreaterThan(8000)
  })

  it("falls back to 'Empty note' for empty input", () => {
    const [, user] = buildEntityExtractionPrompt("")
    expect(user.content).toBe("Empty note")
  })
})
