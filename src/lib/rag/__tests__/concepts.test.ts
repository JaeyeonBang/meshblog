import { describe, it, expect, vi, afterEach } from "vitest"
import {
  conceptNameSchema,
  buildConceptNamingPrompt,
  buildConceptNamingPromptString,
} from "../../llm/prompts/concept-naming.ts"

// Mock callOpenRouter before importing concepts (so the import-time wiring
// resolves to the mock). We use OpenRouter not `claude -p` for cost reasons —
// see the comment block in concepts.ts:nameCommunity.
vi.mock("../../llm/openrouter", () => ({
  callOpenRouter: vi.fn(),
}))

import { callOpenRouter } from "../../llm/openrouter.ts"
import { nameCommunity } from "../concepts.ts"

const mockCallOpenRouter = vi.mocked(callOpenRouter)

/** Build a fake OpenRouter Response carrying `content` as the assistant message. */
function fakeResponse(content: string): Response {
  const body = JSON.stringify({
    choices: [{ message: { content } }],
  })
  return new Response(body, { status: 200, headers: { "Content-Type": "application/json" } })
}

describe("conceptNameSchema", () => {
  it("accepts a valid shape", () => {
    const result = conceptNameSchema.parse({
      name: "Attention Mechanisms",
      description: "Concepts related to transformer self-attention.",
    })
    expect(result.name).toBe("Attention Mechanisms")
    expect(result.description).toBe("Concepts related to transformer self-attention.")
  })

  it("rejects empty name", () => {
    expect(() =>
      conceptNameSchema.parse({ name: "", description: "A description." })
    ).toThrow()
  })

  it("rejects name longer than 80 chars", () => {
    expect(() =>
      conceptNameSchema.parse({
        name: "A".repeat(81),
        description: "A description.",
      })
    ).toThrow()
  })

  it("accepts name exactly 80 chars", () => {
    const result = conceptNameSchema.parse({
      name: "A".repeat(80),
      description: "A description.",
    })
    expect(result.name).toHaveLength(80)
  })

  it("rejects empty description", () => {
    expect(() =>
      conceptNameSchema.parse({ name: "Attention Mechanisms", description: "" })
    ).toThrow()
  })

  it("rejects description longer than 240 chars", () => {
    expect(() =>
      conceptNameSchema.parse({
        name: "Attention Mechanisms",
        description: "A".repeat(241),
      })
    ).toThrow()
  })
})

describe("buildConceptNamingPrompt (ChatMessage[] form)", () => {
  it("includes member names verbatim in the user prompt", () => {
    const members = ["self-attention", "cross-attention", "multi-head attention"]
    const messages = buildConceptNamingPrompt(members)
    const userMsg = messages.find((m) => m.role === "user")
    expect(userMsg).toBeDefined()
    for (const name of members) {
      expect(userMsg!.content).toContain(name)
    }
  })

  it("caps member list at 20 entries", () => {
    const members = Array.from({ length: 30 }, (_, i) => `entity-${i}`)
    const messages = buildConceptNamingPrompt(members)
    const userMsg = messages.find((m) => m.role === "user")
    expect(userMsg).toBeDefined()
    expect(userMsg!.content).not.toContain("entity-20")
    expect(userMsg!.content).toContain("entity-19")
  })

  it("includes optional member descriptions when provided", () => {
    const members = ["PPO", "GRPO"]
    const descs = ["Proximal Policy Optimization", "Group Relative Policy Optimization"]
    const messages = buildConceptNamingPrompt(members, descs)
    const userMsg = messages.find((m) => m.role === "user")
    expect(userMsg).toBeDefined()
    expect(userMsg!.content).toContain("Proximal Policy Optimization")
    expect(userMsg!.content).toContain("Group Relative Policy Optimization")
  })

  it("returns system and user messages", () => {
    const messages = buildConceptNamingPrompt(["entity-a"])
    expect(messages.some((m) => m.role === "system")).toBe(true)
    expect(messages.some((m) => m.role === "user")).toBe(true)
  })
})

describe("buildConceptNamingPromptString (single-string form, kept for future single-prompt LLMs)", () => {
  it("includes all member names verbatim", () => {
    const members = ["self-attention", "cross-attention"]
    const prompt = buildConceptNamingPromptString(members)
    for (const name of members) expect(prompt).toContain(name)
  })

  it("caps member list at 20", () => {
    const members = Array.from({ length: 30 }, (_, i) => `entity-${i}`)
    const prompt = buildConceptNamingPromptString(members)
    expect(prompt).not.toContain("entity-20")
    expect(prompt).toContain("entity-19")
  })

  it("includes both system instructions and user content", () => {
    const prompt = buildConceptNamingPromptString(["entity-a"])
    expect(prompt).toContain("knowledge graph labeling system")
    expect(prompt).toContain("Community members:")
  })
})

describe("nameCommunity", () => {
  const originalKey = process.env.OPENROUTER_API_KEY

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.OPENROUTER_API_KEY
    } else {
      process.env.OPENROUTER_API_KEY = originalKey
    }
    vi.clearAllMocks()
  })

  it("returns heuristic when OPENROUTER_API_KEY is not set", async () => {
    delete process.env.OPENROUTER_API_KEY

    const result = await nameCommunity(["self-attention", "cross-attention"])
    expect(result.name).toBe("self-attention")
    expect(result.description).toContain("self-attention")
    expect(result.description).toContain("cross-attention")
  })

  it("returns LLM-named label when callOpenRouter returns valid JSON", async () => {
    process.env.OPENROUTER_API_KEY = "test-key"

    const llmJson = JSON.stringify({
      name: "Attention Mechanisms",
      description: "Concepts related to how transformer models compute weighted token relationships.",
    })
    mockCallOpenRouter.mockResolvedValueOnce(fakeResponse(llmJson))

    const result = await nameCommunity(["self-attention", "cross-attention", "multi-head attention"])
    expect(result.name).toBe("Attention Mechanisms")
    expect(result.description).toContain("transformer")
  })

  it("retries once and falls back to heuristic when both LLM calls return invalid JSON", async () => {
    process.env.OPENROUTER_API_KEY = "test-key"

    mockCallOpenRouter.mockResolvedValue(fakeResponse("not valid json at all {{}"))

    const result = await nameCommunity(["PPO", "GRPO", "RLHF"])
    expect(result.name).toBe("PPO")
    expect(result.description).toContain("PPO")
    expect(mockCallOpenRouter).toHaveBeenCalledTimes(2)
  })

  it("retries once and falls back to heuristic when LLM returns Zod-invalid shape twice", async () => {
    process.env.OPENROUTER_API_KEY = "test-key"

    const badJson = JSON.stringify({ name: "", description: "Some description." })
    mockCallOpenRouter.mockResolvedValue(fakeResponse(badJson))

    const result = await nameCommunity(["transformer", "encoder", "decoder"])
    expect(result.name).toBe("transformer")
    expect(result.description).toContain("transformer")
    expect(mockCallOpenRouter).toHaveBeenCalledTimes(2)
  })

  it("succeeds on retry when first call fails but second returns valid JSON", async () => {
    process.env.OPENROUTER_API_KEY = "test-key"

    const goodJson = JSON.stringify({
      name: "Reinforcement Learning Methods",
      description: "Methods for training agents through reward signals including PPO and GRPO.",
    })
    mockCallOpenRouter
      .mockResolvedValueOnce(fakeResponse("not json"))
      .mockResolvedValueOnce(fakeResponse(goodJson))

    const result = await nameCommunity(["PPO", "GRPO"])
    expect(result.name).toBe("Reinforcement Learning Methods")
    expect(mockCallOpenRouter).toHaveBeenCalledTimes(2)
  })
})
