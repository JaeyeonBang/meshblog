import { describe, it, expect } from "vitest"
import {
  ingestEnrichSchema,
  buildIngestEnrichPrompt,
  INGEST_ENRICH_PROMPT_VERSION,
} from "../ingest-enrich.ts"

describe("ingestEnrichSchema", () => {
  const valid = {
    title: "Some Paper",
    tags: ["rl", "ppo"],
    aliases: ["PPO"],
    body: "# Heading\n\nContent.",
    suggested_links: [{ surface: "PPO", target_slug: "09-ppo" }],
  }

  it("accepts a valid shape", () => {
    const r = ingestEnrichSchema.parse(valid)
    expect(r.title).toBe("Some Paper")
    expect(r.suggested_links).toHaveLength(1)
  })

  it("rejects empty title", () => {
    expect(() => ingestEnrichSchema.parse({ ...valid, title: "" })).toThrow()
  })

  it("rejects title > 200 chars", () => {
    expect(() => ingestEnrichSchema.parse({ ...valid, title: "x".repeat(201) })).toThrow()
  })

  it("rejects > 5 tags", () => {
    expect(() =>
      ingestEnrichSchema.parse({ ...valid, tags: ["a", "b", "c", "d", "e", "f"] })
    ).toThrow()
  })

  it("rejects > 5 aliases", () => {
    expect(() =>
      ingestEnrichSchema.parse({ ...valid, aliases: ["a", "b", "c", "d", "e", "f"] })
    ).toThrow()
  })

  it("rejects > 20 suggested_links", () => {
    const links = Array.from({ length: 21 }, (_, i) => ({
      surface: `s${i}`,
      target_slug: `t${i}`,
    }))
    expect(() => ingestEnrichSchema.parse({ ...valid, suggested_links: links })).toThrow()
  })

  it("rejects empty body", () => {
    expect(() => ingestEnrichSchema.parse({ ...valid, body: "" })).toThrow()
  })

  it("defaults arrays to []", () => {
    const r = ingestEnrichSchema.parse({ title: "X", body: "Y" })
    expect(r.tags).toEqual([])
    expect(r.aliases).toEqual([])
    expect(r.suggested_links).toEqual([])
  })
})

describe("buildIngestEnrichPrompt", () => {
  const vocab = [
    { name: "PPO", slug: "09-ppo", title: "PPO Note" },
    { name: "transformer", slug: "12-transformer-self-attention", title: "Transformer Note" },
  ]

  it("returns system + user messages", () => {
    const msgs = buildIngestEnrichPrompt("raw text", ["rl", "ai"], vocab)
    expect(msgs.some((m) => m.role === "system")).toBe(true)
    expect(msgs.some((m) => m.role === "user")).toBe(true)
  })

  it("includes existing_tags in user message", () => {
    const msgs = buildIngestEnrichPrompt("raw", ["rl", "engineering"], vocab)
    const user = msgs.find((m) => m.role === "user")!
    expect(user.content).toContain("rl")
    expect(user.content).toContain("engineering")
  })

  it("includes existing_entities (name + slug) in user message", () => {
    const msgs = buildIngestEnrichPrompt("raw", [], vocab)
    const user = msgs.find((m) => m.role === "user")!
    expect(user.content).toContain("PPO")
    expect(user.content).toContain("09-ppo")
    expect(user.content).toContain("12-transformer-self-attention")
  })

  it("caps raw text at 16000 chars and appends truncation marker", () => {
    const huge = "x".repeat(20000)
    const msgs = buildIngestEnrichPrompt(huge, [], vocab)
    const user = msgs.find((m) => m.role === "user")!
    expect(user.content).toContain("[...truncated]")
    // Original text should not appear past the cap.
    expect(user.content.length).toBeLessThan(huge.length + 5000)
  })

  it("does NOT truncate when raw is within cap", () => {
    const small = "abc"
    const msgs = buildIngestEnrichPrompt(small, [], vocab)
    const user = msgs.find((m) => m.role === "user")!
    expect(user.content).not.toContain("[...truncated]")
    expect(user.content).toContain("abc")
  })

  it("handles empty existing_tags + empty entity vocab", () => {
    const msgs = buildIngestEnrichPrompt("raw", [], [])
    const user = msgs.find((m) => m.role === "user")!
    expect(user.content).toContain("(none)")
  })

  it("exports prompt version constant", () => {
    expect(INGEST_ENRICH_PROMPT_VERSION).toMatch(/^v\d+/)
  })
})
