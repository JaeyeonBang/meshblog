import { describe, it, expect } from 'vitest'
import {
  resolveWikilinks,
  type WikilinkResolver,
} from '../resolve-wikilinks'

// Deterministic test resolver: knows a small set of slugs; slugifies target the
// Obsidian way (lowercase + space→dash). Anything not in the set returns null.
const known = new Set([
  'existing',
  'some-concept',
  'prisma-vs-drizzle',
  'unicode-note',
])

const resolver: WikilinkResolver = (target) => {
  const slug = target.trim().toLowerCase().replace(/\s+/g, '-')
  if (!known.has(slug)) return null
  return { slug, title: target.trim() }
}

describe('resolveWikilinks — D2 adversarial cases', () => {
  // 1. Bare wikilink, target exists → anchor with title as display text
  it('[[Existing]] → anchor with title as text', () => {
    expect(resolveWikilinks('[[Existing]]', resolver)).toBe(
      '<a href="/notes/existing" class="wikilink">Existing</a>'
    )
  })

  // 2. Aliased wikilink, target exists → anchor with alias as display text
  it('[[Existing|alias]] → anchor with alias as text', () => {
    expect(resolveWikilinks('[[Existing|alias]]', resolver)).toBe(
      '<a href="/notes/existing" class="wikilink">alias</a>'
    )
  })

  // 3. Broken link → missing-state span fallback (no silent 404, visually distinct,
  //    tooltip explains why the stub is unclickable)
  it('[[Missing]] → wikilink--missing span with title tooltip', () => {
    expect(resolveWikilinks('[[Missing]]', resolver)).toBe(
      '<span class="wikilink wikilink--missing" title="대상 노트가 없습니다 · no matching note">Missing</span>'
    )
  })

  // 4. Broken link with alias → alias in missing-state span
  it('[[Missing|label]] → wikilink--missing span with alias', () => {
    expect(resolveWikilinks('[[Missing|label]]', resolver)).toBe(
      '<span class="wikilink wikilink--missing" title="대상 노트가 없습니다 · no matching note">label</span>'
    )
  })

  // 5. Image embed → Markdown image (preserves original filename as src)
  it('![[diagram.png]] → ![](diagram.png)', () => {
    expect(resolveWikilinks('![[diagram.png]]', resolver)).toBe(
      '![](diagram.png)'
    )
  })

  // 6. Image embed with caption (Obsidian pipe syntax) → alt + src
  it('![[photo.jpg|caption]] → ![caption](photo.jpg)', () => {
    expect(resolveWikilinks('![[photo.jpg|caption]]', resolver)).toBe(
      '![caption](photo.jpg)'
    )
  })

  // 7. Target has trailing space → trimmed before lookup
  it('[[ Existing ]] → anchor (whitespace trimmed, target still resolves)', () => {
    expect(resolveWikilinks('[[ Existing ]]', resolver)).toBe(
      '<a href="/notes/existing" class="wikilink">Existing</a>'
    )
  })

  // 8. Unicode / non-ASCII target passed through intact
  it('[[Unicode Note]] with non-ASCII title resolves', () => {
    expect(resolveWikilinks('[[Unicode Note]]', resolver)).toBe(
      '<a href="/notes/unicode-note" class="wikilink">Unicode Note</a>'
    )
  })

  // 9. Adjacent wikilinks (no separator) — both resolved independently
  it('[[Existing]][[Some Concept]] → two anchors back-to-back', () => {
    expect(resolveWikilinks('[[Existing]][[Some Concept]]', resolver)).toBe(
      '<a href="/notes/existing" class="wikilink">Existing</a>' +
        '<a href="/notes/some-concept" class="wikilink">Some Concept</a>'
    )
  })

  // 10. Empty alias → fall back to target for display
  it('[[Existing|]] → anchor using target as display text', () => {
    expect(resolveWikilinks('[[Existing|]]', resolver)).toBe(
      '<a href="/notes/existing" class="wikilink">Existing</a>'
    )
  })

  // 11. Empty target with alias → missing-state span with alias text
  it('[[|Y]] → wikilink--missing span (empty target never resolves)', () => {
    expect(resolveWikilinks('[[|Y]]', resolver)).toBe(
      '<span class="wikilink wikilink--missing" title="대상 노트가 없습니다 · no matching note">Y</span>'
    )
  })

  // 12. Standard Markdown link must survive unchanged (regression guard)
  it('[label](url) passes through untouched', () => {
    const input = '[label](https://example.com)'
    expect(resolveWikilinks(input, resolver)).toBe(input)
  })
})

describe('resolveWikilinks — context integration', () => {
  it('multiple wikilinks on one line resolve independently', () => {
    const input = 'See [[Existing]] and [[Missing]] for more.'
    expect(resolveWikilinks(input, resolver)).toBe(
      'See <a href="/notes/existing" class="wikilink">Existing</a> and ' +
        '<span class="wikilink wikilink--missing" title="대상 노트가 없습니다 · no matching note">Missing</span> for more.'
    )
  })

  it('surrounding markdown structure is preserved', () => {
    const input = '# Heading\n\nLink to [[Existing]] here.\n\n- bullet'
    expect(resolveWikilinks(input, resolver)).toBe(
      '# Heading\n\nLink to <a href="/notes/existing" class="wikilink">Existing</a> here.\n\n- bullet'
    )
  })

  it('empty input → empty output (no crash)', () => {
    expect(resolveWikilinks('', resolver)).toBe('')
  })
})
