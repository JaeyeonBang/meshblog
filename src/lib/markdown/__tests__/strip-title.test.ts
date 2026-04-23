import { describe, it, expect } from 'vitest'
import { stripLeadingH1 } from '../strip-title'

describe('stripLeadingH1', () => {
  it('removes a leading # Title and the blank line after', () => {
    expect(stripLeadingH1('# My Post\n\nBody text.')).toBe('Body text.')
  })

  it('removes a leading # Title with no blank line', () => {
    expect(stripLeadingH1('# Title\nNext line.')).toBe('Next line.')
  })

  it('leaves ## H2 alone', () => {
    expect(stripLeadingH1('## Not the title\n\nBody.')).toBe('## Not the title\n\nBody.')
  })

  it('leaves text-first content alone', () => {
    expect(stripLeadingH1('Leading paragraph.\n\n# Mid-doc heading')).toBe('Leading paragraph.\n\n# Mid-doc heading')
  })

  it('leaves headings without the space after #', () => {
    expect(stripLeadingH1('#notAHeading\n\nBody.')).toBe('#notAHeading\n\nBody.')
  })

  it('is a no-op on empty string', () => {
    expect(stripLeadingH1('')).toBe('')
  })

  it('preserves content when there is no leading heading', () => {
    expect(stripLeadingH1('Just text.\nMore text.')).toBe('Just text.\nMore text.')
  })
})
