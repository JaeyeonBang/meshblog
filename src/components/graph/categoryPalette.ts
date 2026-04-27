/**
 * categoryPalette.ts
 *
 * Deterministic slug → palette index mapping.
 * Uses DJB2 hash to spread any slug across 12 OKLCH palette slots (cat-c0..cat-c11).
 *
 * Editorial invariants honoured:
 *   #1 — no hex literals; CSS vars reference tokens only.
 */

const PALETTE_SIZE = 12

/**
 * DJB2 hash: stable, deterministic, well-distributed for short strings.
 * Returns a non-negative integer.
 */
function djb2(str: string): number {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    // hash * 33 ^ char
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i)
    // Keep within 32-bit unsigned range
    hash = hash >>> 0
  }
  return hash
}

/**
 * Map a category slug to a palette index 0..11.
 * Null / empty / 'fallback' → returns -1 (caller should use --cat-fallback).
 */
export function paletteIndexFor(slug: string | null | undefined): number {
  if (!slug || slug === 'fallback') return -1
  return djb2(slug) % PALETTE_SIZE
}

/**
 * Map a category slug to the CSS custom property reference for its palette color.
 * Null / empty / 'fallback' → `var(--cat-fallback)`.
 */
export function paletteCssVarFor(slug: string | null | undefined): string {
  const idx = paletteIndexFor(slug)
  if (idx === -1) return 'var(--cat-fallback)'
  return `var(--cat-c${idx})`
}
