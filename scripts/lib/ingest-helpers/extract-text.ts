/**
 * extract-text.ts — format dispatcher for ingest-raw.
 *
 * Reads a file from disk and returns its textual content. Format detected
 * by extension (lowercased). Binary parsers run via their respective libs;
 * text formats are passthrough.
 *
 * URLs are NOT handled here — that path runs through the assistant via the
 * ingest-raw SKILL.md (jina-reader → /tmp file → this module). If a URL
 * reaches this function it throws with a clear pointer to the skill flow.
 */

import { readFileSync } from "node:fs"
import { extname } from "node:path"

type Format = "pdf" | "docx" | "pptx" | "md" | "txt"

export type ExtractedText = {
  text: string
  format: Format
  warnings: string[]
}

/** Length below which a PDF is presumed scanned/image-only — caller should skip LLM. */
export const SCANNED_PDF_THRESHOLD = 50

const SUPPORTED_EXTS = [".pdf", ".docx", ".pptx", ".md", ".txt"] as const
type Ext = (typeof SUPPORTED_EXTS)[number]

function detectFormat(filePath: string): { ext: Ext; format: Format } {
  if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
    throw new Error(
      "ingest-raw script accepts file paths only.\n" +
      "  URL ingest is assistant-mediated:\n" +
      "  1. Assistant fetches via mcp__jina-reader__*\n" +
      "  2. Writes markdown to /tmp/<hash>.md\n" +
      "  3. Re-invokes: bun run ingest-raw /tmp/<hash>.md --title \"<page title>\"\n" +
      "  See .claude/skills/ingest-raw/SKILL.md."
    )
  }
  const ext = extname(filePath).toLowerCase() as Ext
  if (!SUPPORTED_EXTS.includes(ext)) {
    throw new Error(
      `unsupported format: ${ext || "(no extension)"}. ` +
      `Supported: ${SUPPORTED_EXTS.join(", ")}`
    )
  }
  const format: Format = ext === ".md"
    ? "md"
    : ext === ".txt"
      ? "txt"
      : (ext.slice(1) as Format)
  return { ext, format }
}

export async function extractText(filePath: string): Promise<ExtractedText> {
  const { format } = detectFormat(filePath)
  const warnings: string[] = []

  if (format === "md" || format === "txt") {
    const text = readFileSync(filePath, "utf-8")
    return { text, format, warnings }
  }

  if (format === "pdf") {
    const { PDFParse } = await import("pdf-parse")
    const buffer = readFileSync(filePath)
    const parser = new PDFParse({ data: buffer })
    const result = await parser.getText()
    const text = result.text ?? ""
    if (text.trim().length < SCANNED_PDF_THRESHOLD) {
      warnings.push(
        `[scanned-pdf] text length < ${SCANNED_PDF_THRESHOLD}, file may be image-only — skip LLM`
      )
    }
    return { text, format, warnings }
  }

  // docx / pptx — both via officeparser (parseOffice returns a Promise<string>).
  const officeparser = await import("officeparser")
  const text = await officeparser.parseOffice(filePath, {
    outputErrorToConsole: false,
  })
  return { text: typeof text === "string" ? text : "", format, warnings }
}
