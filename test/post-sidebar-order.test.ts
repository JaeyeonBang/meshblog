/**
 * post-sidebar-order.test.ts — verifies that PostSidebar.astro renders its
 * sections in the canonical order: Related-graph → Categories → Tags → TOC.
 *
 * Source-level check (no build required) — reads the .astro file as text and
 * asserts on character offsets / regex match order.
 */
import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const REPO_ROOT = join(import.meta.dirname, "..")
const POST_SIDEBAR = readFileSync(
  join(REPO_ROOT, "src/components/ui/molecules/PostSidebar.astro"),
  "utf-8",
)

describe("PostSidebar: canonical section order (Related → Categories → Tags → TOC)", () => {
  it('docstring lists Related-graph as item 1', () => {
    expect(POST_SIDEBAR).toMatch(/1\.\s+Related-graph/)
  })

  it('docstring lists Categories as item 2', () => {
    expect(POST_SIDEBAR).toMatch(/2\.\s+Categories/)
  })

  it('docstring lists Tags as item 3', () => {
    expect(POST_SIDEBAR).toMatch(/3\.\s+Tags/)
  })

  it('docstring lists Contents (TOC) as item 4', () => {
    expect(POST_SIDEBAR).toMatch(/4\.\s+Contents/)
  })

  it('Related-mesh section appears before Categories section in source', () => {
    const relatedPos = POST_SIDEBAR.indexOf('aria-label="related mesh"')
    const categoriesPos = POST_SIDEBAR.indexOf('aria-label="categories"')
    expect(relatedPos).toBeGreaterThan(-1)
    expect(categoriesPos).toBeGreaterThan(-1)
    expect(relatedPos).toBeLessThan(categoriesPos)
  })

  it('Categories section appears before Tags section in source', () => {
    const categoriesPos = POST_SIDEBAR.indexOf('aria-label="categories"')
    const tagsPos = POST_SIDEBAR.indexOf('aria-label="tags"')
    expect(categoriesPos).toBeGreaterThan(-1)
    expect(tagsPos).toBeGreaterThan(-1)
    expect(categoriesPos).toBeLessThan(tagsPos)
  })

  it('Tags section appears before TOC in source', () => {
    const tagsPos = POST_SIDEBAR.indexOf('aria-label="tags"')
    // TOC is rendered via <TOC label="contents" .../>
    const tocPos = POST_SIDEBAR.indexOf('<TOC label="contents"')
    expect(tagsPos).toBeGreaterThan(-1)
    expect(tocPos).toBeGreaterThan(-1)
    expect(tagsPos).toBeLessThan(tocPos)
  })

  it('TOC line appears after all three sidebar sections', () => {
    const relatedPos = POST_SIDEBAR.indexOf('aria-label="related mesh"')
    const categoriesPos = POST_SIDEBAR.indexOf('aria-label="categories"')
    const tagsPos = POST_SIDEBAR.indexOf('aria-label="tags"')
    const tocPos = POST_SIDEBAR.indexOf('<TOC label="contents"')
    expect(tocPos).toBeGreaterThan(relatedPos)
    expect(tocPos).toBeGreaterThan(categoriesPos)
    expect(tocPos).toBeGreaterThan(tagsPos)
  })
})
