/**
 * post-synth.ts — LLM prompt for /draft-post long-form synthesis from N source notes.
 *
 * Bump POST_SYNTH_PROMPT_VERSION when the system prompt changes.
 *
 * The system prompt is split into:
 *   POST_SYNTH_STYLE — voice/format rules; user-editable via prompts/post-synth.md
 *   POST_SYNTH_CONTRACT — output JSON shape aligned to postSynthSchema; TS-locked
 *
 * Rationale: Opus outer voice review (2026-05-07) flagged that full-prompt
 * overrides let users break the JSON contract and confuse Zod failures with
 * prompt typos. Splitting the contract out keeps the override surface
 * low-risk while still letting users tune voice freely.
 */

import { z } from "zod"
import type { ChatMessage } from "../openrouter"
import { loadStyleBlock } from "./loader.ts"

export const POST_SYNTH_PROMPT_VERSION = "v2"

export const postSynthSchema = z.object({
  title: z.string().min(1).max(200),
  lede: z.string().min(20).max(800),
  sections: z
    .array(
      z.object({
        heading: z.string().min(1).max(100),
        body: z.string().min(50),
      })
    )
    .min(2)
    .max(8),
  conclusion: z.string().min(20).max(800),
})

export type PostSynth = z.infer<typeof postSynthSchema>

export type SourceNote = {
  slug: string
  title: string
  body: string
  tags: string[]
}

const MAX_SOURCE_BODY_CHARS = 8_000

function clampBody(body: string): string {
  if (body.length <= MAX_SOURCE_BODY_CHARS) return body
  return body.slice(0, MAX_SOURCE_BODY_CHARS) + "\n\n[...truncated]"
}

/**
 * USER-EDITABLE STYLE block (override via `prompts/post-synth.md`).
 * Voice, banned phrases, length budget. The CONTRACT block below is
 * TS-locked and always appended to whatever style is resolved.
 */
export const POST_SYNTH_STYLE = `You are an editorial synthesizer. Given a target topic and N source notes, produce a long-form post (800-1500 words total) that draws on those sources.

Style rules:
- Use only facts present in the sources. Do not invent claims, papers, or quotes.
- Concise, editorial voice. Mix one-sentence paragraphs with 2-3 sentence runs. Be direct.
- Banned phrases: "in conclusion", "furthermore", "moreover", "delve into", "let's break this down", "here's the kicker", "make no mistake", "can't stress this enough", "tapestry", "landscape", "underscore".
- Be opinionated where the sources support it; be cautious where they don't.`

/**
 * TS-LOCKED CONTRACT block — output JSON shape aligned to postSynthSchema.
 * NEVER edited via prompts/. Always appended to the resolved STYLE.
 */
const POST_SYNTH_CONTRACT = `Return ONLY a JSON object with this exact structure (no markdown fences, no prose):
{
  "title": string,
  "lede": string,
  "sections": [{ "heading": string, "body": string }],
  "conclusion": string
}

Hard rules (do not relax):
- 2-8 sections. Each section body MUST cite at least one source via Markdown wikilink: [[<source-slug>|<surface>]]. Sections without a citation will be rejected.
- Do NOT include a "Sources" or "References" section in your output — the post template appends one automatically.
- Do NOT include a "Conclusion" heading in sections — the conclusion field is rendered separately.
- Output ONLY the JSON object. No prose. No markdown fences.`

function buildSystemPrompt(): string {
  const style = loadStyleBlock("post-synth", POST_SYNTH_STYLE)
  return `${style.body}\n\n${POST_SYNTH_CONTRACT}`
}

export function buildPostSynthPrompt(topic: string, sources: SourceNote[]): ChatMessage[] {
  const sourceBlocks = sources
    .map(
      (s) =>
        `### Source: [[${s.slug}|${s.title}]]\n` +
        `tags: ${s.tags.join(", ") || "(none)"}\n\n` +
        clampBody(s.body)
    )
    .join("\n\n---\n\n")

  const slugList = sources.map((s) => `- ${s.slug} ("${s.title}")`).join("\n")

  const userContent =
    `Topic: ${topic}\n\n` +
    `Available source slugs (cite via [[slug|surface]]):\n${slugList}\n\n` +
    `--- sources ---\n${sourceBlocks}`

  return [
    { role: "system", content: buildSystemPrompt() },
    { role: "user", content: userContent },
  ]
}

/**
 * Returns sections that fail to cite any source slug. Citations are detected
 * via the `[[<slug>|...]]` or `[[<slug>]]` patterns in the section body.
 */
export function findUncitedSections(
  result: PostSynth,
  sourceSlugs: string[]
): { index: number; heading: string }[] {
  const slugSet = new Set(sourceSlugs)
  const wikiRe = /\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g
  const uncited: { index: number; heading: string }[] = []

  result.sections.forEach((section, index) => {
    let cited = false
    for (const m of section.body.matchAll(wikiRe)) {
      const target = m[1].trim()
      if (slugSet.has(target)) {
        cited = true
        break
      }
    }
    if (!cited) uncited.push({ index, heading: section.heading })
  })

  return uncited
}
