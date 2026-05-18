/**
 * loader.test.ts — STYLE/CONTRACT split + override resolution.
 *
 * Tests run with cwd switched to a scratch dir so we can stage realistic
 * `prompts/<use>.md` files without polluting the real repo.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  loadStyleBlock,
  listPromptStatus,
  validateOverrides,
  ALL_USES,
} from "../loader.ts"

const TS_DEFAULT = "default style block from TS"
const ALL_DEFAULTS = {
  "post-synth": TS_DEFAULT,
  "ingest-enrich": TS_DEFAULT,
  "concept-naming": TS_DEFAULT,
  "suggest-links": TS_DEFAULT,
} as const

describe("loadStyleBlock", () => {
  let cwdBefore: string
  let scratch: string

  beforeEach(() => {
    cwdBefore = process.cwd()
    scratch = mkdtempSync(join(tmpdir(), "loader-"))
    process.chdir(scratch)
  })
  afterEach(() => {
    process.chdir(cwdBefore)
    rmSync(scratch, { recursive: true, force: true })
  })

  it("returns TS default when no override file exists", () => {
    const r = loadStyleBlock("post-synth", TS_DEFAULT)
    expect(r.source).toBe("default")
    expect(r.path).toBeNull()
    expect(r.body).toBe(TS_DEFAULT)
  })

  it("returns override body when file present and non-empty", () => {
    mkdirSync("prompts", { recursive: true })
    writeFileSync(
      "prompts/post-synth.md",
      "Custom style: be terse.\n\nNo banned phrases.",
    )
    const r = loadStyleBlock("post-synth", TS_DEFAULT)
    expect(r.source).toBe("override")
    expect(r.path).toBe("prompts/post-synth.md")
    expect(r.body).toContain("Custom style")
    expect(r.body).toContain("No banned phrases")
  })

  it("strips optional frontmatter when present", () => {
    mkdirSync("prompts", { recursive: true })
    writeFileSync(
      "prompts/ingest-enrich.md",
      "---\ndescription: academic\n---\nbody-only-please",
    )
    const r = loadStyleBlock("ingest-enrich", TS_DEFAULT)
    expect(r.source).toBe("override")
    expect(r.body).toBe("body-only-please")
    expect(r.body).not.toContain("description")
  })

  it("falls back to TS default when override file is empty (whitespace only)", () => {
    mkdirSync("prompts", { recursive: true })
    writeFileSync("prompts/concept-naming.md", "   \n\n  \n")
    const r = loadStyleBlock("concept-naming", TS_DEFAULT)
    expect(r.source).toBe("default")
    expect(r.body).toBe(TS_DEFAULT)
  })
})

describe("listPromptStatus", () => {
  let cwdBefore: string
  let scratch: string

  beforeEach(() => {
    cwdBefore = process.cwd()
    scratch = mkdtempSync(join(tmpdir(), "loader-list-"))
    process.chdir(scratch)
  })
  afterEach(() => {
    process.chdir(cwdBefore)
    rmSync(scratch, { recursive: true, force: true })
  })

  it("enumerates all known uses", () => {
    const rows = listPromptStatus(ALL_DEFAULTS)
    expect(rows.map((r) => r.use).sort()).toEqual([...ALL_USES].sort())
  })

  it("flags overrides correctly", () => {
    mkdirSync("prompts", { recursive: true })
    writeFileSync("prompts/post-synth.md", "Override me.")
    const rows = listPromptStatus(ALL_DEFAULTS)
    const post = rows.find((r) => r.use === "post-synth")!
    const ingest = rows.find((r) => r.use === "ingest-enrich")!
    expect(post.source).toBe("override")
    expect(post.path).toBe("prompts/post-synth.md")
    expect(ingest.source).toBe("default")
    expect(ingest.path).toBeNull()
  })
})

describe("validateOverrides", () => {
  let cwdBefore: string
  let scratch: string

  beforeEach(() => {
    cwdBefore = process.cwd()
    scratch = mkdtempSync(join(tmpdir(), "loader-validate-"))
    process.chdir(scratch)
  })
  afterEach(() => {
    process.chdir(cwdBefore)
    rmSync(scratch, { recursive: true, force: true })
  })

  it("returns no errors when no overrides exist", () => {
    expect(validateOverrides()).toEqual([])
  })

  it("flags empty override files", () => {
    mkdirSync("prompts", { recursive: true })
    writeFileSync("prompts/post-synth.md", "   ")
    const errors = validateOverrides()
    expect(errors).toHaveLength(1)
    expect(errors[0].use).toBe("post-synth")
    expect(errors[0].error).toMatch(/empty/)
  })

  it("returns no errors when overrides have content", () => {
    mkdirSync("prompts", { recursive: true })
    writeFileSync("prompts/post-synth.md", "real body")
    expect(validateOverrides()).toEqual([])
  })
})
