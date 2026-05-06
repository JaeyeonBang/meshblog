import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { archiveRaw, archivePath } from "../lib/ingest-helpers/archive.ts"

describe("archiveRaw", () => {
  let cwdBefore: string
  let scratch: string

  beforeEach(() => {
    cwdBefore = process.cwd()
    scratch = mkdtempSync(join(tmpdir(), "archive-test-"))
    process.chdir(scratch)
  })

  afterEach(() => {
    process.chdir(cwdBefore)
    rmSync(scratch, { recursive: true, force: true })
  })

  it("copies file to .cache/sources/<slug><ext> and returns absolute path", () => {
    const src = join(scratch, "input.pdf")
    writeFileSync(src, "PDF body")

    const out = archiveRaw(src, "my-slug")

    const expected = join(scratch, ".cache", "sources", "my-slug.pdf")
    expect(existsSync(expected)).toBe(true)
    expect(out).toBe(expected)
    expect(readFileSync(expected, "utf-8")).toBe("PDF body")
  })

  it("creates .cache/sources/ dir if missing", () => {
    const src = join(scratch, "x.md")
    writeFileSync(src, "content")
    archiveRaw(src, "slug-a")
    expect(statSync(join(scratch, ".cache", "sources")).isDirectory()).toBe(true)
  })

  it("throws when archive target already exists", () => {
    const src = join(scratch, "x.md")
    writeFileSync(src, "content")
    archiveRaw(src, "dup-slug")
    expect(() => archiveRaw(src, "dup-slug")).toThrow(/already exists/)
  })

  it("preserves binary content (PNG bytes)", () => {
    const src = join(scratch, "input.png")
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff, 0x7f, 0x80])
    writeFileSync(src, bytes)
    const out = archiveRaw(src, "img-slug")
    const copied = readFileSync(out)
    expect(copied.equals(bytes)).toBe(true)
  })

  it("lowercases the extension in the target name", () => {
    const src = join(scratch, "input.PDF")
    writeFileSync(src, "content")
    const out = archiveRaw(src, "case-slug")
    expect(out.endsWith(".pdf")).toBe(true)
  })
})

describe("archivePath", () => {
  it("returns the relative target path", () => {
    expect(archivePath("foo", "/x/bar.PDF")).toBe(".cache/sources/foo.pdf")
  })
})
