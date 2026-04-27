/**
 * labelFormat.ts — Display-name formatter for category slugs.
 *
 * Mirrors scripts/build-index.ts slugToName so client-side rendering is
 * consistent even when public/graph/categories.json contains stale
 * pre-acronym labels (e.g. "Rl" instead of "RL").
 */

const ACRONYMS = new Set([
  'ai', 'ml', 'rl', 'nlp', 'llm', 'rag', 'rnn', 'cnn', 'gpu', 'cpu',
  'api', 'css', 'js', 'ts', 'ui', 'ux', 'ci', 'cd', 'qa', 'seo',
  'rlhf', 'ppo', 'lora', 'peft',
])

/** kebab-case slug → display name, with acronyms rendered UPPERCASE. */
export function slugToLabel(slug: string): string {
  return slug
    .split('-')
    .map(w => {
      const lower = w.toLowerCase()
      if (ACRONYMS.has(lower)) return lower.toUpperCase()
      return w.charAt(0).toUpperCase() + w.slice(1)
    })
    .join(' ')
}

/**
 * If the incoming label looks like a naively title-cased slug
 * (single token, first letter capitalised), reformat via slugToLabel.
 * Otherwise return the label unchanged so user-supplied display names
 * (e.g. "데이터 사이언스") survive.
 */
export function normalizeLabel(slug: string, label: string | undefined): string {
  if (!label) return slugToLabel(slug)
  // Heuristic: if the label, lowercased + dehyphenated, equals the slug, it's
  // an auto-generated name → reformat. Otherwise trust the user.
  const dehyphenated = slug.replace(/-/g, ' ')
  if (label.toLowerCase() === dehyphenated.toLowerCase()) {
    return slugToLabel(slug)
  }
  return label
}
