/**
 * scripts/__tests__/suggest-links.test.ts
 *
 * Unit tests for the /suggest-links skill.
 * Covers: frontmatter parsing, candidate loading (mock DB), suggestion
 * validation (unknown slugs, malformed JSON), --json output shape.
 *
 * The LLM (callClaudeMessages) is mocked at module level — no real LLM calls.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

// ── Mock LLM ─────────────────────────────────────────────────────────────────

vi.mock("../../src/lib/llm/claude-code", async () => {
  const actual = await vi.importActual<typeof import("../../src/lib/llm/claude-code.ts")>(
    "../../src/lib/llm/claude-code.ts",
  )
  return {
    ...actual,
    callClaudeMessages: vi.fn(),
    checkClaudeAvailable: vi.fn(),
  }
})

import { callClaudeMessages } from "../../src/lib/llm/claude-code.ts"
import { createDb, execute } from "../../src/lib/db/index.ts"
import { suggestionsArraySchema } from "../../src/lib/llm/prompts/suggest-links.ts"

import {
  parseTargetFile,
  loadCandidates,
  validateSuggestions,
  suggestLinks,
  formatSuggestions,
  type ParsedTarget,
} from "../suggest-links.ts"
import type { Suggestion, CandidatePost } from "../../src/lib/llm/prompts/suggest-links.ts"

const mockCallClaudeMessages = vi.mocked(callClaudeMessages)

// ── Fixtures ──────────────────────────────────────────────────────────────────

const goodWikilink: Suggestion = {
  type: "wikilink",
  target_slug: "09-ppo",
  surface: "PPO",
  rationale: "Body directly discusses PPO clipping, which 09-ppo explains in depth.",
  anchor: "PPO의 clipping은 정책 변화를 제어한다.",
}

const goodRelated: Suggestion = {
  type: "related",
  target_slug: "11-rlpr",
  rationale: "Adjacent reward-free RL topic; useful context for the reader.",
}

const candidates: CandidatePost[] = [
  {
    slug: "09-ppo",
    title: "PPO",
    tags: ["rl", "policy-gradient"],
    excerpt: "Proximal Policy Optimization clips the probability ratio...",
  },
  {
    slug: "11-rlpr",
    title: "RLPR",
    tags: ["rl", "reward-free"],
    excerpt: "Reward-less RL using process rewards...",
  },
]

const knownSlugs = new Set(candidates.map((c) => c.slug))

const sampleTarget: import("../../src/lib/llm/prompts/suggest-links.ts").TargetPost = {
  slug: "12-transformer-self-attention",
  title: "Transformer Self-Attention",
  tags: ["transformer", "attention"],
  body: "PPO의 clipping은 정책 변화를 제어한다. RLPR also uses a similar clipping approach.",
}

// ── parseTargetFile ──────────────────────────────────────────────────────────

describe("parseTargetFile", () => {
  let scratch: string

  beforeEach(() => {
    scratch = mkdtempSync(join(tmpdir(), "suggest-links-parse-"))
  })

  afterEach(() => {
    rmSync(scratch, { recursive: true, force: true })
  })

  it("parses title and tags from frontmatter, body from content", () => {
    const filePath = join(scratch, "my-post.md")
    writeFileSync(
      filePath,
      `---
title: My Post
tags: [foo, bar]
---
This is the body.
`,
    )
    const result = parseTargetFile(filePath)
    expect(result.slug).toBe("my-post")
    expect(result.title).toBe("My Post")
    expect(result.tags).toEqual(["foo", "bar"])
    expect(result.body).toBe("This is the body.")
  })

  it("falls back to slug when title is missing", () => {
    const filePath = join(scratch, "no-title.md")
    writeFileSync(filePath, `---\ndraft: true\n---\nbody\n`)
    const result = parseTargetFile(filePath)
    expect(result.slug).toBe("no-title")
    expect(result.title).toBe("no-title")
  })

  it("handles missing tags gracefully (returns empty array)", () => {
    const filePath = join(scratch, "no-tags.md")
    writeFileSync(filePath, `---\ntitle: No Tags\n---\nbody\n`)
    const result = parseTargetFile(filePath)
    expect(result.tags).toEqual([])
  })

  it("throws if file does not exist", () => {
    expect(() => parseTargetFile(join(scratch, "nonexistent.md"))).toThrow(
      /target file not found/,
    )
  })

  it("strips frontmatter from body", () => {
    const filePath = join(scratch, "strip.md")
    writeFileSync(
      filePath,
      `---
title: Strip Test
---
Only this is body.
`,
    )
    const { body } = parseTargetFile(filePath)
    expect(body).not.toContain("---")
    expect(body).toContain("Only this is body.")
  })
})

// ── loadCandidates ────────────────────────────────────────────────────────────

describe("loadCandidates", () => {
  let scratch: string
  let dbPath: string

  beforeEach(() => {
    scratch = mkdtempSync(join(tmpdir(), "suggest-links-db-"))
    dbPath = join(scratch, "test.db")
  })

  afterEach(() => {
    rmSync(scratch, { recursive: true, force: true })
  })

  function seedDb(
    dbPath: string,
    rows: Array<{
      id: string
      slug: string
      title: string
      tags: string
      content: string
      folder_path: string
    }>,
  ): void {
    // createDb applies migrations automatically
    const db = createDb(dbPath)
    for (const row of rows) {
      execute(
        db,
        `INSERT INTO notes (id, slug, title, content, content_hash, folder_path, tags)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [row.id, row.slug, row.title, row.content, "hash-" + row.id, row.folder_path, row.tags],
      )
    }
    db.close()
  }

  it("loads only content/posts rows, excludes target slug", () => {
    seedDb(dbPath, [
      {
        id: "09-ppo",
        slug: "09-ppo",
        title: "PPO",
        tags: '["rl"]',
        content: "PPO body",
        folder_path: "content/posts",
      },
      {
        id: "target-slug",
        slug: "target-slug",
        title: "Target",
        tags: "[]",
        content: "target body",
        folder_path: "content/posts",
      },
      {
        id: "a-note",
        slug: "a-note",
        title: "A Note",
        tags: "[]",
        content: "note body",
        folder_path: "content/notes",
      },
    ])
    const results = loadCandidates("target-slug", dbPath)
    expect(results).toHaveLength(1)
    expect(results[0].slug).toBe("09-ppo")
    expect(results[0].tags).toEqual(["rl"])
  })

  it("truncates excerpt to 500 chars and appends ellipsis", () => {
    const longContent = "x".repeat(800)
    seedDb(dbPath, [
      {
        id: "long-post",
        slug: "long-post",
        title: "Long Post",
        tags: "[]",
        content: longContent,
        folder_path: "content/posts",
      },
    ])
    const [candidate] = loadCandidates("other-target", dbPath)
    expect(candidate.excerpt.length).toBeLessThanOrEqual(505) // 500 + "…"
    expect(candidate.excerpt.endsWith("…")).toBe(true)
  })

  it("returns empty array when no posts exist", () => {
    seedDb(dbPath, [])
    const results = loadCandidates("anything", dbPath)
    expect(results).toEqual([])
  })

  it("throws if DB file does not exist", () => {
    expect(() =>
      loadCandidates("target", join(scratch, "missing.db")),
    ).toThrow(/index DB not found/)
  })
})

// ── validateSuggestions ──────────────────────────────────────────────────────

describe("validateSuggestions", () => {
  it("accepts a valid wikilink suggestion", () => {
    const result = validateSuggestions([goodWikilink], knownSlugs)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe("wikilink")
  })

  it("accepts a valid related suggestion", () => {
    const result = validateSuggestions([goodRelated], knownSlugs)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe("related")
  })

  it("filters out suggestions with unknown target_slug", () => {
    const unknown: Suggestion = {
      type: "related",
      target_slug: "ghost-slug",
      rationale: "Doesn't exist in DB.",
    }
    const result = validateSuggestions([goodWikilink, unknown], knownSlugs)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe("wikilink")
  })

  it("rejects malformed JSON string and throws", () => {
    expect(() =>
      validateSuggestions("not json at all !!!!", knownSlugs),
    ).toThrow()
  })

  it("returns empty array for empty LLM response array", () => {
    const result = validateSuggestions([], knownSlugs)
    expect(result).toEqual([])
  })

  it("accepts JSON with markdown fences", () => {
    const fenced = "```json\n" + JSON.stringify([goodWikilink]) + "\n```"
    const result = validateSuggestions(fenced, knownSlugs)
    expect(result).toHaveLength(1)
  })

  it("rejects suggestions missing required fields (Zod throws)", () => {
    const bad = [{ type: "wikilink", target_slug: "09-ppo" }] // missing surface, rationale, anchor
    expect(() => validateSuggestions(bad, knownSlugs)).toThrow()
  })

  it("accepts raw JSON string (not wrapped array)", () => {
    const jsonStr = JSON.stringify([goodRelated])
    const result = validateSuggestions(jsonStr, knownSlugs)
    expect(result).toHaveLength(1)
  })
})

// ── suggestLinks ─────────────────────────────────────────────────────────────

describe("suggestLinks", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns validated suggestions on first attempt", async () => {
    mockCallClaudeMessages.mockResolvedValueOnce([goodWikilink, goodRelated])
    const result = await suggestLinks(sampleTarget, candidates, 8)
    expect(result).toHaveLength(2)
    expect(mockCallClaudeMessages).toHaveBeenCalledTimes(1)
  })

  it("respects the --limit cap", async () => {
    mockCallClaudeMessages.mockResolvedValueOnce([goodWikilink, goodRelated])
    const result = await suggestLinks(sampleTarget, candidates, 1)
    expect(result).toHaveLength(1)
  })

  it("retries once when first response fails validation, succeeds on retry", async () => {
    // First response: unknown slug → all filtered out, but that doesn't throw;
    // try a malformed payload instead to trigger the retry
    mockCallClaudeMessages
      .mockRejectedValueOnce(new Error("simulated transient error"))
      .mockResolvedValueOnce([goodWikilink])
    const result = await suggestLinks(sampleTarget, candidates, 8)
    expect(result).toHaveLength(1)
    expect(mockCallClaudeMessages).toHaveBeenCalledTimes(2)
  })

  it("throws after retry when both attempts fail", async () => {
    mockCallClaudeMessages.mockImplementation(async () => {
      throw new Error("permanent failure")
    })
    await expect(suggestLinks(sampleTarget, candidates, 8)).rejects.toThrow()
    expect(mockCallClaudeMessages).toHaveBeenCalledTimes(2)
  })

  it("filters suggestions whose target_slug is not in candidates", async () => {
    const ghostSlug: Suggestion = {
      type: "related",
      target_slug: "does-not-exist",
      rationale: "phantom",
    }
    mockCallClaudeMessages.mockResolvedValueOnce([ghostSlug, goodWikilink])
    const result = await suggestLinks(sampleTarget, candidates, 8)
    // ghostSlug filtered; goodWikilink kept
    expect(result).toHaveLength(1)
    expect(result[0].target_slug).toBe("09-ppo")
  })

  it("returns empty array when LLM returns empty array", async () => {
    mockCallClaudeMessages.mockResolvedValueOnce([])
    const result = await suggestLinks(sampleTarget, candidates, 8)
    expect(result).toEqual([])
  })
})

// ── formatSuggestions ─────────────────────────────────────────────────────────

describe("formatSuggestions", () => {
  it("prints 'No suggestions' message when list is empty", () => {
    const output = formatSuggestions([], "content/posts/foo.md")
    expect(output).toContain("No suggestions")
  })

  it("formats a wikilink suggestion with anchor + rationale", () => {
    const output = formatSuggestions([goodWikilink], "content/posts/foo.md")
    expect(output).toContain("WIKILINK")
    expect(output).toContain("[[09-ppo|PPO]]")
    expect(output).toContain(goodWikilink.anchor)
    expect(output).toContain(goodWikilink.rationale)
  })

  it("formats a related suggestion with rationale", () => {
    const output = formatSuggestions([goodRelated], "content/posts/foo.md")
    expect(output).toContain("RELATED")
    expect(output).toContain("11-rlpr")
    expect(output).toContain(goodRelated.rationale)
  })

  it("shows correct count summary", () => {
    const output = formatSuggestions([goodWikilink, goodRelated], "content/posts/foo.md")
    expect(output).toContain("2 suggestion(s)")
    expect(output).toContain("1 wikilink")
    expect(output).toContain("1 related")
  })

  it("--json flag: returned array is JSON-serialisable and matches schema", () => {
    const suggestions = [goodWikilink, goodRelated]
    // Simulate --json output: caller uses JSON.stringify
    const jsonOutput = JSON.stringify(suggestions, null, 2)
    const parsed = JSON.parse(jsonOutput)
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed).toHaveLength(2)
    expect(parsed[0].type).toBe("wikilink")
    expect(parsed[1].type).toBe("related")
    // Each element must satisfy the schema
    expect(() => suggestionsArraySchema.parse(parsed)).not.toThrow()
  })
})
