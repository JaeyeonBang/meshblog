import { describe, it, expect } from 'vitest'
import { listTopTags } from '../src/lib/pages/posts'
import type { PostRow } from '../src/lib/pages/posts'

/** Minimal PostRow factory — only `tags` matters for listTopTags */
function makePost(tags: string[]): PostRow {
  return {
    id: 'test',
    slug: 'test',
    title: 'Test',
    content: '',
    tags,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    level_pin: null,
    category_slug: null,
    has_en: 0,
    body_en: null,
    title_en: null,
  }
}

describe('listTopTags', () => {
  it('returns [] for empty posts array', () => {
    expect(listTopTags([])).toEqual([])
  })

  it('returns [] when posts have no tags', () => {
    const posts = [makePost([]), makePost([]), makePost([])]
    expect(listTopTags(posts)).toEqual([])
  })

  it('collapses duplicate tags with different casing (AI, ai, " ai " → count=3)', () => {
    const posts = [makePost(['AI']), makePost(['ai']), makePost([' ai '])]
    const result = listTopTags(posts)
    expect(result).toHaveLength(1)
    expect(result[0].count).toBe(3)
    // display tag should be one of the original casings (most common wins)
    expect(result[0].tag.trim().toLowerCase()).toBe('ai')
  })

  it('sorts by count desc', () => {
    const posts = [
      makePost(['apple']),
      makePost(['banana', 'apple']),
      makePost(['banana', 'apple', 'cherry']),
    ]
    const result = listTopTags(posts)
    // apple: 3, banana: 2, cherry: 1
    expect(result[0].tag).toBe('apple')
    expect(result[0].count).toBe(3)
    expect(result[1].tag).toBe('banana')
    expect(result[1].count).toBe(2)
    expect(result[2].tag).toBe('cherry')
    expect(result[2].count).toBe(1)
  })

  it('breaks ties alphabetically', () => {
    // alpha and zeta both appear once
    const posts = [makePost(['zeta', 'alpha'])]
    const result = listTopTags(posts)
    // both count=1, alphabetical: alpha before zeta
    expect(result[0].tag.toLowerCase()).toBe('alpha')
    expect(result[1].tag.toLowerCase()).toBe('zeta')
  })

  it('respects the limit parameter', () => {
    // 5 distinct tags
    const posts = [makePost(['a', 'b', 'c', 'd', 'e'])]
    const result = listTopTags(posts, 3)
    expect(result).toHaveLength(3)
  })

  it('default limit is 16', () => {
    // 20 distinct tags
    const tags = Array.from({ length: 20 }, (_, i) => `tag${i}`)
    const posts = [makePost(tags)]
    const result = listTopTags(posts)
    expect(result).toHaveLength(16)
  })

  it('preserves the most-common original casing for display', () => {
    // "TypeScript" appears twice, "typescript" once → display should be "TypeScript"
    const posts = [
      makePost(['TypeScript']),
      makePost(['TypeScript']),
      makePost(['typescript']),
    ]
    const result = listTopTags(posts)
    expect(result).toHaveLength(1)
    expect(result[0].tag).toBe('TypeScript')
    expect(result[0].count).toBe(3)
  })
})
