import { z } from "zod"
import type { ChatMessage } from "../claude-code.ts"
import { loadStyleBlock } from "./loader.ts"

/** Bump when the system prompt changes — invalidates downstream caches. */
export const CONCEPT_NAMING_PROMPT_VERSION = "v2"

/**
 * Zod schema for LLM-generated concept name + description.
 * name: 1-80 chars, non-empty, no leading/trailing whitespace, no period at end.
 * description: 1-240 chars, non-empty.
 */
export const conceptNameSchema = z.object({
  name: z
    .string()
    .min(1, "name must not be empty")
    .max(80, "name must not exceed 80 characters")
    .refine((s) => s === s.trim(), "name must not have leading/trailing whitespace")
    .refine((s) => !s.endsWith("."), "name must not end with a period"),
  description: z
    .string()
    .min(1, "description must not be empty")
    .max(240, "description must not exceed 240 characters"),
})

export type ConceptName = z.infer<typeof conceptNameSchema>

/**
 * USER-EDITABLE STYLE block (override via `prompts/concept-naming.md`).
 * Voice and labeling rules. The CONTRACT block below is TS-locked.
 */
export const CONCEPT_NAMING_STYLE = `You are a knowledge graph labeling system. Given a list of entity names (and optional descriptions) that belong to the same Louvain community cluster, produce a single high-level concept label.

Rules for "name":
- 2-5 words, capitalized like a section heading (Title Case).
- No period at the end.
- Examples: "Attention Mechanisms", "Reinforcement Learning Methods", "Transformer Architectures".
- DO NOT just pick the first member name. The name should be the higher-level concept that connects all members.

Rules for "description":
- One sentence, ≤ 200 characters.
- Name the unifying concept and mention 2-3 key members.
- No period required at end, but allowed.`

/**
 * TS-LOCKED CONTRACT block — output JSON shape aligned to conceptNameSchema.
 * NEVER edited via prompts/. Always appended to the resolved STYLE.
 */
const CONCEPT_NAMING_CONTRACT = `Return ONLY a JSON object with this exact structure:
{ "name": string, "description": string }

Return ONLY the JSON object — no markdown fences, no prose, no explanation.`

function buildSystemPrompt(): string {
  const style = loadStyleBlock("concept-naming", CONCEPT_NAMING_STYLE)
  return `${style.body}\n\n${CONCEPT_NAMING_CONTRACT}`
}

function buildUserContent(
  memberNames: string[],
  memberDescriptions?: string[],
): string {
  const capped = memberNames.slice(0, 20)
  const cappedDescs = memberDescriptions?.slice(0, 20)
  const lines = capped.map((name, i) => {
    const desc = cappedDescs?.[i]
    return desc ? `- ${name}: ${desc}` : `- ${name}`
  })
  return `Community members:\n${lines.join("\n")}`
}

/**
 * Build the prompt messages for concept community naming.
 */
export function buildConceptNamingPrompt(
  memberNames: string[],
  memberDescriptions?: string[],
): ChatMessage[] {
  return [
    { role: "system", content: buildSystemPrompt() },
    { role: "user", content: buildUserContent(memberNames, memberDescriptions) },
  ]
}

/**
 * Single-string prompt for `claude -p` subprocess invocation. Currently unused
 * (concepts.ts uses OpenRouter), retained for future flexibility.
 */
export function buildConceptNamingPromptString(
  memberNames: string[],
  memberDescriptions?: string[],
): string {
  return `${buildSystemPrompt()}\n\n---\n\n${buildUserContent(memberNames, memberDescriptions)}`
}
