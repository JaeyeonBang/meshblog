import type { ChatMessage } from "../openrouter"

const ENTITY_TYPES = ["person", "technology", "project", "concept", "organization", "other"] as const

const SYSTEM_PROMPT = `You are an entity extraction system. Extract entities and relationships from the given note content.

Return a JSON object with this exact structure:
{
  "entities": [
    { "name": "Entity Name", "type": "technology", "description": "Brief description" }
  ],
  "relationships": [
    { "source": "Entity A", "target": "Entity B", "relationship": "used_in" }
  ]
}

Rules:
- Entity types must be one of: ${ENTITY_TYPES.join(", ")}
- Use canonical names (e.g., "Next.js" not "nextjs", "React" not "react.js"). Use the most widely-recognised short form for methods/papers ("PPO" not "Proximal Policy Optimization", "RLHF" not "Reinforcement Learning from Human Feedback") so the same idea collapses to one entity across notes.
- Only extract entities that are explicitly mentioned in the text
- Keep descriptions under 50 characters
- Relationships should describe how entities relate (e.g., "used_in", "created_by", "part_of", "related_to", "compared_with", "extends")
- **Always extract cited methods, baselines, and predecessors as entities** — even when the note is primarily about a different topic. If a paper compares against PPO, GRPO, or RLHF, those are entities. If a survey references a model or technique by name, that's an entity. This cross-pollination is what links concepts together in the knowledge graph; without it, posts about niche topics become disconnected nodes.
- Return up to 25 entities and 25 relationships. Prefer richer coverage — extract every distinct technical concept, person, paper, model, method, and tool mentioned, even if it appears once. Granular entities make the knowledge graph denser and more useful.
- If the note has no extractable entities, return {"entities": [], "relationships": []}
- Return ONLY the JSON object, no markdown or explanation`

export function buildEntityExtractionPrompt(noteContent: string): ChatMessage[] {
  const cleaned = noteContent
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 16000)

  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: cleaned || "Empty note" },
  ]
}

export { ENTITY_TYPES }
