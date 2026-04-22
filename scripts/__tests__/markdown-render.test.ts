import { describe, it, expect } from 'vitest'
import { preprocessMarkdown } from '../../src/lib/markdown/preprocess'
import type { WikilinkResolver } from '../../src/lib/markdown/resolve-wikilinks'

// Integration surface: preprocessMarkdown is the single entry point the Astro
// render pipeline calls. Resolver injection is the contract that makes tests
// deterministic and makes fixture builds (no DB) silently safe.

const noResolver: WikilinkResolver = () => null

const minimalResolver: WikilinkResolver = (target) => {
  if (target.toLowerCase() === 'pagea') {
    return { slug: 'pagea', title: 'PageA' }
  }
  return null
}

describe('preprocessMarkdown (integration)', () => {
  it('plain markdown passes through unchanged', () => {
    const plain = '# Title\n\nNo wikilinks here.'
    expect(preprocessMarkdown(plain)).toBe(plain)
  })

  it('without resolver → every wikilink becomes a wikilink--missing span (no silent 404)', () => {
    expect(preprocessMarkdown('See [[PageA]] for details.')).toBe(
      'See <span class="wikilink wikilink--missing">PageA</span> for details.',
    )
  })

  it('with resolver → matched targets become .wikilink anchors', () => {
    expect(
      preprocessMarkdown('See [[PageA]] for details.', { resolver: minimalResolver }),
    ).toBe('See <a href="/notes/pagea" class="wikilink">PageA</a> for details.')
  })

  it('with resolver + hrefFor → anchor uses the base-path-aware href', () => {
    expect(
      preprocessMarkdown('See [[PageA]].', {
        resolver: minimalResolver,
        hrefFor: (slug) => `/meshblog/notes/${slug}`,
      }),
    ).toBe('See <a href="/meshblog/notes/pagea" class="wikilink">PageA</a>.')
  })

  it('unresolved targets become wikilink--missing spans, never anchors', () => {
    expect(
      preprocessMarkdown('Refers to [[Missing]].', { resolver: minimalResolver }),
    ).toBe('Refers to <span class="wikilink wikilink--missing">Missing</span>.')
  })

  it('explicit noResolver path behaves identically to default', () => {
    const md = 'See [[PageA]] for details.'
    expect(preprocessMarkdown(md, { resolver: noResolver })).toBe(
      preprocessMarkdown(md),
    )
  })
})
