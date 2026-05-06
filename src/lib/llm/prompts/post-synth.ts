/**
 * post-synth.ts — LLM prompt for /draft-post long-form synthesis from N source notes.
 *
 * Bump POST_SYNTH_PROMPT_VERSION when the system prompt changes.
 */

import { z } from "zod"
import type { ChatMessage } from "../openrouter"

export const POST_SYNTH_PROMPT_VERSION = "v1"

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

const SYSTEM_PROMPT = `You are an editorial synthesizer. Given a target topic and N source notes, produce a long-form post (800-1500 words total) that draws on those sources.

Return ONLY a JSON object with this exact structure (no markdown fences, no prose):
{
  "title": string,
  "lede": string,
  "sections": [{ "heading": string, "body": string }],
  "conclusion": string
}

Rules:
- 2-8 sections. Each section body MUST cite at least one source via Markdown wikilink: [[<source-slug>|<surface>]]. Sections without a citation will be rejected.
- Use only facts present in the sources. Do not invent claims, papers, or quotes.
- Do NOT include a "Sources" or "References" section in your output — the post template appends one automatically.
- Do NOT include a "Conclusion" heading in sections — the conclusion field is rendered separately.
- Style: concise, editorial, no AI-slop phrases. Banned: "in conclusion", "furthermore", "moreover", "delve into", "let's break this down", "here's the kicker", "make no mistake", "can't stress this enough", "tapestry", "landscape", "underscore". Mix one-sentence paragraphs with 2-3 sentence runs. Be direct.
- Be opinionated where the sources support it; be cautious where they don't.
- Output ONLY the JSON object. No prose. No markdown fences.`

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
    { role: "system", content: SYSTEM_PROMPT },
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
