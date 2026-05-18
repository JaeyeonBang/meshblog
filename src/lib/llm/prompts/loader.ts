/**
 * loader.ts — read user-customizable STYLE blocks from `prompts/<use>.md`.
 *
 * Each prompt site (post-synth, ingest-enrich, concept-naming) is split into:
 *   STYLE   — voice/format rules; user-editable via `prompts/<use>.md`
 *   CONTRACT — JSON output shape; TS-owned, always appended
 *
 * The loader returns whichever STYLE applies: override file body if present
 * and non-empty, otherwise the TS default constant.
 *
 * Why this shape: full system-prompt replacement was rejected (Opus outer
 * voice review 2026-05-07) — it lets users break the JSON contract and
 * confuses Zod failures with prompt typos. Splitting the contract out keeps
 * the override surface low-risk.
 */

import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import matter from "gray-matter"

export type PromptUse = "post-synth" | "ingest-enrich" | "concept-naming" | "suggest-links"

const ALL_USES: PromptUse[] = ["post-synth", "ingest-enrich", "concept-naming", "suggest-links"]
const PROMPTS_DIR = "prompts"

export type StyleResolution = {
  use: PromptUse
  source: "override" | "default"
  /** Absolute or relative override path when source==='override', else null. */
  path: string | null
  /** Resolved style body (override-or-default). */
  body: string
}

/**
 * Resolve the STYLE block for a given prompt use.
 * Reads `prompts/<use>.md`; if file is missing or its body is whitespace-only,
 * falls back to the TS default supplied by the caller.
 */
export function loadStyleBlock(use: PromptUse, tsDefault: string): StyleResolution {
  const path = join(PROMPTS_DIR, `${use}.md`)

  if (!existsSync(path)) {
    return { use, source: "default", path: null, body: tsDefault }
  }

  const raw = readFileSync(path, "utf-8")
  // Strip optional frontmatter — body only.
  const { content } = matter(raw)
  const trimmed = content.trim()

  if (trimmed.length === 0) {
    // Empty override falls back to TS default; documented behavior so an
    // accidentally-empty file doesn't silently break the LLM call.
    return { use, source: "default", path, body: tsDefault }
  }

  return { use, source: "override", path, body: trimmed }
}

export type PromptStatus = {
  use: PromptUse
  source: "override" | "default"
  path: string | null
  bodyPreview: string
}

/**
 * Inspect status of every known prompt use.
 * Used by `bun run prompts list`. Caller supplies the TS-default map so this
 * lib doesn't import every prompt module (avoids cycles).
 */
export function listPromptStatus(
  defaults: Record<PromptUse, string>,
  previewLength = 80,
): PromptStatus[] {
  return ALL_USES.map((use) => {
    const r = loadStyleBlock(use, defaults[use])
    return {
      use,
      source: r.source,
      path: r.path,
      bodyPreview: r.body.slice(0, previewLength).replace(/\s+/g, " "),
    }
  })
}

/**
 * Validate every override file (if present): must parse, must not be
 * meaningfully empty after trimming. Returns a list of errors; empty list
 * means all good.
 */
export function validateOverrides(): { use: PromptUse; path: string; error: string }[] {
  const errors: { use: PromptUse; path: string; error: string }[] = []
  for (const use of ALL_USES) {
    const path = join(PROMPTS_DIR, `${use}.md`)
    if (!existsSync(path)) continue
    try {
      const raw = readFileSync(path, "utf-8")
      const { content } = matter(raw)
      if (content.trim().length === 0) {
        errors.push({ use, path, error: "override file body is empty" })
      }
    } catch (err) {
      errors.push({ use, path, error: (err as Error).message })
    }
  }
  return errors
}

export { ALL_USES }
