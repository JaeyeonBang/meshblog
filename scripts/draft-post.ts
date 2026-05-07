#!/usr/bin/env tsx
/**
 * scripts/draft-post.ts — synthesize a long-form post from N source notes.
 *
 * Usage:
 *   bun run scripts/draft-post.ts --title "<post title>" --notes <slug-1>,<slug-2>[,<slug-3>...]
 *
 * Flags:
 *   --force       Overwrite existing target file in content/posts/.
 *   --dry-run     Skip LLM call; print prompt size + planned write target.
 *
 * Output: content/posts/<slug>.md with draft:true frontmatter, sections that
 * cite each source via [[slug|surface]] wikilinks, and an auto-generated
 * `## Sources` block. The post template's `## Conclusion` heading is hardcoded.
 */

import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

import { existsSync, writeFileSync, renameSync, unlinkSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import matter from "gray-matter"
import {
  buildPostSynthPrompt,
  postSynthSchema,
  findUncitedSections,
  type PostSynth,
  type SourceNote,
} from "../src/lib/llm/prompts/post-synth.ts"
import { callClaudeMessages } from "../src/lib/llm/claude-code.ts"
import { extractJsonObject } from "../src/lib/rag/graph.ts"
import { slugify } from "./lib/slugify.ts"
import { createDb, queryMany } from "../src/lib/db/index.ts"

const POSTS_DIR = "content/posts"
const DB_PATH = process.env.MESHBLOG_DB ?? ".data/index.db"

// ── exported helpers ─────────────────────────────────────────────────────────

export type DraftPostOptions = {
  title: string
  noteSlugs: string[]
  force: boolean
  dryRun: boolean
}

/** Load N source notes from the index DB. Throws on missing slugs. */
export function loadSources(slugs: string[], dbPath: string = DB_PATH): SourceNote[] {
  if (!existsSync(dbPath)) {
    throw new Error(
      `index DB not found at ${dbPath}. Run \`bun run build-index --skip-embed\` first.`
    )
  }
  const db = createDb(dbPath)
  try {
    const placeholders = slugs.map(() => "?").join(",")
    const rows = queryMany<{ slug: string; title: string; body: string; tags: string }>(
      db,
      `SELECT id AS slug, title, content AS body, tags FROM notes WHERE id IN (${placeholders})`,
      slugs
    )
    const found = new Set(rows.map((r) => r.slug))
    const missing = slugs.filter((s) => !found.has(s))
    if (missing.length > 0) {
      throw new Error(`source slugs not found in DB: ${missing.join(", ")}`)
    }
    // Preserve --notes order (DB IN clause doesn't guarantee order).
    const bySlug = new Map(rows.map((r) => [r.slug, r]))
    return slugs.map((slug) => {
      const row = bySlug.get(slug)!
      let tags: string[] = []
      try { tags = JSON.parse(row.tags) as string[] } catch { /* tags malformed → empty */ }
      return { slug: row.slug, title: row.title, body: row.body, tags }
    })
  } finally {
    db.close()
  }
}

/** Compute union of source tags, deduped, capped at maxLen. */
export function unionTags(sources: SourceNote[], maxLen = 5): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const s of sources) {
    for (const t of s.tags) {
      if (!seen.has(t)) {
        seen.add(t)
        result.push(t)
        if (result.length >= maxLen) return result
      }
    }
  }
  return result
}

/** Compose the final post markdown. The Sources block is generated here, NOT by the LLM. */
export function composePost(
  title: string,
  synth: PostSynth,
  sources: SourceNote[],
  tags: string[]
): string {
  const today = new Date().toISOString().slice(0, 10)
  const frontmatter = {
    title,
    draft: true,
    date: today,
    tags,
  }

  const sectionBlocks = synth.sections
    .map((s) => `## ${s.heading}\n\n${s.body}`)
    .join("\n\n")

  const sourcesBlock = sources
    .map((s) => `- [[${s.slug}|${s.title}]]`)
    .join("\n")

  const body =
    `${synth.lede}\n\n` +
    `${sectionBlocks}\n\n` +
    `## Conclusion\n\n${synth.conclusion}\n\n` +
    `## Sources\n\n${sourcesBlock}\n`

  return matter.stringify(body, frontmatter)
}

/** Atomic write helper (matches ingest-raw pattern). */
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

export type SynthDeps = {
  callClaudeMessages: typeof callClaudeMessages
}

/** Call LLM, validate via Zod + citation check, retry once on failure. */
export async function synthesizePost(
  title: string,
  sources: SourceNote[],
  deps: SynthDeps = { callClaudeMessages }
): Promise<PostSynth> {
  const sourceSlugs = sources.map((s) => s.slug)

  async function attempt(extraInstruction?: string): Promise<PostSynth> {
    const messages = buildPostSynthPrompt(title, sources)
    if (extraInstruction) {
      messages.push({ role: "user", content: extraInstruction })
    }
    const data = await deps.callClaudeMessages(messages)
    const parsed =
      typeof data === "string"
        ? JSON.parse(extractJsonObject(data))
        : data
    const validated = postSynthSchema.parse(parsed)

    const uncited = findUncitedSections(validated, sourceSlugs)
    if (uncited.length > 0) {
      throw new Error(
        `uncited sections: ${uncited.map((u) => `[${u.index}] "${u.heading}"`).join(", ")}`
      )
    }
    return validated
  }

  try {
    return await attempt()
  } catch (err) {
    const msg = (err as Error).message
    console.warn(`[draft-post] first attempt failed: ${msg}. Retrying once...`)
    const retryHint =
      `Previous response failed validation: ${msg}\n` +
      `Reminder: every section body MUST cite at least one source via [[slug|surface]]. ` +
      `Available slugs: ${sourceSlugs.join(", ")}.`
    return await attempt(retryHint)
  }
}

// ── CLI entry ─────────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): DraftPostOptions {
  const args = argv.slice(2)

  const titleIdx = args.indexOf("--title")
  if (titleIdx < 0) throw new Error("--title is required")
  const title = args[titleIdx + 1]
  if (!title) throw new Error("--title value is required")

  const notesIdx = args.indexOf("--notes")
  if (notesIdx < 0) throw new Error("--notes is required (comma-separated slugs)")
  const notesArg = args[notesIdx + 1]
  if (!notesArg) throw new Error("--notes value is required")
  const noteSlugs = notesArg.split(",").map((s) => s.trim()).filter(Boolean)
  if (noteSlugs.length === 0) throw new Error("--notes must contain at least one slug")

  return {
    title,
    noteSlugs,
    force: args.includes("--force"),
    dryRun: args.includes("--dry-run"),
  }
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("draft-post.ts")

if (isMainModule) {
  ;(async () => {
    let options: DraftPostOptions
    try {
      options = parseArgs(process.argv)
    } catch (err) {
      console.error(`[draft-post] ${(err as Error).message}`)
      console.error("usage: bun run scripts/draft-post.ts --title \"...\" --notes slug-1,slug-2 [--force] [--dry-run]")
      process.exit(1)
      return
    }

    if (!options.dryRun) {
      try {
        const { checkClaudeAvailable } = await import("../src/lib/llm/claude-code.ts")
        checkClaudeAvailable()
      } catch (err) {
        console.error(`[draft-post] ${(err as Error).message}`)
        process.exit(1)
        return
      }
    }

    const slug = slugify(options.title)
    const targetPath = join(POSTS_DIR, `${slug}.md`)

    if (existsSync(targetPath) && !options.force) {
      console.error(`[draft-post] target exists: ${targetPath} (use --force to overwrite)`)
      process.exit(1)
      return
    }

    let sources: SourceNote[]
    try {
      sources = loadSources(options.noteSlugs)
    } catch (err) {
      console.error(`[draft-post] ${(err as Error).message}`)
      process.exit(1)
      return
    }

    console.log(`[draft-post] loaded ${sources.length} source notes`)
    for (const s of sources) console.log(`  - ${s.slug}: "${s.title}" (${s.body.length} chars)`)

    if (options.dryRun) {
      const totalChars = sources.reduce((sum, s) => sum + s.body.length, 0)
      console.log(`[draft-post] [dry-run] total source chars: ${totalChars}`)
      console.log(`[draft-post] [dry-run] would write: ${targetPath}`)
      process.exit(0)
      return
    }

    let synth: PostSynth
    try {
      synth = await synthesizePost(options.title, sources)
    } catch (err) {
      console.error(`[draft-post] synthesis failed after retry: ${(err as Error).message}`)
      process.exit(1)
      return
    }

    const tags = unionTags(sources)
    const content = composePost(options.title, synth, sources, tags)
    atomicWrite(targetPath, content)

    const totalWords = content.split(/\s+/).length
    console.log(`[draft-post] wrote ${targetPath}`)
    console.log(`  sections: ${synth.sections.length}`)
    console.log(`  total words: ${totalWords}`)
    console.log(`  cited sources: ${sources.map((s) => s.slug).join(", ")}`)
    process.exit(0)
  })().catch((err) => {
    console.error("[draft-post] fatal:", err)
    process.exit(1)
  })
}
