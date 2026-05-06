/**
 * prompts.test.ts — CLI dispatcher subcommand handlers (list / show / validate).
 *
 * Tests bypass the CLI entrypoint and call the exported command functions
 * directly with cwd switched to a scratch dir.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  commandList,
  commandShow,
  commandValidate,
} from "../prompts.ts"

describe("commandList", () => {
  let cwdBefore: string
  let scratch: string
  beforeEach(() => {
    cwdBefore = process.cwd()
    scratch = mkdtempSync(join(tmpdir(), "prompts-list-"))
    process.chdir(scratch)
  })
  afterEach(() => {
    process.chdir(cwdBefore)
    rmSync(scratch, { recursive: true, force: true })
  })

  it("returns three rows (one per known use)", () => {
    const rows = commandList()
    const uses = rows.map((r) => r.use).sort()
    expect(uses).toEqual(["concept-naming", "ingest-enrich", "post-synth"])
  })

  it("marks all rows as default when no overrides exist", () => {
    const rows = commandList()
    expect(rows.every((r) => r.source === "default")).toBe(true)
    expect(rows.every((r) => r.path === null)).toBe(true)
  })

  it("flags an override after creating one", () => {
    mkdirSync("prompts", { recursive: true })
    writeFileSync("prompts/post-synth.md", "real override body")
    const rows = commandList()
    const post = rows.find((r) => r.use === "post-synth")!
    const concept = rows.find((r) => r.use === "concept-naming")!
    expect(post.source).toBe("override")
    expect(concept.source).toBe("default")
  })
})

describe("commandShow", () => {
  let cwdBefore: string
  let scratch: string
  beforeEach(() => {
    cwdBefore = process.cwd()
    scratch = mkdtempSync(join(tmpdir(), "prompts-show-"))
    process.chdir(scratch)
  })
  afterEach(() => {
    process.chdir(cwdBefore)
    rmSync(scratch, { recursive: true, force: true })
  })

  it("returns TS default body when no override exists", () => {
    const r = commandShow("post-synth")
    expect(r.resolution).toBe("default")
    expect(r.path).toBeNull()
    expect(r.style.length).toBeGreaterThan(50)
  })

  it("returns override body when present", () => {
    mkdirSync("prompts", { recursive: true })
    writeFileSync("prompts/ingest-enrich.md", "Custom voice instructions.")
    const r = commandShow("ingest-enrich")
    expect(r.resolution).toBe("override")
    expect(r.style).toContain("Custom voice instructions")
  })

  it("throws on unknown use", () => {
    // commandShow is typed but tests invoke with a runtime-cast string.
    expect(() => commandShow("nonexistent" as never)).toThrow(/unknown use/)
  })
})

describe("commandValidate", () => {
  let cwdBefore: string
  let scratch: string
  beforeEach(() => {
    cwdBefore = process.cwd()
    scratch = mkdtempSync(join(tmpdir(), "prompts-validate-"))
    process.chdir(scratch)
  })
  afterEach(() => {
    process.chdir(cwdBefore)
    rmSync(scratch, { recursive: true, force: true })
  })

  it("returns ok when no overrides exist", () => {
    expect(commandValidate()).toEqual({ ok: true, errors: [] })
  })

  it("flags empty override files", () => {
    mkdirSync("prompts", { recursive: true })
    writeFileSync("prompts/post-synth.md", "")
    const r = commandValidate()
    expect(r.ok).toBe(false)
    expect(r.errors).toHaveLength(1)
    expect(r.errors[0].use).toBe("post-synth")
  })

  it("returns ok when overrides have real content", () => {
    mkdirSync("prompts", { recursive: true })
    writeFileSync("prompts/post-synth.md", "real body")
    writeFileSync("prompts/ingest-enrich.md", "another real body")
    expect(commandValidate()).toEqual({ ok: true, errors: [] })
  })
})
