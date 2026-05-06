import { describe, it, expect } from "vitest"
import {
  postSynthSchema,
  buildPostSynthPrompt,
  findUncitedSections,
  POST_SYNTH_PROMPT_VERSION,
  type PostSynth,
  type SourceNote,
} from "../post-synth.ts"

const validSynth: PostSynth = {
  title: "Why RLHF is brittle",
  lede: "Reinforcement learning from human feedback works well, until it doesn't.",
  sections: [
    {
      heading: "What RLHF actually optimizes",
      body:
        "The classic recipe ([[09-ppo|PPO]] on top of a learned reward model) trains the policy to maximize a proxy of human preference. " +
        "But proxies leak.",
    },
    {
      heading: "Where it breaks",
      body:
        "When the reward model is a finite snapshot, the policy can climb gradients that the snapshot didn't intend. " +
        "[[01-deep-rl-from-human-preferences|Deep RL from Human Preferences]] documented early symptoms.",
    },
  ],
  conclusion: "RLHF is brittle in proportion to how confident you are in the reward model.",
}

describe("postSynthSchema", () => {
  it("accepts a valid shape", () => {
    const r = postSynthSchema.parse(validSynth)
    expect(r.sections).toHaveLength(2)
  })

  it("rejects fewer than 2 sections", () => {
    expect(() =>
      postSynthSchema.parse({ ...validSynth, sections: [validSynth.sections[0]] })
    ).toThrow()
  })

  it("rejects more than 8 sections", () => {
    const tooMany = Array.from({ length: 9 }, () => validSynth.sections[0])
    expect(() => postSynthSchema.parse({ ...validSynth, sections: tooMany })).toThrow()
  })

  it("rejects section body shorter than 50 chars", () => {
    const tiny = {
      ...validSynth,
      sections: [
        { heading: "Short", body: "tiny." },
        validSynth.sections[1],
      ],
    }
    expect(() => postSynthSchema.parse(tiny)).toThrow()
  })

  it("rejects empty heading", () => {
    const bad = {
      ...validSynth,
      sections: [{ ...validSynth.sections[0], heading: "" }, validSynth.sections[1]],
    }
    expect(() => postSynthSchema.parse(bad)).toThrow()
  })

  it("rejects empty title", () => {
    expect(() => postSynthSchema.parse({ ...validSynth, title: "" })).toThrow()
  })

  it("rejects lede shorter than 20 chars", () => {
    expect(() => postSynthSchema.parse({ ...validSynth, lede: "tiny." })).toThrow()
  })

  it("rejects conclusion shorter than 20 chars", () => {
    expect(() => postSynthSchema.parse({ ...validSynth, conclusion: "tiny." })).toThrow()
  })
})

describe("buildPostSynthPrompt", () => {
  const sources: SourceNote[] = [
    { slug: "09-ppo", title: "PPO Note", body: "PPO body content here.", tags: ["rl"] },
    { slug: "11-rlpr", title: "RLPR Note", body: "RLPR body content here.", tags: ["rl"] },
  ]

  it("includes all source slugs and titles", () => {
    const msgs = buildPostSynthPrompt("RLHF brittleness", sources)
    const user = msgs.find((m) => m.role === "user")!
    expect(user.content).toContain("09-ppo")
    expect(user.content).toContain("11-rlpr")
    expect(user.content).toContain("PPO Note")
    expect(user.content).toContain("RLPR Note")
  })

  it("includes the topic in user content", () => {
    const msgs = buildPostSynthPrompt("RLHF brittleness", sources)
    const user = msgs.find((m) => m.role === "user")!
    expect(user.content).toContain("RLHF brittleness")
  })

  it("caps each source body at 8000 chars with truncation marker", () => {
    const big: SourceNote[] = [
      { slug: "huge", title: "Huge", body: "x".repeat(12000), tags: [] },
      sources[1],
    ]
    const msgs = buildPostSynthPrompt("topic", big)
    const user = msgs.find((m) => m.role === "user")!
    expect(user.content).toContain("[...truncated]")
  })

  it("returns system + user messages", () => {
    const msgs = buildPostSynthPrompt("topic", sources)
    expect(msgs.some((m) => m.role === "system")).toBe(true)
    expect(msgs.some((m) => m.role === "user")).toBe(true)
  })

  it("exports prompt version", () => {
    expect(POST_SYNTH_PROMPT_VERSION).toMatch(/^v\d+/)
  })
})

describe("findUncitedSections", () => {
  it("returns empty when all sections cite a source slug", () => {
    const result = findUncitedSections(validSynth, ["09-ppo", "01-deep-rl-from-human-preferences"])
    expect(result).toEqual([])
  })

  it("returns sections that lack any citation", () => {
    const result: PostSynth = {
      ...validSynth,
      sections: [
        { heading: "Section A", body: "This is a 60-char block of plain prose with no wiki." },
        validSynth.sections[1],
      ],
    }
    const uncited = findUncitedSections(result, ["09-ppo", "01-deep-rl-from-human-preferences"])
    expect(uncited).toEqual([{ index: 0, heading: "Section A" }])
  })

  it("matches alias-form wikilinks like [[slug|surface]]", () => {
    const r: PostSynth = {
      ...validSynth,
      sections: [
        {
          heading: "with alias",
          body: "This section cites [[09-ppo|the PPO paper]] explicitly in body.",
        },
        validSynth.sections[1],
      ],
    }
    const uncited = findUncitedSections(r, ["09-ppo", "01-deep-rl-from-human-preferences"])
    expect(uncited.find((u) => u.index === 0)).toBeUndefined()
  })

  it("matches bare wikilinks [[slug]]", () => {
    const r: PostSynth = {
      ...validSynth,
      sections: [
        { heading: "bare", body: "This section cites [[09-ppo]] without an alias body." },
        validSynth.sections[1],
      ],
    }
    const uncited = findUncitedSections(r, ["09-ppo", "01-deep-rl-from-human-preferences"])
    expect(uncited.find((u) => u.index === 0)).toBeUndefined()
  })

  it("ignores wikilinks to slugs not in source list", () => {
    const r: PostSynth = {
      ...validSynth,
      sections: [
        {
          heading: "wrong target",
          body: "This section cites [[some-other-note|surface]] not in sources.",
        },
        validSynth.sections[1],
      ],
    }
    const uncited = findUncitedSections(r, ["09-ppo", "01-deep-rl-from-human-preferences"])
    expect(uncited.find((u) => u.index === 0)).toEqual({ index: 0, heading: "wrong target" })
  })

  it("handles all sections uncited", () => {
    const r: PostSynth = {
      ...validSynth,
      sections: [
        { heading: "A", body: "no link here, just sufficient body length to clear the 50-char gate." },
        { heading: "B", body: "no link here either, again sufficient body length to clear the gate." },
      ],
    }
    const uncited = findUncitedSections(r, ["09-ppo"])
    expect(uncited).toHaveLength(2)
  })
})
