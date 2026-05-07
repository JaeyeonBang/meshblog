/**
 * pipeline-e2e.test.ts — Phase 1+2+3 handoff integration test.
 *
 * Each script (ingest-raw, draft-post, promote) has its own unit tests.
 * This file proves the *handoffs* between them:
 *   1. ingestOne writes a note whose frontmatter shape (tags non-empty, draft:true,
 *      title) is exactly what /promote's checkFile + composePromoted consume.
 *   2. The body it writes (with auto-linked wikilinks) is exactly the SourceNote
 *      shape /draft-post's synthesizePost + composePost consume.
 *   3. The post /draft-post writes (frontmatter with tags + draft:true) is exactly
 *      what /promote can flip to draft:false + published_at.
 *
 * LLMs are mocked. Filesystem is real (scratch dir). DB layer is bypassed by
 * constructing SourceNote directly from disk-read frontmatter — the actual
 * loadSources DB call is exercised in build-index.test.ts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import matter from "gray-matter"

vi.mock("../../src/lib/llm/openrouter", () => ({
  callOpenRouter: vi.fn(),
}))

import { callOpenRouter } from "../../src/lib/llm/openrouter.ts"
import { ingestOne } from "../ingest-raw.ts"
import {
  synthesizePost,
  composePost,
  unionTags,
  atomicWrite as draftAtomicWrite,
} from "../draft-post.ts"
import {
  checkFile,
  composePromoted,
  isDraft,
  promoteOne,
  todayISO,
} from "../promote.ts"
import type { SourceNote } from "../../src/lib/llm/prompts/post-synth.ts"

const mockCallOpenRouter = vi.mocked(callOpenRouter)

function fakeOpenRouterResponse(content: string): Response {
  const body = JSON.stringify({ choices: [{ message: { content } }] })
  return new Response(body, { status: 200, headers: { "Content-Type": "application/json" } })
}

function setMockLLM(payload: object) {
  mockCallOpenRouter.mockImplementationOnce(async () =>
    fakeOpenRouterResponse(JSON.stringify(payload))
  )
}

describe("Phase 1+2+3 pipeline handoff", () => {
  let scratch: string
  let cwdBefore: string

  beforeEach(() => {
    cwdBefore = process.cwd()
    scratch = mkdtempSync(join(tmpdir(), "pipeline-e2e-"))
    process.chdir(scratch)
    vi.clearAllMocks()
  })
  afterEach(() => {
    process.chdir(cwdBefore)
    rmSync(scratch, { recursive: true, force: true })
  })

  it("ingest → promote: ingest output passes promote gate as-is", async () => {
    const src = join(scratch, "input.md")
    writeFileSync(src, "# RLHF\nTraining LMs from preferences.")

    setMockLLM({
      title: "RLHF Survey",
      tags: ["rl", "alignment"],
      aliases: ["rlhf"],
      body: "# RLHF\n\nTraining language models from human preferences.",
      suggested_links: [],
    })

    const ingestResult = await ingestOne(
      src,
      { autoLink: false, refresh: false, force: false, dryRun: false, estimate: false },
      { callOpenRouter, vocab: [], existingTags: ["rl"] },
    )

    expect(ingestResult.status).toBe("written")
    const notePath = ingestResult.path!

    const check = checkFile(notePath)
    expect(check.ok).toBe(true)

    expect(isDraft(notePath)).toBe(true)

    const today = todayISO()
    const promoted = composePromoted(notePath, today)
    const { data: promotedFm } = matter(promoted)
    expect(promotedFm.draft).toBe(false)
    expect(promotedFm.title).toBe("RLHF Survey")
    expect(promotedFm.tags).toEqual(["rl", "alignment"])
    expect(promotedFm.aliases).toEqual(["rlhf"])
    const stamp = promotedFm.published_at instanceof Date
      ? promotedFm.published_at.toISOString().slice(0, 10)
      : String(promotedFm.published_at)
    expect(stamp).toBe(today)
  })

  it("ingest → promote: empty tags from LLM cause promote gate to FAIL with clear reason", async () => {
    const src = join(scratch, "untagged.md")
    writeFileSync(src, "raw")

    setMockLLM({
      title: "Untagged",
      tags: [],
      aliases: [],
      body: "Body.",
      suggested_links: [],
    })

    const r = await ingestOne(
      src,
      { autoLink: false, refresh: false, force: false, dryRun: false, estimate: false },
      { callOpenRouter, vocab: [], existingTags: [] },
    )
    expect(r.status).toBe("written")

    const check = checkFile(r.path!)
    expect(check.ok).toBe(false)
    expect((check as { reason: string }).reason).toMatch(/tags is empty/)
  })

  it("ingest → draft → promote: full chain on a single ingested note", async () => {
    const src = join(scratch, "ppo-paper.md")
    writeFileSync(
      src,
      "# Proximal Policy Optimization\n\nA reinforcement learning algorithm by Schulman et al."
    )

    setMockLLM({
      title: "Proximal Policy Optimization",
      tags: ["rl", "policy-gradient"],
      aliases: ["PPO"],
      body: "# Proximal Policy Optimization\n\nA clipped surrogate objective for stable policy updates.",
      suggested_links: [],
    })

    const ingest = await ingestOne(
      src,
      { autoLink: false, refresh: false, force: false, dryRun: false, estimate: false },
      { callOpenRouter, vocab: [], existingTags: [] },
    )
    expect(ingest.status).toBe("written")

    const noteRaw = readFileSync(ingest.path!, "utf-8")
    const { data: noteFm, content: noteBody } = matter(noteRaw)

    const sources: SourceNote[] = [
      {
        slug: "proximal-policy-optimization",
        title: noteFm.title as string,
        body: noteBody,
        tags: noteFm.tags as string[],
      },
    ]

    setMockLLM({
      title: "PPO in Practice",
      lede: "PPO has become the default policy gradient for many RL setups thanks to its trust-region surrogate. ".repeat(2),
      sections: [
        {
          heading: "What PPO clips",
          body:
            "The clipped objective stabilizes policy updates by bounding the importance ratio. " +
            "See [[proximal-policy-optimization|the original paper]] for the surrogate derivation." +
            " Empirically this is what makes PPO usable without elaborate trust regions.",
        },
        {
          heading: "Where PPO breaks",
          body:
            "Long-horizon credit assignment still bites — the same issue any vanilla policy gradient hits. " +
            "[[proximal-policy-optimization|PPO]] doesn't fix that; it only stabilizes per-step updates." +
            " Newer methods layer on top of this idea.",
        },
      ],
      conclusion: "PPO is a solid baseline that most papers compare against; nothing more, nothing less.",
    })

    const synth = await synthesizePost("PPO in Practice", sources)
    expect(synth.sections).toHaveLength(2)

    const tags = unionTags(sources)
    expect(tags).toEqual(["rl", "policy-gradient"])

    const postContent = composePost("PPO in Practice", synth, sources, tags)
    const postPath = join("content/posts", "ppo-in-practice.md")
    draftAtomicWrite(postPath, postContent)

    const { data: postFm, content: postBody } = matter(readFileSync(postPath, "utf-8"))
    expect(postFm.draft).toBe(true)
    expect(postFm.tags).toEqual(["rl", "policy-gradient"])
    expect(postBody).toContain("[[proximal-policy-optimization|")
    expect(postBody).toContain("## Sources")
    expect(postBody).toContain("## Conclusion")

    const postCheck = checkFile(postPath)
    expect(postCheck.ok).toBe(true)

    const today = todayISO()
    const outcome = promoteOne(postPath, { dryRun: false, refresh: false }, today)
    expect(outcome.outcome).toBe("promoted")

    const finalRaw = readFileSync(postPath, "utf-8")
    const { data: finalFm } = matter(finalRaw)
    expect(finalFm.draft).toBe(false)
    const stamp = finalFm.published_at instanceof Date
      ? finalFm.published_at.toISOString().slice(0, 10)
      : String(finalFm.published_at)
    expect(stamp).toBe(today)
  })

  it("auto-link wikilinks survive into post sources block target slugs", async () => {
    const src = join(scratch, "transformer.md")
    writeFileSync(src, "Transformers use attention.")

    setMockLLM({
      title: "Attention Is All You Need",
      tags: ["transformers"],
      aliases: [],
      body: "Transformers use attention to weight token interactions.",
      suggested_links: [
        { surface: "attention", target_slug: "attention-mechanism" },
      ],
    })

    const r = await ingestOne(
      src,
      { autoLink: true, refresh: false, force: false, dryRun: false, estimate: false },
      {
        callOpenRouter,
        vocab: [{ name: "attention", slug: "attention-mechanism", title: "Attention" }],
        existingTags: [],
      },
    )
    expect(r.status).toBe("written")

    const body = readFileSync(r.path!, "utf-8")
    expect(body).toContain("[[attention-mechanism|attention]]")

    // The promoted file should preserve the wikilink verbatim
    const promoted = composePromoted(r.path!, todayISO())
    expect(promoted).toContain("[[attention-mechanism|attention]]")
  })

  it("promote is idempotent: running twice does not re-stamp published_at", async () => {
    const src = join(scratch, "doc.md")
    writeFileSync(src, "x")
    setMockLLM({
      title: "Doc",
      tags: ["t"],
      aliases: [],
      body: "Body.",
      suggested_links: [],
    })
    const r = await ingestOne(
      src,
      { autoLink: false, refresh: false, force: false, dryRun: false, estimate: false },
      { callOpenRouter, vocab: [], existingTags: [] },
    )
    const notePath = r.path!

    const firstOutcome = promoteOne(notePath, { dryRun: false, refresh: false }, "2026-01-01")
    expect(firstOutcome.outcome).toBe("promoted")
    const firstStamp = (() => {
      const fm = matter(readFileSync(notePath, "utf-8")).data
      return fm.published_at instanceof Date
        ? fm.published_at.toISOString().slice(0, 10)
        : String(fm.published_at)
    })()
    expect(firstStamp).toBe("2026-01-01")

    const secondOutcome = promoteOne(notePath, { dryRun: false, refresh: false }, "2026-12-31")
    expect(secondOutcome.outcome).toBe("already-published")

    const secondStamp = (() => {
      const fm = matter(readFileSync(notePath, "utf-8")).data
      return fm.published_at instanceof Date
        ? fm.published_at.toISOString().slice(0, 10)
        : String(fm.published_at)
    })()
    expect(secondStamp).toBe("2026-01-01")
  })
})
