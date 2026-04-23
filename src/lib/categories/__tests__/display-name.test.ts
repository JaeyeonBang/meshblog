import { describe, it, expect } from 'vitest'
import { formatCategoryName } from '../display-name'

describe('formatCategoryName', () => {
  it('uppercases known acronym slugs', () => {
    expect(formatCategoryName('ai', 'Ai')).toBe('AI')
    expect(formatCategoryName('api', 'Api')).toBe('API')
    expect(formatCategoryName('ui', 'Ui')).toBe('UI')
  })

  it('falls back to the raw name for non-acronym slugs', () => {
    expect(formatCategoryName('engineering', 'Engineering')).toBe('Engineering')
    expect(formatCategoryName('writing', 'Writing')).toBe('Writing')
  })

  it('is slug-case-insensitive', () => {
    expect(formatCategoryName('AI', 'Ai')).toBe('AI')
  })

  it('returns raw name when slug is unknown', () => {
    expect(formatCategoryName('unknown-slug', 'Unknown Slug')).toBe('Unknown Slug')
  })
})
