#!/usr/bin/env tsx
/**
 * scripts/ingest-raw.ts — convert PDF/DOCX/PPTX/MD/TXT into draft notes.
 *
 * graphify-style UX: drop a file (or directory of files), ingest them into
 * `content/notes/<slug>.md` with LLM-suggested wikilinks pre-applied, then
 * trigger `bun run refresh` so the graph view updates with the new nodes.
 *
 * Usage:
 *   bun run scripts/ingest-raw.ts <path-or-dir> [flags]
 *
 *   --title "..."     Override the LLM-suggested title (single-file only).
 *   --no-auto-link    Skip wikilink auto-insertion.
 *   --no-refresh      Skip post-ingest `bun run refresh`.
 *   --force           Overwrite existing target file.
 *   --dry-run         Extract + LLM enrich, write nothing.
 *   --estimate        Print token estimate, no LLM call, exit 0.
 *
 * URLs are NOT accepted — see .claude/skills/ingest-raw/SKILL.md for the
 * assistant-mediated URL flow (jina-reader → /tmp file → script).
 */

import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

import { existsSync, readdirSync, statSync, writeFileSync, renameSync, mkdirSync, unlinkSync } from "node:fs"
import { join, basename, extname, dirname } from "node:path"
import { spawn } from "node:child_process"
import matter from "gray-matter"
import { extractText } from "./lib/ingest-helpers/extract-text.ts"
import { archiveRaw } from "./lib/ingest-helpers/archive.ts"
import { autoLink } from "./lib/ingest-helpers/auto-link.ts"
import {
  buildIngestEnrichPrompt,
  ingestEnrichSchema,
  type IngestEnrich,
} from "../src/lib/llm/prompts/ingest-enrich.ts"
import { callClaudeMessages } from "../src/lib/llm/claude-code.ts"
import { extractJsonObject } from "../src/lib/rag/graph.ts"
import { slugify } from "./lib/slugify.ts"
import { createDb, queryMany } from "../src/lib/db/index.ts"

const SUPPORTED_EXTS = [".pdf", ".docx", ".pptx", ".md", ".txt"]
const NOTES_DIR = "content/notes"
const DB_PATH = process.env.MESHBLOG_DB ?? ".data/index.db"

// ── exported helpers ─────────────────────────────────────────────────────────

export type IngestOptions = {
  titleOverride?: string
  autoLink: boolean
  refresh: boolean
  force: boolean
  dryRun: boolean
  estimate: boolean
}

export type EntityVocab = {
  name: string
  slug: string
  title: string
}

export type IngestRunResult = {
  written: string[]
  skipped: { path: string; reason: string }[]
  estimates?: { path: string; chars: number; estTokens: number }[]
}

/** Return all entity → note mappings for the LLM vocab (top by mention_count). */
export function loadEntityVocab(dbPath: string = DB_PATH, limit = 200): EntityVocab[] {
  if (!existsSync(dbPath)) return []
  const db = createDb(dbPath)
  try {
    return queryMany<EntityVocab>(
      db,
      `SELECT e.name AS name, n.id AS slug, n.title AS title
       FROM entities e
       JOIN note_entities ne ON ne.entity_id = e.id
       JOIN notes n ON n.id = ne.note_id
       WHERE n.folder_path IN ('content/notes', 'content/posts')
       GROUP BY e.name, n.id
       ORDER BY MAX(e.mention_count) DESC
       LIMIT ?`,
      [limit]
    )
  } finally {
    db.close()
  }
}

/** Walk a path: if file → [path]; if dir → top-level supported files only. */
export function collectInputs(pathArg: string): string[] {
  if (!existsSync(pathArg)) {
    throw new Error(`path not found: ${pathArg}`)
  }
  const stat = statSync(pathArg)
  if (stat.isFile()) {
    const ext = extname(pathArg).toLowerCase()
    if (!SUPPORTED_EXTS.includes(ext)) {
      throw new Error(`unsupported extension: ${ext} (file: ${pathArg})`)
    }
    return [pathArg]
  }
  if (!stat.isDirectory()) {
    throw new Error(`not a file or directory: ${pathArg}`)
  }
  return readdirSync(pathArg)
    .map((f) => join(pathArg, f))
    .filter((p) => {
      try {
        return statSync(p).isFile() && SUPPORTED_EXTS.includes(extname(p).toLowerCase())
      } catch {
        return false
      }
    })
    .sort()
}

/** Compose the final markdown for a draft note. */
export function composeNote(
  title: string,
  body: string,
  tags: string[],
  aliases: string[]
): string {
  return matter.stringify(body, {
    title,
    draft: true,
    tags,
    aliases,
  })
}

/** Atomic write: write to a `.tmp` then rename. */
export function atomicWrite(targetPath: string, content: string): void {
  mkdirSync(dirname(targetPath), { recursive: true })
  const tmp = `${targetPath}.tmp`
  writeFileSync(tmp, content, "utf-8")
  try {
    renameSync(tmp, targetPath)
  } catch (err) {
    try { unlinkSync(tmp) } catch { /* ignore */ }
    throw err
  }
}

export type EnrichDeps = {
  callClaudeMessages: typeof callClaudeMessages
}

/** Call the LLM enrich step, validate via Zod, return structured result. */
export async function llmEnrich(
  rawText: string,
  vocab: EntityVocab[],
  existingTags: string[],
  deps: EnrichDeps = { callClaudeMessages }
): Promise<IngestEnrich> {
  const messages = buildIngestEnrichPrompt(rawText, existingTags, vocab)
  const data = await deps.callClaudeMessages(messages)
  const parsed =
    typeof data === "string"
      ? JSON.parse(extractJsonObject(data))
      : data
  return ingestEnrichSchema.parse(parsed)
}

/** Filter LLM-proposed links to only those whose target_slug is in the vocab. */
export function filterValidLinks(
  proposed: { surface: string; target_slug: string }[],
  vocab: EntityVocab[]
): { surface: string; target_slug: string }[] {
  const validSlugs = new Set(vocab.map((v) => v.slug))
  return proposed.filter((p) => validSlugs.has(p.target_slug))
}

/** Process a single file end-to-end. Returns the written path or throws. */
export async function ingestOne(
  filePath: string,
  options: IngestOptions,
  deps: { callClaudeMessages: typeof callClaudeMessages; vocab?: EntityVocab[]; existingTags?: string[] } = { callClaudeMessages }
): Promise<{ status: "written" | "skipped" | "estimated"; path?: string; reason?: string; estimate?: { chars: number; estTokens: number } }> {
  const { text, format, warnings } = await extractText(filePath)
  for (const w of warnings) console.warn(`[ingest-raw] ${filePath}: ${w}`)

  if (warnings.some((w) => w.startsWith("[scanned-pdf]"))) {
    return { status: "skipped", reason: "scanned-pdf, no LLM call" }
  }

  if (options.estimate) {
    const chars = text.length
    const estTokens = Math.ceil(chars / 4)
    return { status: "estimated", estimate: { chars, estTokens } }
  }

  const vocab = deps.vocab ?? loadEntityVocab()
  const existingTags = deps.existingTags ?? Array.from(new Set(vocab.flatMap(() => []))) // tags vocab may be empty; the LLM still gets the entity list

  const enriched = await llmEnrich(text, vocab, existingTags, { callClaudeMessages: deps.callClaudeMessages })

  const titleFinal = options.titleOverride ?? enriched.title
  const slug = slugify(titleFinal)
  const targetPath = join(NOTES_DIR, `${slug}.md`)

  if (existsSync(targetPath) && !options.force) {
    return {
      status: "skipped",
      reason:
        `slug collision: target exists at ${targetPath}. ` +
        `In directory mode this happens when the LLM picks the same title for multiple files. ` +
        `Re-run on this file alone with --title "Some Distinct Title", or pass --force to overwrite.`,
    }
  }

  let body = enriched.body
  if (options.autoLink && enriched.suggested_links.length > 0) {
    const valid = filterValidLinks(enriched.suggested_links, vocab)
    const result = autoLink(body, valid)
    body = result.body
    console.log(`[ingest-raw] auto-linked ${result.applied.length}/${valid.length} suggestions in ${slug}`)
  }

  if (options.dryRun) {
    console.log(`[ingest-raw] [dry-run] would write ${targetPath} (${body.length} chars body)`)
    return { status: "written", path: targetPath }
  }

  // Archive raw FIRST (cheap, no LLM cost). On failure we still bail before
  // writing the note, preserving atomicity. If archive exists and --force,
  // overwrite by removing then archiving.
  try {
    archiveRaw(filePath, slug)
  } catch (err) {
    if (options.force) {
      // Remove existing archive and retry once.
      const ext = extname(filePath).toLowerCase()
      const archivePath = join(".cache/sources", `${slug}${ext}`)
      try { unlinkSync(archivePath) } catch { /* ignore */ }
      archiveRaw(filePath, slug)
    } else {
      throw err
    }
  }

  const finalContent = composeNote(titleFinal, body, enriched.tags, enriched.aliases)
  atomicWrite(targetPath, finalContent)
  console.log(`[ingest-raw] wrote ${targetPath} (format: ${format})`)
  return { status: "written", path: targetPath }
}

export function spawnRefresh(): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("bun", ["run", "refresh"], { stdio: "inherit" })
    child.on("close", (code) => {
      if (code === 0) resolve()
      else reject(new Error(`bun run refresh exited with code ${code}`))
    })
    child.on("error", reject)
  })
}

// ── CLI entry ─────────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): { pathArg: string; options: IngestOptions } {
  const args = argv.slice(2)
  const positional = args.filter((a) => !a.startsWith("--"))
  if (positional.length === 0) {
    throw new Error("usage: bun run scripts/ingest-raw.ts <path-or-dir> [flags]")
  }
  const pathArg = positional[0]

  const titleIdx = args.indexOf("--title")
  const titleOverride = titleIdx >= 0 ? args[titleIdx + 1] : undefined

  const options: IngestOptions = {
    titleOverride,
    autoLink: !args.includes("--no-auto-link"),
    refresh: !args.includes("--no-refresh"),
    force: args.includes("--force"),
    dryRun: args.includes("--dry-run"),
    estimate: args.includes("--estimate"),
  }

  return { pathArg, options }
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("ingest-raw.ts")

if (isMainModule) {
  ;(async () => {
    const { pathArg, options } = parseArgs(process.argv)
    const inputs = collectInputs(pathArg)

    if (inputs.length === 0) {
      console.error(`[ingest-raw] no supported files found in ${pathArg}`)
      console.error(`[ingest-raw] supported: ${SUPPORTED_EXTS.join(", ")}`)
      process.exit(1)
    }

    if (inputs.length > 1 && options.titleOverride) {
      console.error("[ingest-raw] --title cannot be used with directory mode (>1 file)")
      process.exit(1)
    }

    if (!options.estimate && !options.dryRun) {
      try {
        // Lazy-import to avoid loading the spawn machinery in --dry-run / --estimate.
        const { checkClaudeAvailable } = await import("../src/lib/llm/claude-code.ts")
        checkClaudeAvailable()
      } catch (err) {
        console.error(`[ingest-raw] ${(err as Error).message}`)
        process.exit(1)
      }
    }

    const result: IngestRunResult = { written: [], skipped: [], estimates: [] }
    let vocab: EntityVocab[] | undefined

    for (const filePath of inputs) {
      console.log(`[ingest-raw] processing ${filePath}...`)
      try {
        if (vocab === undefined && !options.estimate && !options.dryRun) {
          vocab = loadEntityVocab()
          console.log(`[ingest-raw] entity vocab: ${vocab.length} entries`)
        }
        const r = await ingestOne(filePath, options, { callClaudeMessages, vocab })
        if (r.status === "written" && r.path) result.written.push(r.path)
        else if (r.status === "skipped") result.skipped.push({ path: filePath, reason: r.reason ?? "" })
        else if (r.status === "estimated" && r.estimate) {
          result.estimates!.push({ path: filePath, ...r.estimate })
          console.log(
            `[ingest-raw] [estimate] ${filePath}: ${r.estimate.chars} chars / ~${r.estimate.estTokens} tokens`
          )
        }
      } catch (err) {
        console.error(`[ingest-raw] FAIL on ${filePath}:`, (err as Error).message)
        result.skipped.push({ path: filePath, reason: (err as Error).message })
      }
    }

    const collisions = result.skipped.filter((s) => s.reason.startsWith("slug collision:"))
    const otherSkips = result.skipped.filter((s) => !s.reason.startsWith("slug collision:"))

    console.log("\n[ingest-raw] summary:")
    console.log(`  written: ${result.written.length}`)
    console.log(`  skipped: ${result.skipped.length}${collisions.length > 0 ? ` (${collisions.length} slug collisions)` : ""}`)
    if (options.estimate) {
      const totalTokens = result.estimates!.reduce((s, e) => s + e.estTokens, 0)
      console.log(`  estimated total tokens: ~${totalTokens.toLocaleString()}`)
    }
    for (const s of otherSkips) console.log(`    SKIP ${s.path}: ${s.reason}`)
    if (collisions.length > 0) {
      console.log(`\n[ingest-raw] ${collisions.length} file(s) skipped due to slug collisions:`)
      for (const s of collisions) console.log(`    COLLISION ${s.path}`)
      console.log(`  → re-run each with --title "Distinct Title" to ingest, or accept the loss.`)
    }

    if (result.written.length > 0 && options.refresh && !options.dryRun) {
      console.log("\n[ingest-raw] running bun run refresh...")
      try {
        await spawnRefresh()
      } catch (err) {
        console.error("[ingest-raw] refresh failed:", (err as Error).message)
        process.exit(1)
      }
    }

    process.exit(0)
  })().catch((err) => {
    console.error("[ingest-raw] fatal:", err)
    process.exit(1)
  })
}
