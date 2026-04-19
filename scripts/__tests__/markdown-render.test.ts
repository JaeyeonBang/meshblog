import { describe, it, expect } from 'vitest'
import { stripWikilinks } from '../../src/lib/markdown/strip-wikilinks'
import { preprocessMarkdown } from '../../src/lib/markdown/preprocess'

describe('stripWikilinks', () => {
  it('[[X]] → X (bare wikilink becomes display text)', () => {
    expect(stripWikilinks('[[Hello]]')).toBe('Hello')
  })

  it('[[X|Y]] → Y (alias takes priority over target)', () => {
    expect(stripWikilinks('[[Hello|World]]')).toBe('World')
  })

  it('[[]] → "" (empty target produces empty string)', () => {
    expect(stripWikilinks('[[]]')).toBe('')
  })

  it('[[A]][[B]] → AB (consecutive wikilinks both stripped)', () => {
    expect(stripWikilinks('[[A]][[B]]')).toBe('AB')
  })

  it('[label](url) preserved (regular MD link unchanged)', () => {
    const input = '[label](https://example.com)'
    expect(stripWikilinks(input)).toBe(input)
  })

  it('before [[X]] after → before X after (mixed line)', () => {
    expect(stripWikilinks('before [[X]] after')).toBe('before X after')
  })

  it('multi-line markdown is preserved around wikilinks', () => {
    const input = '# Heading\n\nSome text [[Note]] here.\n\nParagraph 2.'
    expect(stripWikilinks(input)).toBe('# Heading\n\nSome text Note here.\n\nParagraph 2.')
  })

  it('[[X|]] → X (empty alias is falsy so falls back to target)', () => {
    // alias capture group is "" which is falsy; the regex falls through to `target`
    expect(stripWikilinks('[[Target|]]')).toBe('Target')
  })

  it('[[|Y]] → Y (empty target with alias still returns alias)', () => {
    // target = "", _pipe = "|Y", alias = "Y" — alias is truthy, returned
    expect(stripWikilinks('[[|Y]]')).toBe('Y')
  })

  it('multiple wikilinks on same line all resolved', () => {
    expect(stripWikilinks('[[A]] and [[B|C]] done')).toBe('A and C done')
  })
})

describe('preprocessMarkdown', () => {
  it('delegates to stripWikilinks (identity on plain markdown)', () => {
    const plain = '# Title\n\nNo wikilinks here.'
    expect(preprocessMarkdown(plain)).toBe(plain)
  })

  it('delegates to stripWikilinks (wikilinks resolved)', () => {
    expect(preprocessMarkdown('See [[PageA]] for details.')).toBe('See PageA for details.')
  })
})
