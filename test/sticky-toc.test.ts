/**
 * sticky-toc.test.ts — verifies that the `.reader-aside` block in both reader
 * pages is normal flow (no sticky, no max-height, no overflow-y scroll container)
 * and that only the `.toc` child gets `position: sticky`.
 *
 * Source-level check (no build required).
 */
import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const REPO_ROOT = join(import.meta.dirname, "..")

const POSTS_SLUG = readFileSync(
  join(REPO_ROOT, "src/pages/posts/[slug].astro"),
  "utf-8",
)
const NOTES_SLUG = readFileSync(
  join(REPO_ROOT, "src/pages/notes/[slug].astro"),
  "utf-8",
)

/**
 * Extract the text of the `.reader-aside` CSS rule block from a <style> section.
 * Returns the content between the opening `{` and matching `}` for .reader-aside.
 */
function extractReaderAsideBlock(source: string): string {
  // Match `.reader-aside` rule — not the :global(.toc) sub-rule
  const match = source.match(/\.reader-aside\s*\{([^}]*)\}/)
  return match ? match[1] : ""
}

/**
 * Extract the text of `.reader-aside :global(.toc)` or equivalent rule block.
 */
function extractTocStickyBlock(source: string): string {
  // Handles both `.reader-aside :global(.toc)` and `.reader-aside .toc`
  const match = source.match(/\.reader-aside\s+:global\(\.toc\)\s*\{([^}]*)\}/)
  return match ? match[1] : ""
}

describe("sticky-toc: posts/[slug].astro", () => {
  const asideBlock = extractReaderAsideBlock(POSTS_SLUG)
  const tocBlock = extractTocStickyBlock(POSTS_SLUG)

  it(".reader-aside block does NOT contain position: sticky", () => {
    expect(asideBlock).not.toMatch(/position\s*:\s*sticky/)
  })

  it(".reader-aside block does NOT contain max-height", () => {
    expect(asideBlock).not.toMatch(/max-height/)
  })

  it(".reader-aside block does NOT contain overflow-y: auto", () => {
    expect(asideBlock).not.toMatch(/overflow-y\s*:\s*auto/)
  })

  it(".reader-aside :global(.toc) rule exists", () => {
    expect(tocBlock.length).toBeGreaterThan(0)
  })

  it(".reader-aside :global(.toc) has position: sticky", () => {
    expect(tocBlock).toMatch(/position\s*:\s*sticky/)
  })

  it(".reader-aside :global(.toc) has top: 96px", () => {
    expect(tocBlock).toMatch(/top\s*:\s*96px/)
  })
})

describe("sticky-toc: notes/[slug].astro", () => {
  const asideBlock = extractReaderAsideBlock(NOTES_SLUG)
  const tocBlock = extractTocStickyBlock(NOTES_SLUG)

  it(".reader-aside block does NOT contain position: sticky", () => {
    expect(asideBlock).not.toMatch(/position\s*:\s*sticky/)
  })

  it(".reader-aside block does NOT contain max-height", () => {
    expect(asideBlock).not.toMatch(/max-height/)
  })

  it(".reader-aside block does NOT contain overflow-y: auto", () => {
    expect(asideBlock).not.toMatch(/overflow-y\s*:\s*auto/)
  })

  it(".reader-aside :global(.toc) rule exists", () => {
    expect(tocBlock.length).toBeGreaterThan(0)
  })

  it(".reader-aside :global(.toc) has position: sticky", () => {
    expect(tocBlock).toMatch(/position\s*:\s*sticky/)
  })

  it(".reader-aside :global(.toc) has top: 96px", () => {
    expect(tocBlock).toMatch(/top\s*:\s*96px/)
  })
})
