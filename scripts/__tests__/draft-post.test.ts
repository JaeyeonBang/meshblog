import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import matter from "gray-matter"

vi.mock("../../src/lib/llm/claude-code", async () => {
  const actual = await vi.importActual<typeof import("../../src/lib/llm/claude-code.ts")>(
    "../../src/lib/llm/claude-code.ts"
  )
  return {
    ...actual,
    callClaudeMessages: vi.fn(),
    checkClaudeAvailable: vi.fn(),
  }
})

import { callClaudeMessages } from "../../src/lib/llm/claude-code.ts"
import {
  unionTags,
  composePost,
  synthesizePost,
  atomicWrite,
} from "../draft-post.ts"
import type { SourceNote } from "../../src/lib/llm/prompts/post-synth.ts"

const mockCallClaudeMessages = vi.mocked(callClaudeMessages)

const goodSynth = {
  title: "Why RLHF is brittle",
  lede: "RLHF works until it doesn't, and the gap is wider than papers suggest.",
  sections: [
    {
      heading: "Reward proxy leakage",
      body:
        "PPO ([[09-ppo|PPO]]) optimizes against a learned reward, and that reward is a frozen snapshot of human preference, " +
        "which the policy can game in subtle ways.",
    },
    {
      heading: "Where it shows up",
      body:
        "Early signals appear in [[01-deep-rl-from-human-preferences|preference RL]] experiments, where reward hacking " +
        "outpaces the supervisor's ability to label new states.",
    },
  ],
  conclusion: "RLHF is brittle in proportion to the static-ness of the reward model.",
}

const sources: SourceNote[] = [
  { slug: "09-ppo", title: "PPO", body: "PPO body.", tags: ["rl", "policy-gradient"] },
  {
    slug: "01-deep-rl-from-human-preferences",
    title: "Deep RL from Human Preferences",
    body: "DRLHP body.",
    tags: ["rl", "rlhf"],
  },
]

describe("unionTags", () => {
  it("dedupes and preserves order across sources", () => {
    expect(unionTags(sources)).toEqual(["rl", "policy-gradient", "rlhf"])
  })

  it("caps at maxLen entries", () => {
    const big: SourceNote[] = [
      { slug: "a", title: "A", body: "", tags: ["t1", "t2", "t3"] },
      { slug: "b", title: "B", body: "", tags: ["t4", "t5", "t6"] },
    ]
    expect(unionTags(big, 4)).toEqual(["t1", "t2", "t3", "t4"])
  })

  it("returns [] when no source has tags", () => {
    expect(unionTags([{ slug: "x", title: "X", body: "", tags: [] }])).toEqual([])
  })
})

describe("composePost", () => {
  it("emits valid frontmatter + body with auto-generated Sources block", () => {
    const md = composePost("My Post", goodSynth, sources, ["rl", "rlhf"])
    const { data, content } = matter(md)
    expect(data.title).toBe("My Post")
    expect(data.draft).toBe(true)
    expect(typeof data.date).toBe("string")
    expect(data.tags).toEqual(["rl", "rlhf"])
    expect(content).toContain("## Reward proxy leakage")
    expect(content).toContain("## Where it shows up")
    expect(content).toContain("## Conclusion")
    expect(content).toContain("## Sources")
    expect(content).toContain("- [[09-ppo|PPO]]")
    expect(content).toContain("- [[01-deep-rl-from-human-preferences|Deep RL from Human Preferences]]")
  })

  it("preserves --title verbatim (does NOT use synth.title)", () => {
    const md = composePost("Override Title", goodSynth, sources, [])
    const { data } = matter(md)
    expect(data.title).toBe("Override Title")
  })
})

describe("synthesizePost", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("succeeds when LLM returns valid + cited synthesis on first try", async () => {
    mockCallClaudeMessages.mockResolvedValueOnce(goodSynth)
    const r = await synthesizePost("RLHF brittleness", sources)
    expect(r.sections).toHaveLength(2)
    expect(mockCallClaudeMessages).toHaveBeenCalledTimes(1)
  })

  it("retries once when first response has uncited sections, succeeds on retry", async () => {
    const uncited = {
      ...goodSynth,
      sections: [
        { heading: "No citation", body: "This section has no wikilink at all, sufficient body length to clear the gate easily." },
        goodSynth.sections[1],
      ],
    }
    mockCallClaudeMessages
      .mockResolvedValueOnce(uncited)
      .mockResolvedValueOnce(goodSynth)
    const r = await synthesizePost("topic", sources)
    expect(r.sections).toHaveLength(2)
    expect(mockCallClaudeMessages).toHaveBeenCalledTimes(2)
  })

  it("throws after retry when both attempts fail Zod validation", async () => {
    mockCallClaudeMessages.mockImplementation(async () => ({ title: "" }))
    await expect(synthesizePost("topic", sources)).rejects.toThrow()
    expect(mockCallClaudeMessages).toHaveBeenCalledTimes(2)
  })

  it("throws after retry when both attempts have uncited sections", async () => {
    const uncited = {
      ...goodSynth,
      sections: [
        { heading: "A", body: "no link a, but plenty of words to clear fifty char minimum body gate." },
        { heading: "B", body: "no link b either, also plenty of words to clear the body length gate." },
      ],
    }
    mockCallClaudeMessages.mockImplementation(async () => uncited)
    await expect(synthesizePost("topic", sources)).rejects.toThrow(/uncited/)
    expect(mockCallClaudeMessages).toHaveBeenCalledTimes(2)
  })

  it("accepts a raw JSON string from the model and parses it", async () => {
    mockCallClaudeMessages.mockResolvedValueOnce(
      "```json\n" + JSON.stringify(goodSynth) + "\n```"
    )
    const r = await synthesizePost("topic", sources)
    expect(r.sections).toHaveLength(2)
  })
})

describe("atomicWrite", () => {
  let scratch: string
  beforeEach(() => { scratch = mkdtempSync(join(tmpdir(), "draft-write-")) })
  afterEach(() => { rmSync(scratch, { recursive: true, force: true }) })

  it("writes content + creates parent dir", () => {
    const target = join(scratch, "deeper", "out.md")
    atomicWrite(target, "hello")
    expect(readFileSync(target, "utf-8")).toBe("hello")
  })

  it("removes the .tmp file after rename", () => {
    const target = join(scratch, "x.md")
    atomicWrite(target, "x")
    expect(existsSync(`${target}.tmp`)).toBe(false)
  })
})
