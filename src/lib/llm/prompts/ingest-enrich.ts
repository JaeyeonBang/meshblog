/**
 * ingest-enrich.ts — LLM prompt for /ingest-raw frontmatter + auto-link suggestions.
 *
 * Bump INGEST_ENRICH_PROMPT_VERSION when the system prompt changes.
 *
 * The system prompt is split into:
 *   INGEST_ENRICH_STYLE — voice/format rules; user-editable via prompts/ingest-enrich.md
 *   INGEST_ENRICH_CONTRACT — output JSON shape aligned to ingestEnrichSchema; TS-locked
 *
 * Rationale identical to post-synth.ts (Opus outer voice review 2026-05-07).
 */

import { z } from "zod"
import type { ChatMessage } from "../openrouter"
import { loadStyleBlock } from "./loader.ts"

export const INGEST_ENRICH_PROMPT_VERSION = "v2"

export const ingestEnrichSchema = z.object({
  title: z.string().min(1).max(200),
  tags: z.array(z.string().min(1).max(40)).max(5).default([]),
  aliases: z.array(z.string().min(1).max(80)).max(5).default([]),
  body: z.string().min(1),
  suggested_links: z
    .array(
      z.object({
        surface: z.string().min(1).max(120),
        target_slug: z.string().min(1).max(120),
      })
    )
    .max(20)
    .default([]),
})

export type IngestEnrich = z.infer<typeof ingestEnrichSchema>

const MAX_RAW_CHARS = 16_000

/**
 * USER-EDITABLE STYLE block (override via `prompts/ingest-enrich.md`).
 * Voice and field-derivation rules. The CONTRACT below is TS-locked.
 */
export const INGEST_ENRICH_STYLE = `You are a knowledge-vault ingest enricher. Given a raw document, produce structured frontmatter + cleaned body markdown + a list of wikilink candidates.

Style rules:
- title: concise, slugifiable. Strip quotes, colons, paper-numbering prefixes. If the raw has an obvious paper title or document heading, use that.
- tags: ≤ 5. Prefer entries from the supplied existing_tags list (case-insensitive). Suggest a new tag only when no existing tag fits.
- aliases: ≤ 5. Obvious acronyms, hyphenation variants, common alternate forms (e.g. "PPO" alongside "Proximal Policy Optimization"). Empty array if none obvious — do not invent.
- body: cleaned markdown. Preserve headings, code blocks, math, tables, lists. Strip Notion-export cruft (page-id suffixes in headings, hash-only URLs, bare image-export lines without alt text). Strip YAML frontmatter if present in the raw.
- suggested_links: only entries whose target_slug appears in the supplied existing_entities list. Match by lowercased name. The surface MUST appear verbatim in your body output. Skip surfaces shorter than 3 chars. Aim for 0-10 high-confidence links — do not fish.
- Do NOT hallucinate facts not present in the raw text. If the raw has no extractable title, use the filename stem.`

/**
 * TS-LOCKED CONTRACT block — output JSON shape aligned to ingestEnrichSchema.
 * NEVER edited via prompts/. Always appended to the resolved STYLE.
 */
const INGEST_ENRICH_CONTRACT = `Return ONLY a JSON object with this exact structure (no markdown fences, no prose):
{
  "title": string,
  "tags": string[],
  "aliases": string[],
  "body": string,
  "suggested_links": [{ "surface": string, "target_slug": string }]
}

Output ONLY the JSON object. No prose. No markdown fences.`

function buildSystemPrompt(): string {
  const style = loadStyleBlock("ingest-enrich", INGEST_ENRICH_STYLE)
  return `${style.body}\n\n${INGEST_ENRICH_CONTRACT}`
}

function clampRaw(raw: string): string {
  if (raw.length <= MAX_RAW_CHARS) return raw
  return raw.slice(0, MAX_RAW_CHARS) + "\n\n[...truncated]"
}

export function buildIngestEnrichPrompt(
  rawText: string,
  existingTags: string[],
  existingEntities: { name: string; slug: string; title?: string }[]
): ChatMessage[] {
  const tagsLine = existingTags.length > 0
    ? existingTags.slice(0, 60).join(", ")
    : "(none)"

  // Cap entity vocab to avoid blowing the token budget. 200 caller-side, but
  // truncate further here as a safety net.
  const entityLines = existingEntities
    .slice(0, 200)
    .map((e) => `- ${e.name} → ${e.slug}${e.title ? ` (${e.title})` : ""}`)
    .join("\n")

  const userContent =
    `existing_tags: ${tagsLine}\n\n` +
    `existing_entities (name → target_slug):\n${entityLines || "(none)"}\n\n` +
    `--- raw document ---\n${clampRaw(rawText)}`

  return [
    { role: "system", content: buildSystemPrompt() },
    { role: "user", content: userContent },
  ]
}
