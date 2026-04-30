import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

const src = readFileSync(join(__dirname, '../T.astro'), 'utf8')

describe('T.astro — bilingual text helper', () => {
  it('emits .t-ko element with lang="ko"', () => {
    // The component must emit a class="t-ko" element
    expect(src).toMatch(/class="t-ko"/)
    expect(src).toMatch(/lang="ko"/)
  })

  it('emits .t-en element with lang="en"', () => {
    expect(src).toMatch(/class="t-en"/)
    expect(src).toMatch(/lang="en"/)
  })

  it('accepts a configurable tag prop (default span)', () => {
    // The component must use the tag prop as the element name
    expect(src).toMatch(/const\s+Tag\s*=\s*tag\s+as\s+any/)
    // Default value must be 'span'
    expect(src).toMatch(/tag\s*=\s*['"]span['"]/)
  })

  it('renders ko content inside .t-ko and en content inside .t-en', () => {
    // Ensure {ko} and {en} expressions appear adjacent to the class attrs
    expect(src).toMatch(/class="t-ko"[^>]*>{ko}</)
    expect(src).toMatch(/class="t-en"[^>]*>{en}</)
  })

  it('documents the wrap convention', () => {
    // The file must contain the convention comment
    expect(src).toMatch(/Do NOT wrap/)
    expect(src).toMatch(/language-neutral/)
  })
})
