/**
 * Map of known acronym slugs → their display form. Applied at render time
 * so the DB / fixture seed can stay lowercase-slug without bleeding into UI.
 *
 * Extend this set when new acronym categories are added.
 */
const ACRONYM_NAMES: Record<string, string> = {
  ai: 'AI',
  api: 'API',
  css: 'CSS',
  db: 'DB',
  html: 'HTML',
  js: 'JS',
  llm: 'LLM',
  nlp: 'NLP',
  rag: 'RAG',
  sql: 'SQL',
  ui: 'UI',
  ux: 'UX',
}

/**
 * Return the display name for a category, respecting the acronym override
 * map. Falls back to the raw name from the DB when no override exists.
 *
 * Usage: `formatCategoryName('ai', 'Ai') // → 'AI'`
 */
export function formatCategoryName(slug: string, name: string): string {
  return ACRONYM_NAMES[slug.toLowerCase()] ?? name
}
