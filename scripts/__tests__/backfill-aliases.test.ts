/**
 * backfill-aliases.test.ts
 *
 * Tests for scripts/backfill-aliases.ts using a stubbed LLM.
 *
 * TDD red-first: tests written before implementation.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import matter from "gray-matter"

// We import the functions from the backfill script directly for unit testing.
// Dynamic import is used so tests can run before the file exists (red phase),
// and we mock the LLM call.
async function importBackfill() {
  return await import("../backfill-aliases.ts")
}

describe("backfill-aliases: idempotency", () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "backfill-aliases-"))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it("skips notes with non-empty aliases already in frontmatter", async () => {
    writeFileSync(
      join(dir, "note-with-aliases.md"),
      "---\ntitle: PPO Paper\naliases:\n  - PPO\n---\nbody",
    )

    const { collectCandidates } = await importBackfill()
    const candidates = collectCandidates([dir])
    const slugs = candidates.map((c: any) => c.slug)
    // note already has non-empty aliases → not a candidate for backfill
    expect(slugs).not.toContain("note-with-aliases")
  })

  it("includes notes with missing aliases field", async () => {
    writeFileSync(
      join(dir, "no-aliases.md"),
      "---\ntitle: Self Attention\n---\nbody content here",
    )

    const { collectCandidates } = await importBackfill()
    const candidates = collectCandidates([dir])
    const slugs = candidates.map((c: any) => c.slug)
    expect(slugs).toContain("no-aliases")
  })

  it("includes notes with empty aliases array", async () => {
    writeFileSync(
      join(dir, "empty-aliases.md"),
      "---\ntitle: LoRA\naliases: []\n---\nbody",
    )

    const { collectCandidates } = await importBackfill()
    const candidates = collectCandidates([dir])
    const slugs = candidates.map((c: any) => c.slug)
    expect(slugs).toContain("empty-aliases")
  })
})

describe("backfill-aliases: applyAliases", () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "backfill-aliases-apply-"))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it("writes aliases into frontmatter without disturbing other fields", async () => {
    const filePath = join(dir, "09-ppo.md")
    writeFileSync(
      filePath,
      "---\ntitle: Proximal Policy Optimization\ntags:\n  - rl\n  - ppo\n---\nbody text here",
    )

    const { applyAliases } = await importBackfill()
    applyAliases(filePath, ["PPO", "ProxPol"])

    const updated = readFileSync(filePath, "utf-8")
    const { data: fm, content } = matter(updated)
    expect(fm.title).toBe("Proximal Policy Optimization")
    expect(fm.tags).toEqual(["rl", "ppo"])
    expect(fm.aliases).toEqual(["PPO", "ProxPol"])
    expect(content.trim()).toBe("body text here")
  })
})

describe("backfill-aliases: dry-run", () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "backfill-aliases-dry-"))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it("dry-run does not write any files", async () => {
    const filePath = join(dir, "dry-note.md")
    const originalContent = "---\ntitle: Dry Run Note\n---\nbody"
    writeFileSync(filePath, originalContent)

    const { applyAliasesIfNotDryRun } = await importBackfill()
    applyAliasesIfNotDryRun(filePath, ["DRY"], true /* dryRun */)

    const afterContent = readFileSync(filePath, "utf-8")
    expect(afterContent).toBe(originalContent)
  })

  it("non-dry-run writes the file", async () => {
    const filePath = join(dir, "write-note.md")
    writeFileSync(filePath, "---\ntitle: Write Note\n---\nbody")

    const { applyAliasesIfNotDryRun } = await importBackfill()
    applyAliasesIfNotDryRun(filePath, ["WN"], false /* dryRun */)

    const { data: fm } = matter(readFileSync(filePath, "utf-8"))
    expect(fm.aliases).toEqual(["WN"])
  })
})

describe("backfill-aliases: LLM integration stub", () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "backfill-aliases-llm-"))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it("validateAliasesResponse accepts valid JSON", async () => {
    const { validateAliasesResponse } = await importBackfill()
    const result = validateAliasesResponse('{"aliases":["PPO","ProxPol"]}')
    expect(result).toEqual(["PPO", "ProxPol"])
  })

  it("validateAliasesResponse returns null on invalid JSON", async () => {
    const { validateAliasesResponse } = await importBackfill()
    expect(validateAliasesResponse("not json")).toBeNull()
  })

  it("validateAliasesResponse returns null when aliases field is missing", async () => {
    const { validateAliasesResponse } = await importBackfill()
    expect(validateAliasesResponse('{"name":"foo"}')).toBeNull()
  })

  it("validateAliasesResponse returns null when aliases is not an array", async () => {
    const { validateAliasesResponse } = await importBackfill()
    expect(validateAliasesResponse('{"aliases":"PPO"}')).toBeNull()
  })

  it("validateAliasesResponse caps aliases at 5 entries", async () => {
    const { validateAliasesResponse } = await importBackfill()
    const result = validateAliasesResponse(
      '{"aliases":["A","B","C","D","E","F","G"]}',
    )
    expect(result).toHaveLength(5)
  })
})
