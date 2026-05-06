/**
 * backfill-aliases.ts — CLI tool to suggest and write frontmatter aliases.
 *
 * For each note without aliases (or with empty aliases), calls OpenRouter
 * (Haiku 4.5) to suggest common acronyms and short forms, then writes
 * the result back into the frontmatter.
 *
 * Usage:
 *   bun run scripts/backfill-aliases.ts [--dry-run] [--yes]
 *
 *   --dry-run  Print proposed changes, write nothing.
 *   --yes      Skip confirmation prompt and write immediately.
 */

import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs"
import { join, basename, extname } from "node:path"
import matter from "gray-matter"
import { callOpenRouter } from "../src/lib/llm/openrouter.ts"
import * as readline from "node:readline"

// Why OpenRouter not `claude -p`? Measured cost on Claude Code:
// `claude -p --model haiku` = ~$0.099/call (79K cache tokens loaded each spawn).
// OpenRouter Haiku 4.5 = ~$0.001/call. 12+ notes × 100× = matters.
const CONTENT_DIRS = ["content/notes", "content/posts"]
const HAIKU_MODEL = "anthropic/claude-haiku-4-5"
const MAX_ALIASES = 5
const CONTENT_SNIPPET_CHARS = 1500

// ── Exported helpers (used by tests) ─────────────────────────────────────────

export type Candidate = {
  filePath: string
  slug: string
  title: string
  contentSnippet: string
}

/**
 * Walk `dirs` non-recursively and return notes that need alias backfill.
 * A note is a candidate if `aliases` is missing or an empty array.
 */
export function collectCandidates(dirs: string[]): Candidate[] {
  const candidates: Candidate[] = []

  for (const dir of dirs) {
    if (!existsSync(dir)) continue
    const files = readdirSync(dir).filter((f) => f.endsWith(".md") && !f.endsWith(".en.md"))

    for (const file of files) {
      const filePath = join(dir, file)
      let raw: string
      try {
        raw = readFileSync(filePath, "utf-8")
      } catch {
        continue
      }

      const { data: fm, content } = matter(raw)
      // Skip drafts
      if (fm.draft === true || fm.public === false) continue

      const existingAliases = fm.aliases
      const hasAliases =
        Array.isArray(existingAliases) && existingAliases.length > 0
      if (hasAliases) continue

      const slug = basename(file, extname(file))
      const title = (fm.title as string) ?? slug
      const contentSnippet = content.trim().slice(0, CONTENT_SNIPPET_CHARS)

      candidates.push({ filePath, slug, title, contentSnippet })
    }
  }

  return candidates
}

/**
 * Validate and parse an LLM JSON response into a string array of aliases.
 * Returns null if the response is invalid.
 * Caps at MAX_ALIASES entries.
 */
export function validateAliasesResponse(json: string): string[] | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return null
  }

  if (typeof parsed !== "object" || parsed === null) return null
  const obj = parsed as Record<string, unknown>
  if (!Array.isArray(obj.aliases)) return null

  const aliases = (obj.aliases as unknown[])
    .filter((a): a is string => typeof a === "string" && a.trim().length > 0)
    .map((a) => a.trim())
    .slice(0, MAX_ALIASES)

  return aliases
}

/**
 * Write aliases into the frontmatter of the given file.
 * Preserves all other frontmatter fields and the body.
 */
export function applyAliases(filePath: string, aliases: string[]): void {
  const raw = readFileSync(filePath, "utf-8")
  const { data: fm, content } = matter(raw)
  const updated = matter.stringify(content, { ...fm, aliases })
  writeFileSync(filePath, updated, "utf-8")
}

/**
 * Conditionally apply aliases — writes only when !dryRun.
 */
export function applyAliasesIfNotDryRun(
  filePath: string,
  aliases: string[],
  dryRun: boolean,
): void {
  if (dryRun) return
  applyAliases(filePath, aliases)
}

// ── LLM call ─────────────────────────────────────────────────────────────────

async function suggestAliases(title: string, contentSnippet: string): Promise<string[]> {
  const prompt =
    `Given title "${title}" and content snippet (first 1500 chars), return JSON ` +
    `{"aliases": string[]}. Aliases should include common acronyms (e.g. PPO for ` +
    `Proximal Policy Optimization), hyphenation variants (self-attention vs Self Attention), ` +
    `and widely-recognised short forms. Return 0-3 aliases. Empty array if none obvious. ` +
    `JSON only, no prose.`

  const response = await callOpenRouter({
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: `Title: ${title}\n\nContent:\n${contentSnippet}` },
    ],
    model: HAIKU_MODEL,
    maxTokens: 200,
    temperature: 0.3,
  })

  const json = await response.json()
  const raw = json?.choices?.[0]?.message?.content ?? ""
  return validateAliasesResponse(raw) ?? []
}

// ── CLI prompt ────────────────────────────────────────────────────────────────

async function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim().toLowerCase() === "y")
    })
  })
}

// ── Main CLI entry ─────────────────────────────────────────────────────────────

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("backfill-aliases.ts")

if (isMainModule) {
  const args = process.argv.slice(2)
  const dryRun = args.includes("--dry-run")
  const yes = args.includes("--yes")

  console.log(`[backfill-aliases] scanning ${CONTENT_DIRS.join(", ")}...`)
  const candidates = collectCandidates(CONTENT_DIRS)

  if (candidates.length === 0) {
    console.log("[backfill-aliases] all notes already have aliases — nothing to do")
    process.exit(0)
  }

  console.log(`[backfill-aliases] ${candidates.length} notes need alias backfill`)

  if (!process.env.OPENROUTER_API_KEY) {
    console.error("[backfill-aliases] OPENROUTER_API_KEY is not set — aborting")
    process.exit(1)
  }

  // Collect all suggestions
  type Suggestion = { candidate: Candidate; aliases: string[] }
  const suggestions: Suggestion[] = []

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i]
    console.log(`[backfill-aliases] (${i + 1}/${candidates.length}) "${c.title}"...`)
    try {
      const aliases = await suggestAliases(c.title, c.contentSnippet)
      suggestions.push({ candidate: c, aliases })
      if (aliases.length > 0) {
        console.log(`  → suggested: [${aliases.join(", ")}]`)
        if (dryRun) {
          console.log(`  [dry-run] would write aliases: [${aliases.join(", ")}] to ${c.filePath}`)
        }
      } else {
        console.log(`  → no aliases suggested`)
      }
    } catch (err) {
      console.error(`  [error] failed to get suggestions for "${c.title}": ${(err as Error).message}`)
    }
  }

  const toWrite = suggestions.filter((s) => s.aliases.length > 0)

  if (toWrite.length === 0) {
    console.log("[backfill-aliases] no aliases to write")
    process.exit(0)
  }

  if (dryRun) {
    console.log(`[backfill-aliases] dry-run: would apply ${toWrite.length} changes — no files written`)
    process.exit(0)
  }

  // Confirm before writing
  let shouldWrite = yes
  if (!shouldWrite) {
    shouldWrite = await confirm(
      `[backfill-aliases] apply ${toWrite.length} changes? [y/N] `,
    )
  }

  if (!shouldWrite) {
    console.log("[backfill-aliases] aborted — no files written")
    process.exit(0)
  }

  for (const { candidate, aliases } of toWrite) {
    try {
      applyAliases(candidate.filePath, aliases)
      console.log(`[backfill-aliases] wrote ${candidate.filePath}`)
    } catch (err) {
      console.error(`[backfill-aliases] failed to write ${candidate.filePath}: ${(err as Error).message}`)
    }
  }

  console.log("[backfill-aliases] done")
}
