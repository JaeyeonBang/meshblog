/**
 * build-og.ts — Static OG card (1200×630 PNG) generator
 *
 * Reads posts + notes from DB, renders an SVG template per item,
 * converts to PNG via @resvg/resvg-js (native), writes to public/og/.
 *
 * ED6 safety: main() is wrapped in try/catch. If resvg fails on any item,
 * a 1×1 fallback placeholder PNG is written instead. The whole build
 * still exits 0 so the Astro build is never blocked.
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { Resvg } from '@resvg/resvg-js'
import { listPosts } from '../src/lib/pages/posts'
import { listNotes } from '../src/lib/pages/notes'

// ── PNG magic-bytes fallback (1×1 transparent PNG) ──────────────────────────
// Generated once; reused on resvg failure per item.
const PLACEHOLDER_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
)

// ── XML escape helpers ───────────────────────────────────────────────────────
function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function truncate(s: string, max = 60): string {
  if (s.length <= max) return s
  return s.slice(0, max - 1) + '…'
}

// ── SVG template ─────────────────────────────────────────────────────────────
function buildSvg(title: string): string {
  const safeTitle = xmlEscape(truncate(title))
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="#ffffff"/>
  <rect width="1200" height="8" y="622" fill="#3b82f6"/>
  <text x="60" y="120" font-family="sans-serif" font-size="64" font-weight="700" fill="#111">${safeTitle}</text>
  <text x="60" y="580" font-family="sans-serif" font-size="24" fill="#666">meshblog</text>
</svg>`
}

// ── SVG → PNG conversion ──────────────────────────────────────────────────────
function svgToPng(svg: string): Buffer {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1200 },
  })
  return Buffer.from(resvg.render().asPng())
}

function writePng(outPath: string, svg: string): void {
  let png: Buffer
  try {
    png = svgToPng(svg)
  } catch (err) {
    console.warn(`[build-og] resvg failed for ${outPath}, writing placeholder:`, err)
    png = PLACEHOLDER_PNG
  }
  writeFileSync(outPath, png)
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  mkdirSync('public/og/posts', { recursive: true })
  mkdirSync('public/og/notes', { recursive: true })

  // Homepage card
  const homeSvg = buildSvg('meshblog')
  writePng('public/og/index.png', homeSvg)
  console.log('[build-og] wrote public/og/index.png')

  // Posts
  const posts = listPosts()
  for (const post of posts) {
    const svg = buildSvg(post.title)
    const outPath = join('public/og/posts', `${encodeURIComponent(post.slug)}.png`)
    writePng(outPath, svg)
  }
  console.log(`[build-og] wrote ${posts.length} post OG images`)

  // Notes
  const notes = listNotes()
  for (const note of notes) {
    const svg = buildSvg(note.title)
    const outPath = join('public/og/notes', `${encodeURIComponent(note.slug)}.png`)
    writePng(outPath, svg)
  }
  console.log(`[build-og] wrote ${notes.length} note OG images`)

  console.log('[build-og] done')
}

main().catch((err) => {
  console.warn('[build-og] unexpected error (non-fatal):', err)
  // ED6: never block the build
  process.exit(0)
})
