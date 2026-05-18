/**
 * suggest-links.ts — LLM prompt for /suggest-links.
 *
 * Bump SUGGEST_LINKS_PROMPT_VERSION when the system prompt or Zod schema changes.
 *
 * Like post-synth, the prompt is split into:
 *   SUGGEST_LINKS_STYLE  — inference rules; user-editable via prompts/suggest-links.md
 *   SUGGEST_LINKS_CONTRACT — output JSON shape aligned to suggestionSchema; TS-locked
 */

import { z } from "zod"
import type { ChatMessage } from "../claude-code.ts"
import { loadStyleBlock } from "./loader.ts"

export const SUGGEST_LINKS_PROMPT_VERSION = "v1"

// ── Zod schema ────────────────────────────────────────────────────────────────

const wikilinkSuggestionSchema = z.object({
  type: z.literal("wikilink"),
  target_slug: z.string().min(1),
  surface: z.string().min(1),
  rationale: z.string().min(1),
  anchor: z.string().min(1),
})

const relatedSuggestionSchema = z.object({
  type: z.literal("related"),
  target_slug: z.string().min(1),
  rationale: z.string().min(1),
})

export const suggestionSchema = z.discriminatedUnion("type", [
  wikilinkSuggestionSchema,
  relatedSuggestionSchema,
])

export const suggestionsArraySchema = z.array(suggestionSchema)

export type Suggestion = z.infer<typeof suggestionSchema>
export type WikilinkSuggestion = z.infer<typeof wikilinkSuggestionSchema>
export type RelatedSuggestion = z.infer<typeof relatedSuggestionSchema>

// ── Prompt components ─────────────────────────────────────────────────────────

/**
 * USER-EDITABLE STYLE block (override via `prompts/suggest-links.md`).
 * Controls inference rules and confidence thresholds. The CONTRACT block
 * below is TS-locked and always appended.
 */
export const SUGGEST_LINKS_STYLE = `You are a link-suggestion assistant for a personal knowledge blog. Given a draft post and a list of existing posts in the same blog, identify where the draft would benefit from wikilinks or frontmatter "related:" pointers to those existing posts.

Inference rules:
- Prefer "wikilink" ONLY when the target slug's topic is directly mentioned or quoted in a specific sentence of the draft. There should be a concrete sentence you can point to.
- Prefer "related" when the topics are adjacent or thematically connected but are NOT directly cited in the body. "Related" means "a reader of this post would also want to read that one."
- If confidence is low — the connection is tenuous, superficial, or keyword-only — skip the suggestion entirely. Do NOT fill the quota.
- Maximum 8 suggestions total across both types. Fewer high-quality suggestions are better than many low-quality ones.
- Never suggest a link to the target post itself.`

/**
 * TS-LOCKED CONTRACT block — output JSON shape aligned to suggestionsArraySchema.
 * NEVER edited via prompts/. Always appended to the resolved STYLE.
 */
const SUGGEST_LINKS_CONTRACT = `Return ONLY a JSON array (no markdown fences, no prose). Each element must be one of:

Wikilink suggestion (inline body link):
{ "type": "wikilink", "target_slug": string, "surface": string, "rationale": string, "anchor": string }
  - target_slug: the slug of the existing post to link to
  - surface: the display text to use inside [[target_slug|surface]]
  - rationale: 1-2 sentences explaining why this link fits
  - anchor: the specific phrase or sentence from the DRAFT where the link belongs

Related suggestion (frontmatter pointer):
{ "type": "related", "target_slug": string, "rationale": string }
  - target_slug: the slug of the existing post
  - rationale: 1-2 sentences explaining the thematic connection

Hard rules:
- Output ONLY the JSON array. No prose. No markdown fences.
- If there are no good suggestions, return an empty array: []
- Do NOT invent slugs. Only use slugs from the provided candidate list.`

function buildSystemPrompt(): string {
  const style = loadStyleBlock("suggest-links", SUGGEST_LINKS_STYLE)
  return `${style.body}\n\n${SUGGEST_LINKS_CONTRACT}`
}

// ── Types used by the script ─────────────────────────────────────────────────

export type CandidatePost = {
  slug: string
  title: string
  tags: string[]
  excerpt: string
}

export type TargetPost = {
  slug: string
  title: string
  tags: string[]
  body: string
}

// ── Prompt builder ────────────────────────────────────────────────────────────

export function buildSuggestLinksPrompt(
  target: TargetPost,
  candidates: CandidatePost[],
): ChatMessage[] {
  const candidateBlocks = candidates
    .map(
      (c) =>
        `### ${c.slug}\nTitle: ${c.title}\nTags: ${c.tags.join(", ") || "(none)"}\nExcerpt: ${c.excerpt}`,
    )
    .join("\n\n")

  const slugList = candidates.map((c) => `- ${c.slug} ("${c.title}")`).join("\n")

  const userContent =
    `## Draft post being reviewed\n\n` +
    `Slug: ${target.slug}\n` +
    `Title: ${target.title}\n` +
    `Tags: ${target.tags.join(", ") || "(none)"}\n\n` +
    `### Body\n\n${target.body}\n\n` +
    `---\n\n` +
    `## Available candidate posts (use ONLY these slugs)\n\n${slugList}\n\n` +
    `### Candidate excerpts\n\n${candidateBlocks}`

  return [
    { role: "system", content: buildSystemPrompt() },
    { role: "user", content: userContent },
  ]
}
