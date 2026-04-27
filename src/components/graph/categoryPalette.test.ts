import { describe, it, expect } from 'vitest'
import { paletteIndexFor, paletteCssVarFor } from './categoryPalette'

describe('paletteIndexFor', () => {
  it('returns -1 for null', () => {
    expect(paletteIndexFor(null)).toBe(-1)
  })

  it('returns -1 for undefined', () => {
    expect(paletteIndexFor(undefined)).toBe(-1)
  })

  it('returns -1 for empty string', () => {
    expect(paletteIndexFor('')).toBe(-1)
  })

  it('returns -1 for "fallback"', () => {
    expect(paletteIndexFor('fallback')).toBe(-1)
  })

  it('returns index in 0..11 for any non-empty slug', () => {
    const slugs = ['nlp', 'rl', 'agent', 'fine-tuning', 'paper', 'ml',
                   'engineering', 'ai', 'writing', 'design', 'personal',
                   'cs', 'math', 'physics', 'biology', 'economics', 'art',
                   'music', 'film', 'cooking']
    for (const slug of slugs) {
      const idx = paletteIndexFor(slug)
      expect(idx).toBeGreaterThanOrEqual(0)
      expect(idx).toBeLessThan(12)
    }
  })

  it('is deterministic — same slug always maps to same index', () => {
    const testSlugs = ['nlp', 'rl', 'agent', 'fine-tuning', 'paper', 'ml']
    for (const slug of testSlugs) {
      const first = paletteIndexFor(slug)
      const second = paletteIndexFor(slug)
      const third = paletteIndexFor(slug)
      expect(first).toBe(second)
      expect(second).toBe(third)
    }
  })

  it('spreads 20 slugs across multiple buckets (distribution test)', () => {
    const slugs = [
      'nlp', 'rl', 'agent', 'fine-tuning', 'paper', 'ml',
      'engineering', 'ai', 'writing', 'design', 'personal',
      'cs', 'math', 'physics', 'biology', 'economics', 'art',
      'music', 'film', 'cooking',
    ]
    const buckets = new Set(slugs.map(s => paletteIndexFor(s)))
    // With 20 slugs and 12 buckets, expect at least 6 distinct buckets
    expect(buckets.size).toBeGreaterThanOrEqual(6)
  })

  it('production slugs that previously fell back to gray now get colors', () => {
    const productionSlugs = ['nlp', 'rl', 'agent', 'fine-tuning', 'paper', 'ml']
    for (const slug of productionSlugs) {
      expect(paletteIndexFor(slug)).not.toBe(-1)
    }
  })
})

describe('paletteCssVarFor', () => {
  it('returns var(--cat-fallback) for null', () => {
    expect(paletteCssVarFor(null)).toBe('var(--cat-fallback)')
  })

  it('returns var(--cat-fallback) for undefined', () => {
    expect(paletteCssVarFor(undefined)).toBe('var(--cat-fallback)')
  })

  it('returns var(--cat-fallback) for empty string', () => {
    expect(paletteCssVarFor('')).toBe('var(--cat-fallback)')
  })

  it('returns var(--cat-fallback) for "fallback"', () => {
    expect(paletteCssVarFor('fallback')).toBe('var(--cat-fallback)')
  })

  it('returns var(--cat-cN) for valid slug', () => {
    const result = paletteCssVarFor('nlp')
    expect(result).toMatch(/^var\(--cat-c\d+\)$/)
  })

  it('CSS var index matches paletteIndexFor result', () => {
    const slugs = ['nlp', 'rl', 'agent', 'fine-tuning']
    for (const slug of slugs) {
      const idx = paletteIndexFor(slug)
      expect(paletteCssVarFor(slug)).toBe(`var(--cat-c${idx})`)
    }
  })
})
