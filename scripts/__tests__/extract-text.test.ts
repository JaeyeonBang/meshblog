import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { mkdtempSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

// We mock pdf-parse and officeparser at module level so the tests don't need
// real PDFs/Office files on disk. The MD/TXT path uses fs directly.
vi.mock("pdf-parse", () => ({
  default: vi.fn(),
}))
vi.mock("officeparser", () => ({
  parseOfficeAsync: vi.fn(),
}))

import pdfParse from "pdf-parse"
import * as officeparser from "officeparser"
import { extractText, SCANNED_PDF_THRESHOLD } from "../lib/ingest-helpers/extract-text.ts"

const mockedPdfParse = vi.mocked(pdfParse)
const mockedOffice = vi.mocked(officeparser)

describe("extractText", () => {
  let scratch: string

  beforeEach(() => {
    scratch = mkdtempSync(join(tmpdir(), "extract-text-"))
    vi.clearAllMocks()
  })

  afterEach(() => {
    rmSync(scratch, { recursive: true, force: true })
  })

  it("returns markdown content as-is for .md", async () => {
    const p = join(scratch, "note.md")
    writeFileSync(p, "# Hello\n\nbody")
    const r = await extractText(p)
    expect(r.format).toBe("md")
    expect(r.text).toContain("# Hello")
    expect(r.warnings).toEqual([])
  })

  it("returns plain content for .txt", async () => {
    const p = join(scratch, "plain.txt")
    writeFileSync(p, "just text")
    const r = await extractText(p)
    expect(r.format).toBe("txt")
    expect(r.text).toBe("just text")
  })

  it("calls pdf-parse for .pdf and returns extracted text", async () => {
    const p = join(scratch, "doc.pdf")
    writeFileSync(p, Buffer.from("not-a-real-pdf"))
    mockedPdfParse.mockResolvedValueOnce({ text: "long enough extracted text from a real PDF document" } as any)
    const r = await extractText(p)
    expect(r.format).toBe("pdf")
    expect(r.text).toContain("extracted text")
    expect(mockedPdfParse).toHaveBeenCalledTimes(1)
  })

  it("emits scanned-pdf warning when extracted PDF text < threshold", async () => {
    const p = join(scratch, "scanned.pdf")
    writeFileSync(p, Buffer.from("not-a-real-pdf"))
    mockedPdfParse.mockResolvedValueOnce({ text: "tiny" } as any)
    const r = await extractText(p)
    expect(r.warnings.some((w) => w.includes("[scanned-pdf]"))).toBe(true)
    expect(SCANNED_PDF_THRESHOLD).toBeGreaterThan("tiny".length)
  })

  it("calls officeparser for .docx", async () => {
    const p = join(scratch, "doc.docx")
    writeFileSync(p, Buffer.from("fake-docx"))
    mockedOffice.parseOfficeAsync.mockResolvedValueOnce("docx body")
    const r = await extractText(p)
    expect(r.format).toBe("docx")
    expect(r.text).toBe("docx body")
  })

  it("calls officeparser for .pptx", async () => {
    const p = join(scratch, "deck.pptx")
    writeFileSync(p, Buffer.from("fake-pptx"))
    mockedOffice.parseOfficeAsync.mockResolvedValueOnce("slide content")
    const r = await extractText(p)
    expect(r.format).toBe("pptx")
    expect(r.text).toBe("slide content")
  })

  it("throws on unsupported extension", async () => {
    const p = join(scratch, "weird.xyz")
    writeFileSync(p, "stuff")
    await expect(extractText(p)).rejects.toThrow(/unsupported format/i)
  })

  it("throws when given a URL with a clear pointer to the SKILL.md flow", async () => {
    await expect(extractText("https://arxiv.org/abs/2401.01234")).rejects.toThrow(
      /SKILL\.md/
    )
  })

  it("treats unknown extensions case-insensitively", async () => {
    const p = join(scratch, "DOC.MD")
    writeFileSync(p, "content")
    const r = await extractText(p)
    expect(r.format).toBe("md")
  })
})
