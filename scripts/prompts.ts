#!/usr/bin/env tsx
/**
 * scripts/prompts.ts — manage prompt overrides for the LLM-driven scripts.
 *
 * Three subcommands only (per Opus outer voice review 2026-05-07 — no
 * preset/scaffolder sprawl in v1):
 *
 *   bun run prompts list          # table: use, status (override vs default), path
 *   bun run prompts show <use>    # print resolved STYLE then CONTRACT
 *   bun run prompts validate      # check each override file parses
 *
 * Override files live at `prompts/<use>.md`. No subdirs. Plain markdown
 * (frontmatter optional, body is the STYLE block). The TS-locked CONTRACT
 * block is appended automatically at runtime — overrides cannot break the
 * JSON output schema.
 */

import {
  POST_SYNTH_STYLE,
} from "../src/lib/llm/prompts/post-synth.ts"
import {
  INGEST_ENRICH_STYLE,
} from "../src/lib/llm/prompts/ingest-enrich.ts"
import {
  CONCEPT_NAMING_STYLE,
} from "../src/lib/llm/prompts/concept-naming.ts"
import {
  SUGGEST_LINKS_STYLE,
} from "../src/lib/llm/prompts/suggest-links.ts"
import {
  ALL_USES,
  loadStyleBlock,
  listPromptStatus,
  validateOverrides,
  type PromptUse,
} from "../src/lib/llm/prompts/loader.ts"

// Defaults map: keep TS module exports as the canonical sources.
const DEFAULTS: Record<PromptUse, string> = {
  "post-synth": POST_SYNTH_STYLE,
  "ingest-enrich": INGEST_ENRICH_STYLE,
  "concept-naming": CONCEPT_NAMING_STYLE,
  "suggest-links": SUGGEST_LINKS_STYLE,
}

// Contracts are intentionally NOT exported from the prompt modules — they
// stay TS-locked. For `prompts show` we re-derive the resolved system prompt
// by calling the same loader the prompt modules use. The CONTRACT body is
// shown by re-reading the prompt module's source file (read-only). This keeps
// the contract block authoritative in TS without duplicating its text here.

export type ListRow = {
  use: PromptUse
  source: "override" | "default"
  path: string | null
  preview: string
}

export function commandList(): ListRow[] {
  return listPromptStatus(DEFAULTS).map((s) => ({
    use: s.use,
    source: s.source,
    path: s.path,
    preview: s.bodyPreview,
  }))
}

export function commandShow(use: PromptUse): { style: string; resolution: "override" | "default"; path: string | null } {
  if (!ALL_USES.includes(use)) {
    throw new Error(`unknown use: ${use}. Valid: ${ALL_USES.join(", ")}`)
  }
  const r = loadStyleBlock(use, DEFAULTS[use])
  return { style: r.body, resolution: r.source, path: r.path }
}

export function commandValidate(): { ok: boolean; errors: { use: PromptUse; path: string; error: string }[] } {
  const errors = validateOverrides()
  return { ok: errors.length === 0, errors }
}

// ── CLI dispatcher ────────────────────────────────────────────────────────────

function printList(): void {
  const rows = commandList()
  console.log("\nPrompt overrides:")
  console.log("  use              status     path                       preview")
  console.log("  ──────────────── ────────── ────────────────────────── ───────────")
  for (const r of rows) {
    const status = r.source === "override" ? "OVERRIDE" : "default "
    const path = r.path ?? "(TS default)"
    console.log(
      `  ${r.use.padEnd(16)} ${status.padEnd(10)} ${path.padEnd(26)} ${r.preview.slice(0, 60)}…`
    )
  }
  console.log(
    "\nCreate `prompts/<use>.md` to override the STYLE block. The CONTRACT block\n" +
    "(JSON output schema + hard rules) is TS-locked and always appended automatically.\n"
  )
}

function printShow(use: string): void {
  const result = commandShow(use as PromptUse)
  console.log(`\n=== STYLE (resolution: ${result.resolution}${result.path ? `, path: ${result.path}` : ""}) ===\n`)
  console.log(result.style)
  console.log("\n=== CONTRACT (TS-locked, always appended at runtime) ===\n")
  console.log(
    "(See `src/lib/llm/prompts/" + use + ".ts` for the contract block — search\n" +
    " for `_CONTRACT = `. Edits to the contract require a TS change + version bump.)\n"
  )
}

function printValidate(): void {
  const result = commandValidate()
  if (result.ok) {
    console.log("[prompts] validate: all overrides parse cleanly (or no overrides set).")
    process.exit(0)
    return
  }
  console.error("[prompts] validate: errors found")
  for (const e of result.errors) {
    console.error(`  ${e.use} (${e.path}): ${e.error}`)
  }
  process.exit(1)
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("prompts.ts")

if (isMainModule) {
  const args = process.argv.slice(2)
  const sub = args[0]
  switch (sub) {
    case "list":
      printList()
      break
    case "show": {
      const use = args[1]
      if (!use) {
        console.error("usage: bun run prompts show <use>")
        process.exit(1)
      }
      try {
        printShow(use)
      } catch (err) {
        console.error(`[prompts] ${(err as Error).message}`)
        process.exit(1)
      }
      break
    }
    case "validate":
      printValidate()
      break
    default:
      console.error("usage: bun run prompts <list|show <use>|validate>")
      process.exit(1)
  }
}
