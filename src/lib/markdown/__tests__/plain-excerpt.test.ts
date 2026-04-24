import { describe, it, expect } from 'vitest'
import { plainExcerpt } from '../plain-excerpt'

describe('plainExcerpt', () => {
  it('strips leading # Title line (gray-matter shape)', () => {
    const input = '\n# My Post\n\nBody sentence one. Body sentence two.'
    // "Body sentence one. Body sentence two." = 37 chars, fits in maxChars=40
    expect(plainExcerpt(input, 40)).toBe('Body sentence one. Body sentence two.')
  })

  it('strips mid-body H2/H3 headings, not just the leading one', () => {
    // The actual R8 bug: excerpt sliced right into a mid-body H2.
    const input = 'First paragraph sentence.\n\n## 실제로 부닥친 문제들\n\nNext paragraph.'
    const out = plainExcerpt(input, 120)
    expect(out).not.toContain('실제로 부닥친 문제들')
    expect(out).toContain('First paragraph sentence')
    expect(out).toContain('Next paragraph')
  })

  it('strips inline markdown chars', () => {
    expect(plainExcerpt('**bold** and _italic_ and `code`', 50)).toBe('bold and italic and code')
  })

  it('collapses multi-line whitespace to single spaces', () => {
    expect(plainExcerpt('A\n\n\nB\n\nC', 20)).toBe('A B C')
  })

  it('returns empty string for empty input', () => {
    expect(plainExcerpt('', 100)).toBe('')
  })

  it('respects maxChars and does not return a partial word trail with whitespace', () => {
    // After slicing, trimEnd — should not have trailing space.
    const out = plainExcerpt('one two three four five six', 10)
    expect(out).toBe('one two th')
    expect(out).not.toMatch(/\s$/)
  })

  it('handles pure heading content', () => {
    expect(plainExcerpt('# Only a title\n\n## Only an h2', 80)).toBe('')
  })
})
