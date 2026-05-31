import { resolveWikilinks, type WikilinkResolver } from './resolve-wikilinks'

export interface PreprocessOptions {
  resolver?: WikilinkResolver
  // `kind` lets callers route post targets to /posts/<slug> and notes to
  // /notes/<slug>. Optional second arg keeps existing single-arg callers valid.
  hrefFor?: (slug: string, kind?: 'post' | 'note') => string
}

// Missing resolver → every wikilink is treated as broken and rendered as plain
// display text (alias or target). Safe for fixture/test paths where the notes
// DB is not wired, and preserves the "no silent 404" contract.
const neverResolves: WikilinkResolver = () => null

export function preprocessMarkdown(raw: string, opts: PreprocessOptions = {}): string {
  const resolver = opts.resolver ?? neverResolves
  return resolveWikilinks(raw, resolver, opts.hrefFor)
}
