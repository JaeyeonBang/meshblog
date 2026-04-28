/**
 * posts-index-sidebar.test.ts — Source-level integration tests for the
 * /posts index sidebar redesign (Stream A).
 *
 * Checks source files rather than dist so tests stay deterministic without
 * OPENAI_API_KEY and survive content drift. Live HTML checks belong in CI's
 * post-deploy curl probes.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const REPO_ROOT = join(import.meta.dirname, '..')

const POSTS_INDEX = readFileSync(join(REPO_ROOT, 'src/pages/posts/index.astro'), 'utf-8')
const TOPBAR = readFileSync(join(REPO_ROOT, 'src/components/ui/organisms/TopBar.astro'), 'utf-8')
const SIDEBAR = readFileSync(
  join(REPO_ROOT, 'src/components/ui/molecules/PostsIndexSidebar.astro'),
  'utf-8',
)

// ── TopBar: no "categories" nav link ────────────────────────────────────────
describe('TopBar cleanup', () => {
  it('TopBar links array does NOT contain a categories entry', () => {
    // The links array should not have key: 'categories'
    expect(TOPBAR).not.toMatch(/key:\s*['"]categories['"]/)
  })

  it('TopBar union type does NOT include "categories"', () => {
    // active prop union should not list 'categories'
    expect(TOPBAR).not.toMatch(/'categories'/)
  })

  it('TopBar still has posts, notes, graph, about', () => {
    expect(TOPBAR).toMatch(/key:\s*['"]posts['"]/)
    expect(TOPBAR).toMatch(/key:\s*['"]notes['"]/)
    expect(TOPBAR).toMatch(/key:\s*['"]graph['"]/)
    expect(TOPBAR).toMatch(/key:\s*['"]about['"]/)
  })
})

// ── /posts index: 2-column layout ───────────────────────────────────────────
describe('/posts index layout', () => {
  it('imports PostsIndexSidebar', () => {
    expect(POSTS_INDEX).toMatch(/import\s+PostsIndexSidebar\s+from/)
  })

  it('renders <aside class="reader-aside">', () => {
    expect(POSTS_INDEX).toMatch(/<aside[^>]*class="reader-aside"/)
  })

  it('grid uses 1fr + --w-reader-side columns', () => {
    expect(POSTS_INDEX).toMatch(/grid-template-columns:\s*1fr var\(--w-reader-side\)/)
  })

  it('mobile breakpoint 980px collapses to single column', () => {
    expect(POSTS_INDEX).toMatch(/@media\s*\(max-width:\s*980px\)/)
    // Inside that breakpoint, grid-template-columns should become 1fr
    const mobile980 = POSTS_INDEX.match(/@media\s*\(max-width:\s*980px\)[\s\S]*?\}/)?.[0] ?? ''
    expect(mobile980).toMatch(/grid-template-columns:\s*1fr/)
  })

  it('aside order:1 at 980px (post list stays first on mobile)', () => {
    // The 980px breakpoint contains nested rules; match the whole <style> block
    // then find the 980px section within it.
    const styleBlock = POSTS_INDEX.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? ''
    // Find the @media (max-width: 980px) block — may span multiple {} pairs
    const mediaStart = styleBlock.indexOf('@media (max-width: 980px)')
    expect(mediaStart).toBeGreaterThan(-1)
    const mediaSection = styleBlock.slice(mediaStart, styleBlock.indexOf('@media', mediaStart + 1))
    expect(mediaSection).toMatch(/order:\s*1/)
  })

  it('aside hidden at 779px (phone: post list IS the page)', () => {
    const mobile779 = POSTS_INDEX.match(
      /@media\s*\(max-width:\s*779px\)[\s\S]*?\{[\s\S]*?\}/
    )?.[0] ?? ''
    expect(mobile779).toMatch(/display:\s*none/)
  })

  it('passes posts array to PostsIndexSidebar', () => {
    expect(POSTS_INDEX).toMatch(/<PostsIndexSidebar[^/]*posts=\{posts\}/)
  })
})

// ── PostsIndexSidebar: correct 3-section structure ───────────────────────────
describe('PostsIndexSidebar molecule', () => {
  it('file exists', () => {
    expect(
      existsSync(join(REPO_ROOT, 'src/components/ui/molecules/PostsIndexSidebar.astro'))
    ).toBe(true)
  })

  it('imports CategoryList', () => {
    expect(SIDEBAR).toMatch(/import\s+CategoryList\s+from/)
  })

  it('renders CategoryList with limit={0} (show all, no active)', () => {
    expect(SIDEBAR).toMatch(/<CategoryList[^/]*limit=\{0\}/)
    // Should NOT pass an active prop
    expect(SIDEBAR).not.toMatch(/<CategoryList[^/]*active=/)
  })

  it('renders a tags section with section-label', () => {
    expect(SIDEBAR).toMatch(/class="section-label"[\s\S]*?tags|tags[\s\S]*?class="section-label"/)
    expect(SIDEBAR).toMatch(/class="sidebar-tag"/)
  })

  it('renders tag count after each tag', () => {
    expect(SIDEBAR).toMatch(/tag-count/)
  })

  it('renders PostMeshGraph for the related section', () => {
    expect(SIDEBAR).toMatch(/<PostMeshGraph[^>]*client:visible/)
  })

  it('renders mesh-cta link to /graph', () => {
    expect(SIDEBAR).toMatch(/class="mesh-cta"/)
    expect(SIDEBAR).toMatch(/withBase\(['"]\/graph['"]\)/)
  })

  it('section ORDER in source: categories → tags → related', () => {
    // Search within the template section only (after the closing ---)
    // to avoid matching import statements at the top
    const templateStart = SIDEBAR.lastIndexOf('---') + 3
    const template = SIDEBAR.slice(templateStart)
    const catPos = template.indexOf('<CategoryList')
    const tagsPos = template.indexOf('sidebar-tag')
    const relatedPos = template.indexOf('<PostMeshGraph')
    expect(catPos).toBeGreaterThan(-1)
    expect(tagsPos).toBeGreaterThan(-1)
    expect(relatedPos).toBeGreaterThan(-1)
    expect(catPos).toBeLessThan(tagsPos)
    expect(tagsPos).toBeLessThan(relatedPos)
  })

  it('has no hex literals in <style> (editorial invariant #1)', () => {
    const styleBlock = SIDEBAR.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? ''
    // strip CSS comments first
    const stripped = styleBlock.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(stripped).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it('sidebar-tag has hover-invert rule (editorial invariant #3)', () => {
    expect(SIDEBAR).toMatch(/\.sidebar-tag:hover\s*\{[\s\S]*?background:\s*var\(--ink\)/)
  })

  it('section-label uses var(--f-mono) and var(--track-eyebrow)', () => {
    const sectionLabelRule = SIDEBAR.match(/\.section-label\s*\{[\s\S]*?\}/)?.[0] ?? ''
    expect(sectionLabelRule).toContain('var(--f-mono)')
    expect(sectionLabelRule).toContain('var(--track-eyebrow)')
  })

  it('includes a docstring with canonical index order comment', () => {
    expect(SIDEBAR).toMatch(/aside-order-index|categories.*tags.*related|INDEX ORDER/i)
  })
})

// ── categories pages: topBarActive removed ──────────────────────────────────
describe('categories pages: no topBarActive="categories"', () => {
  it('categories/index.astro does not pass topBarActive="categories"', () => {
    const catIndex = readFileSync(join(REPO_ROOT, 'src/pages/categories/index.astro'), 'utf-8')
    expect(catIndex).not.toMatch(/topBarActive=["']categories["']/)
  })

  it('categories/[slug].astro does not pass topBarActive="categories"', () => {
    const catSlug = readFileSync(join(REPO_ROOT, 'src/pages/categories/[slug].astro'), 'utf-8')
    expect(catSlug).not.toMatch(/topBarActive=["']categories["']/)
  })
})
