// Build a case-insensitive wikilink resolver from a flat list of notes.
// Lookup order: bySlug → byTitle → byAlias → null.
// Slug always wins over alias on collision. When two notes claim the same alias,
// neither gets it — that alias resolves to null and both claimers are reported.

import type { WikilinkResolver, WikilinkTarget } from './resolve-wikilinks'

type AliasCollision = {
  alias: string        // lowercased contested alias
  claimers: string[]   // note slugs claiming this alias
}

export type NoteResolverResult = {
  resolve: WikilinkResolver
  collisions: AliasCollision[]
}

export function buildNoteResolver(
  notes: ReadonlyArray<{ slug: string; title: string; aliases?: string[] }>,
): NoteResolverResult {
  const byTitle = new Map<string, WikilinkTarget>()
  const bySlug = new Map<string, WikilinkTarget>()
  const byAlias = new Map<string, WikilinkTarget>()
  const collisions: AliasCollision[] = []

  // First pass: build slug + title maps
  for (const n of notes) {
    const entry: WikilinkTarget = { slug: n.slug, title: n.title }
    byTitle.set(n.title.trim().toLowerCase(), entry)
    bySlug.set(n.slug.trim().toLowerCase(), entry)
  }

  // Second pass: build alias map
  // Track candidates before committing to catch collisions
  const aliasClaimers = new Map<string, string[]>() // lowercased alias → claiming slugs

  for (const n of notes) {
    if (!n.aliases || n.aliases.length === 0) continue
    for (const raw of n.aliases) {
      const key = raw.trim().toLowerCase()
      if (!key) continue
      // Slug always wins — skip alias silently if it matches an existing slug
      if (bySlug.has(key)) continue
      const existing = aliasClaimers.get(key)
      if (existing) {
        existing.push(n.slug)
      } else {
        aliasClaimers.set(key, [n.slug])
      }
    }
  }

  // Resolve alias claimers: single claimer → add to byAlias; multiple → collision
  for (const [alias, claimers] of aliasClaimers) {
    if (claimers.length === 1) {
      // Safe: find the note and add it
      const note = notes.find((n) => n.slug === claimers[0])
      if (note) {
        byAlias.set(alias, { slug: note.slug, title: note.title })
      }
    } else {
      collisions.push({ alias, claimers })
    }
  }

  const resolve: WikilinkResolver = (target) => {
    const key = target.trim().toLowerCase()
    if (!key) return null
    return bySlug.get(key) ?? byTitle.get(key) ?? byAlias.get(key) ?? null
  }

  return { resolve, collisions }
}
