import { describe, it, expect } from "vitest"
import { autoLink } from "../lib/ingest-helpers/auto-link.ts"

describe("autoLink", () => {
  it("wraps a plain-prose match", () => {
    const r = autoLink("This paper builds on PPO and uses GRPO.", [
      { surface: "PPO", target_slug: "09-ppo" },
    ])
    expect(r.body).toContain("[[09-ppo|PPO]]")
    expect(r.applied).toEqual([{ surface: "PPO", target_slug: "09-ppo" }])
  })

  it("preserves original surface casing in the alias", () => {
    const r = autoLink("Lower-case ppo here.", [
      { surface: "PPO", target_slug: "09-ppo" },
    ])
    expect(r.body).toContain("[[09-ppo|ppo]]")
  })

  it("only wraps the FIRST occurrence", () => {
    const r = autoLink("PPO appears, then PPO again, and PPO once more.", [
      { surface: "PPO", target_slug: "09-ppo" },
    ])
    const matches = r.body.match(/\[\[09-ppo\|PPO\]\]/g) ?? []
    expect(matches.length).toBe(1)
  })

  it("skips matches inside fenced code blocks", () => {
    const body = "Pre.\n\n```python\nx = PPO()\n```\n\nPost."
    const r = autoLink(body, [{ surface: "PPO", target_slug: "09-ppo" }])
    expect(r.body).toBe(body)
    expect(r.applied).toEqual([])
  })

  it("wraps the prose match when there is also a fenced occurrence", () => {
    const body = "First the prose mentions PPO directly.\n\n```\nx = PPO()\n```\n"
    const r = autoLink(body, [{ surface: "PPO", target_slug: "09-ppo" }])
    expect(r.body).toContain("[[09-ppo|PPO]]")
    // The fenced occurrence stays untouched.
    expect(r.body).toContain("x = PPO()")
  })

  it("skips matches inside inline code spans", () => {
    const body = "The token `PPO` should not be linked."
    const r = autoLink(body, [{ surface: "PPO", target_slug: "09-ppo" }])
    expect(r.body).toBe(body)
  })

  it("skips matches inside existing wikilinks", () => {
    const body = "Already linked: [[09-ppo|PPO]] earlier in the doc. Plain PPO afterward."
    const r = autoLink(body, [{ surface: "PPO", target_slug: "09-ppo" }])
    // The plain-prose "PPO" after the existing wikilink should now be wrapped.
    expect(r.body.match(/\[\[09-ppo\|PPO\]\]/g)?.length).toBe(2)
  })

  it("avoids partial-word matches via word-boundary regex", () => {
    const body = "We are training models with the AI vendor's tool."
    const r = autoLink(body, [{ surface: "AI", target_slug: "ai-note" }])
    // "AI" should match (whole word), not "training" or "vendor".
    expect(r.body).toContain("[[ai-note|AI]]")
    expect(r.body).toContain("training")  // unchanged
    expect(r.body).toContain("vendor")    // unchanged
  })

  it("handles multiple suggestions independently", () => {
    const r = autoLink("PPO and GRPO are both policy optimizers.", [
      { surface: "PPO", target_slug: "09-ppo" },
      { surface: "GRPO", target_slug: "10-grpo" },
    ])
    expect(r.body).toContain("[[09-ppo|PPO]]")
    expect(r.body).toContain("[[10-grpo|GRPO]]")
    expect(r.applied).toHaveLength(2)
  })

  it("returns body unchanged when no suggestions provided", () => {
    const body = "Some content with PPO here."
    const r = autoLink(body, [])
    expect(r.body).toBe(body)
    expect(r.applied).toEqual([])
  })

  it("skips suggestions whose surface never appears", () => {
    const body = "Content about transformers."
    const r = autoLink(body, [{ surface: "PPO", target_slug: "09-ppo" }])
    expect(r.body).toBe(body)
    expect(r.applied).toEqual([])
  })

  it("skips suggestions with surface < 2 chars", () => {
    const body = "A is for apple."
    const r = autoLink(body, [{ surface: "A", target_slug: "ai" }])
    expect(r.body).toBe(body)
    expect(r.applied).toEqual([])
  })

  it("escapes regex special characters in surface", () => {
    const body = "Use C++ for systems."
    const r = autoLink(body, [{ surface: "C++", target_slug: "cpp" }])
    expect(r.body).toContain("Use C++")
    // Whether it wraps or not depends on \b-boundary semantics — at minimum it
    // must not crash and must not produce a malformed link.
    expect(r.body).not.toContain("[[cpp|C+++]]")
  })
})
