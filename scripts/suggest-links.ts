#!/usr/bin/env tsx
/**
 * scripts/suggest-links.ts — propose wikilink / related-frontmatter additions for a draft post.
 *
 * Usage:
 *   bun run scripts/suggest-links.ts <path-to-md>
 *
 * Flags:
 *   --json        Machine-readable JSON output (array of suggestion objects).
 *   --limit=N     Cap suggestions at N (default 8). Passed as a hint to the LLM.
 *
 * Output: pretty-printed suggestions to stdout. Never modifies the input file.
 * Exit codes: 0 = success (including empty suggestion list), non-zero = hard error.
 */

import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

import { readFileSync, existsSync } from "node:fs"
import matter from "gray-matter"
import { z } from "zod"
import {
  buildSuggestLinksPrompt,
  suggestionsArraySchema,
  type Suggestion,
  type CandidatePost,
  type TargetPost,
} from "../src/lib/llm/prompts/suggest-links.ts"
import { callClaudeMessages } from "../src/lib/llm/claude-code.ts"
import { extractJsonObject } from "../src/lib/rag/graph.ts"
import { createDb, queryMany } from "../src/lib/db/index.ts"

const DB_PATH = process.env.MESHBLOG_DB ?? ".data/index.db"
const DEFAULT_LIMIT = 8
const EXCERPT_CHARS = 500

// ── Exported helpers ──────────────────────────────────────────────────────────

export type SuggestLinksOptions = {
  filePath: string
  json: boolean
  limit: number
}

export type ParsedTarget = {
  slug: string
  title: string
  tags: string[]
  body: string
}

/** Parse a markdown file into its slug (derived from filename), frontmatter fields, and body. */
export function parseTargetFile(filePath: string): ParsedTarget {
  if (!existsSync(filePath)) {
    throw new Error(`target file not found: ${filePath}`)
  }
  const raw = readFileSync(filePath, "utf-8")
  const { data, content } = matter(raw)

  // Derive slug from filename (strip directory + extension)
  const basename = filePath.replace(/\\/g, "/").split("/").pop() ?? filePath
  const slug = basename.replace(/\.md$/, "")

  const title =
    typeof data.title === "string" && data.title.trim().length > 0
      ? data.title.trim()
      : slug

  let tags: string[] = []
  if (Array.isArray(data.tags)) {
    tags = data.tags.filter((t): t is string => typeof t === "string")
  }

  return { slug, title, tags, body: content.trim() }
}

/** Load candidate posts from the index DB (published posts only, excluding target). */
export function loadCandidates(
  targetSlug: string,
  dbPath: string = DB_PATH,
): CandidatePost[] {
  if (!existsSync(dbPath)) {
    throw new Error(
      `index DB not found at ${dbPath}. Run \`bun run build-index --skip-embed\` first.`,
    )
  }
  const db = createDb(dbPath)
  try {
    const rows = queryMany<{
      id: string
      title: string
      tags: string
      content: string
    }>(
      db,
      `SELECT id, title, tags, content
         FROM notes
        WHERE folder_path = 'content/posts'
          AND id != ?
        ORDER BY updated_at DESC`,
      [targetSlug],
    )
    return rows.map((row) => {
      let tags: string[] = []
      try {
        tags = JSON.parse(row.tags) as string[]
      } catch {
        // malformed tags — treat as empty
      }
      const excerpt =
        row.content.length <= EXCERPT_CHARS
          ? row.content
          : row.content.slice(0, EXCERPT_CHARS) + "…"
      return { slug: row.id, title: row.title, tags, excerpt }
    })
  } finally {
    db.close()
  }
}

/** Validate raw LLM output: parse JSON array, run Zod, filter unknown slugs. */
export function validateSuggestions(
  raw: unknown,
  knownSlugs: Set<string>,
): Suggestion[] {
  const text = typeof raw === "string" ? raw : JSON.stringify(raw)

  // Extract first JSON array from the LLM response (handles fences + prose prefix)
  function extractJsonArray(s: string): string {
    const stripped = s.replace(/^```json?\n?/m, "").replace(/\n?```$/m, "").trim()
    const firstBracket = stripped.indexOf("[")
    const lastBracket = stripped.lastIndexOf("]")
    if (firstBracket === -1 || lastBracket < firstBracket) {
      // Fallback: maybe it's a JSON object with an array value
      const obj = extractJsonObject(stripped)
      const parsed = JSON.parse(obj)
      if (Array.isArray(parsed)) return JSON.stringify(parsed)
      // Try to find the first array value in the object
      const vals = Object.values(parsed as Record<string, unknown>)
      const arr = vals.find(Array.isArray)
      if (arr) return JSON.stringify(arr)
      return "[]"
    }
    return stripped.slice(firstBracket, lastBracket + 1)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(extractJsonArray(text))
  } catch {
    throw new Error(`LLM response is not valid JSON: ${text.slice(0, 200)}`)
  }

  const validated = suggestionsArraySchema.parse(parsed)

  // Filter out any suggestions whose target_slug doesn't exist in DB
  return validated.filter((s) => knownSlugs.has(s.target_slug))
}

export type SuggestLinksDeps = {
  callClaudeMessages: typeof callClaudeMessages
}

/** Call LLM and validate suggestions, retrying once on failure. */
export async function suggestLinks(
  target: TargetPost,
  candidates: CandidatePost[],
  limit: number,
  deps: SuggestLinksDeps = { callClaudeMessages },
): Promise<Suggestion[]> {
  const knownSlugs = new Set(candidates.map((c) => c.slug))

  // Trim candidates to a reasonable window so we don't blow the context budget.
  // Pass at most 50 candidates; the LLM gets a ranked excerpt per candidate.
  const trimmedCandidates = candidates.slice(0, 50)

  async function attempt(extraInstruction?: string): Promise<Suggestion[]> {
    const messages = buildSuggestLinksPrompt(target, trimmedCandidates)
    if (extraInstruction) {
      messages.push({ role: "user", content: extraInstruction })
    }
    const raw = await deps.callClaudeMessages(messages)
    const suggestions = validateSuggestions(raw, knownSlugs)
    return suggestions.slice(0, limit)
  }

  try {
    return await attempt()
  } catch (err) {
    const msg = (err as Error).message
    console.warn(`[suggest-links] first attempt failed: ${msg}. Retrying once…`)
    const retryHint =
      `Previous response failed validation: ${msg}\n` +
      `Reminder: return ONLY a JSON array. Use only slugs from the candidate list. ` +
      `Valid slugs: ${[...knownSlugs].join(", ")}.`
    return await attempt(retryHint)
  }
}

/** Format suggestions for human-readable stdout. */
export function formatSuggestions(suggestions: Suggestion[], filePath: string): string {
  if (suggestions.length === 0) {
    return `[suggest-links] No suggestions for ${filePath} — no high-confidence connections found.`
  }

  const lines: string[] = [`[suggest-links] ${suggestions.length} suggestion(s) for ${filePath}`, ""]

  for (const s of suggestions) {
    if (s.type === "wikilink") {
      lines.push(`  WIKILINK  [[${s.target_slug}|${s.surface}]]`)
      lines.push(`  Anchor:   ${s.anchor}`)
      lines.push(`  Why:      ${s.rationale}`)
    } else {
      lines.push(`  RELATED   ${s.target_slug}`)
      lines.push(`  Why:      ${s.rationale}`)
    }
    lines.push("")
  }

  const wikilinkCount = suggestions.filter((s) => s.type === "wikilink").length
  const relatedCount = suggestions.filter((s) => s.type === "related").length
  lines.push(
    `  (${wikilinkCount} wikilink${wikilinkCount !== 1 ? "s" : ""}, ` +
    `${relatedCount} related${relatedCount !== 1 ? "s" : ""})`,
  )
  return lines.join("\n")
}

// ── CLI entry ─────────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): SuggestLinksOptions {
  const args = argv.slice(2)
  const filePath = args.find((a) => !a.startsWith("--"))
  if (!filePath) {
    throw new Error("path to markdown file is required")
  }

  const jsonFlag = args.includes("--json")

  const limitArg = args.find((a) => a.startsWith("--limit="))
  let limit = DEFAULT_LIMIT
  if (limitArg) {
    const n = parseInt(limitArg.split("=")[1], 10)
    if (isNaN(n) || n < 1) throw new Error("--limit must be a positive integer")
    limit = n
  }

  return { filePath, json: jsonFlag, limit }
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("suggest-links.ts")

if (isMainModule) {
  ;(async () => {
    let options: SuggestLinksOptions
    try {
      options = parseArgs(process.argv)
    } catch (err) {
      console.error(`[suggest-links] ${(err as Error).message}`)
      console.error("usage: bun run scripts/suggest-links.ts <path-to-md> [--json] [--limit=N]")
      process.exit(1)
      return
    }

    try {
      const { checkClaudeAvailable } = await import("../src/lib/llm/claude-code.ts")
      checkClaudeAvailable()
    } catch (err) {
      console.error(`[suggest-links] ${(err as Error).message}`)
      process.exit(1)
      return
    }

    let target: ParsedTarget
    try {
      target = parseTargetFile(options.filePath)
    } catch (err) {
      console.error(`[suggest-links] ${(err as Error).message}`)
      process.exit(1)
      return
    }

    let candidates: CandidatePost[]
    try {
      candidates = loadCandidates(target.slug)
    } catch (err) {
      console.error(`[suggest-links] ${(err as Error).message}`)
      process.exit(1)
      return
    }

    if (candidates.length === 0) {
      if (options.json) {
        console.log(JSON.stringify([]))
      } else {
        console.log(`[suggest-links] No candidate posts in DB — nothing to compare against.`)
      }
      process.exit(0)
      return
    }

    console.error(`[suggest-links] ${candidates.length} candidates loaded, calling LLM…`)

    let suggestions: Suggestion[]
    try {
      suggestions = await suggestLinks(target, candidates, options.limit)
    } catch (err) {
      console.error(`[suggest-links] suggestion failed after retry: ${(err as Error).message}`)
      process.exit(1)
      return
    }

    if (options.json) {
      console.log(JSON.stringify(suggestions, null, 2))
    } else {
      console.log(formatSuggestions(suggestions, options.filePath))
    }

    process.exit(0)
  })().catch((err) => {
    console.error("[suggest-links] fatal:", err)
    process.exit(1)
  })
}
