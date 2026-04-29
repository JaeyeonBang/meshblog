/**
 * post-overhaul.test.ts — integration tests for the post page redesign
 * shipped in PRs #58 + #64:
 *
 *   - Dark-mode-safe code blocks (paper-2 / ink / rule-soft, not invert)
 *   - Hero SVG per post (12 files in public/og/posts/, frontmatter image:)
 *   - PostSidebar molecule with 5 canonical categories always present
 *   - Home graph unified to PostMeshGraph (was MiniMesh)
 *   - Tokens define paper-2 / ink / rule-soft in both light + dark
 *
 * Source-level checks (not dist) so they stay deterministic without OPENAI
 * keys and survive future content drift. Live verification belongs in CI's
 * post-deploy curl probes.
 */
import { describe, it, expect } from "vitest"
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

const REPO_ROOT = join(import.meta.dirname, "..")

const ARTICLE_CSS = readFileSync(join(REPO_ROOT, "src/styles/article.css"), "utf-8")
const TOKENS_CSS = readFileSync(join(REPO_ROOT, "src/styles/tokens.css"), "utf-8")
const SLUG_PAGE = readFileSync(join(REPO_ROOT, "src/pages/posts/[slug].astro"), "utf-8")
const INDEX_PAGE = readFileSync(join(REPO_ROOT, "src/pages/index.astro"), "utf-8")
const POST_SIDEBAR = readFileSync(
  join(REPO_ROOT, "src/components/ui/molecules/PostSidebar.astro"),
  "utf-8",
)

// ── #1 Dark-mode-safe code blocks ────────────────────────────────────────────
describe("post-overhaul: dark-mode code blocks", () => {
  it("`.prose pre` uses paper-2 background (tracks page tone in both modes)", () => {
    const proseRule = ARTICLE_CSS.match(/\.prose pre\s*\{[\s\S]*?\}/)?.[0] ?? ""
    expect(proseRule).toContain("background: var(--paper-2)")
  })

  it("`.prose pre` text color is var(--ink) (auto-inverts with theme)", () => {
    const proseRule = ARTICLE_CSS.match(/\.prose pre\s*\{[\s\S]*?\}/)?.[0] ?? ""
    expect(proseRule).toContain("color: var(--ink)")
  })

  it("`.prose pre` border is hairline rule-soft (not solid ink)", () => {
    const proseRule = ARTICLE_CSS.match(/\.prose pre\s*\{[\s\S]*?\}/)?.[0] ?? ""
    expect(proseRule).toMatch(/border:\s*1px solid var\(--rule-soft\)/)
  })

  it("`.prose pre` does NOT use the old invert-trap (background: var(--ink))", () => {
    const proseRule = ARTICLE_CSS.match(/\.prose pre\s*\{[\s\S]*?\}/)?.[0] ?? ""
    expect(proseRule).not.toMatch(/background:\s*var\(--ink\)\s*[;}]/)
  })

  it("tokens.css defines --paper-2 in both :root and dark mode", () => {
    const lightBlock = TOKENS_CSS.match(/^:root\s*\{[\s\S]*?\}/m)?.[0] ?? ""
    expect(lightBlock).toMatch(/--paper-2:\s*oklch\(/)
    const darkBlock = TOKENS_CSS.match(/\[data-theme="dark"\][\s\S]*?\}/)?.[0] ?? ""
    expect(darkBlock).toMatch(/--paper-2:\s*oklch\(/)
  })
})

// ── #2 Hero SVG per post ────────────────────────────────────────────────────
describe("post-overhaul: hero SVG", () => {
  const HERO_DIR = join(REPO_ROOT, "public/og/posts")

  it("public/og/posts/ contains at least 12 SVG hero files", () => {
    expect(existsSync(HERO_DIR)).toBe(true)
    const svgs = readdirSync(HERO_DIR).filter((f) => f.endsWith(".svg"))
    expect(svgs.length).toBeGreaterThanOrEqual(12)
  })

  it("each SVG is non-empty and declares 16:7 viewBox or aspect-ratio shape", () => {
    const svgs = readdirSync(HERO_DIR).filter((f) => f.endsWith(".svg"))
    for (const f of svgs) {
      const content = readFileSync(join(HERO_DIR, f), "utf-8")
      expect(content.length).toBeGreaterThan(200)
      expect(content).toMatch(/viewBox=["']0 0 1600 700["']/)
    }
  })

  it("posts/[slug].astro passes withBase('/og/posts/<slug>.svg') to HeroFigure", () => {
    expect(SLUG_PAGE).toMatch(/<HeroFigure[\s\S]*?src=\{withBase\(`\/og\/posts\/\$\{post\.slug\}\.svg`\)\}/)
  })

  it("each content/posts markdown has a frontmatter image: field", () => {
    const POSTS_DIR = join(REPO_ROOT, "content/posts")
    if (!existsSync(POSTS_DIR)) return
    const mds = readdirSync(POSTS_DIR).filter((f) => f.endsWith(".md"))
    for (const f of mds) {
      const fm = readFileSync(join(POSTS_DIR, f), "utf-8").split("---")[1] ?? ""
      expect(fm).toMatch(/^image:\s*["']?\/meshblog\/og\/posts\//m)
    }
  })
})

// ── #3 PostSidebar molecule ─────────────────────────────────────────────────
describe("post-overhaul: PostSidebar molecule", () => {
  it("PostSidebar.astro exists", () => {
    expect(existsSync(join(REPO_ROOT, "src/components/ui/molecules/PostSidebar.astro"))).toBe(true)
  })

  it("posts/[slug].astro imports + renders PostSidebar", () => {
    expect(SLUG_PAGE).toContain("PostSidebar.astro")
    expect(SLUG_PAGE).toMatch(/<PostSidebar\b/)
  })

  it("PostSidebar declares all 5 canonical categories as fallback", () => {
    const slugs = ["engineering", "ai", "writing", "design", "personal"]
    for (const s of slugs) {
      expect(POST_SIDEBAR).toMatch(new RegExp(`slug:\\s*['"]${s}['"]`))
    }
  })

  it("PostSidebar merges DB categories with fallback (always 5)", () => {
    expect(POST_SIDEBAR).toMatch(/dbBySlug\.get\(fb\.slug\)\s*\?\?\s*fb/)
  })

  it("PostSidebar renders 4 sections: categories · tags · related · TOC", () => {
    expect(POST_SIDEBAR).toMatch(/aria-label=["']categories["']/)
    expect(POST_SIDEBAR).toMatch(/aria-label=["']tags["']/)
    expect(POST_SIDEBAR.toLowerCase()).toMatch(/related|mesh/)
    expect(POST_SIDEBAR).toMatch(/TOC\b|toc\b/i)
  })

  it("category links use withBase + go to /categories/<slug>/", () => {
    expect(POST_SIDEBAR).toMatch(/withBase\(`\/categories\/\$\{[^}]+\}\/`\)/)
  })
})

// ── #4 Home graph unified ───────────────────────────────────────────────────
describe("post-overhaul: home graph unified to PostMeshGraph", () => {
  it("index.astro imports PostMeshGraph (not MiniMesh)", () => {
    expect(INDEX_PAGE).toMatch(/import\s+PostMeshGraph\s+from\s+['"][^'"]*PostMeshGraph['"]/)
    expect(INDEX_PAGE).not.toMatch(/import\s+MiniMesh\s+from/)
  })

  it("index.astro renders <PostMeshGraph> with nodes + links props", () => {
    expect(INDEX_PAGE).toMatch(/<PostMeshGraph[^>]*\bnodes=\{/)
    expect(INDEX_PAGE).toMatch(/<PostMeshGraph[^>]*\blinks=\{/)
  })

  it("home graph hydrates (client:idle | client:visible | client:load)", () => {
    expect(INDEX_PAGE).toMatch(/<PostMeshGraph[\s\S]*?client:(idle|visible|load)/)
  })
})

// ── #5 Editorial invariants on new files ────────────────────────────────────
describe("post-overhaul: editorial invariants", () => {
  it("PostSidebar.astro has no hex literals (token-only colors)", () => {
    // strip CSS comment lines so #-in-words don't trip the check
    const stripped = POST_SIDEBAR.replace(/\/\*[\s\S]*?\*\//g, "")
    const inStyle = stripped.match(/<style>[\s\S]*?<\/style>/)?.[0] ?? ""
    expect(inStyle).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it(".prose pre uses tokens for color (no hex)", () => {
    const proseRule = ARTICLE_CSS.match(/\.prose pre\s*\{[\s\S]*?\}/)?.[0] ?? ""
    expect(proseRule).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it("hero SVGs may use hex (assets, not src/) — sanity bound: only 1 file count", () => {
    // hero SVGs live in public/og/posts/, not src/ — so hex literals here are fine.
    // This test pins the boundary: the editorial invariant applies to src/, not assets.
    const HERO_DIR = join(REPO_ROOT, "public/og/posts")
    const svgs = readdirSync(HERO_DIR).filter((f) => f.endsWith(".svg"))
    const sample = readFileSync(join(HERO_DIR, svgs[0]), "utf-8")
    // hex IS allowed in SVG assets; just verify SVG is well-formed
    expect(sample).toContain("</svg>")
  })
})

// ── tag-filter encoding (regression: control char stripped by minifier) ─────
//
// PR #72 joined tags with a literal U+001F byte in source. Vite/esbuild
// stripped that control character during minify, so the shipped JS became
// `split("")` (split-by-empty-string) and chip clicks did nothing on the live
// site. The fix (PR #76) stores the separator as a JS unicode escape sequence
// `''` so the minifier preserves it. These regressions pin BOTH ends:
// the source must use the escape (no raw control byte) AND the join/split
// pair must agree.
describe("post-overhaul: tag-filter data-tags separator", () => {
  const POSTCARD_BYTES = readFileSync(
    join(REPO_ROOT, "src/components/ui/molecules/PostCard.astro"),
  )
  const POSTS_INDEX_BYTES = readFileSync(
    join(REPO_ROOT, "src/pages/posts/index.astro"),
  )
  const POSTCARD = POSTCARD_BYTES.toString("utf-8")
  const POSTS_INDEX = POSTS_INDEX_BYTES.toString("utf-8")

  it("PostCard joins tags via the \\u001F escape sequence (not a raw control byte)", () => {
    expect(POSTCARD).toMatch(/tags\.join\(['"]\\u001F['"]\)/)
  })

  it("posts/index.astro splits data-tags on the same \\u001F escape", () => {
    expect(POSTS_INDEX).toMatch(/getAttribute\(['"]data-tags['"]\)[^)]*\)\.split\(['"]\\u001F['"]\)/)
  })

  it("neither file contains a raw C0 control byte that the minifier would strip", () => {
    // Any unescaped 0x00-0x1F (except common whitespace 0x09/0x0A/0x0D) inside the
    // source means we're back to the original bug. The escape sequence above is
    // text — six chars, none of them control bytes — so this stays clean.
    const offenders = (buf: Buffer) =>
      Array.from(buf).filter(
        (b) => b <= 0x1f && b !== 0x09 && b !== 0x0a && b !== 0x0d,
      )
    expect(offenders(POSTCARD_BYTES)).toEqual([])
    expect(offenders(POSTS_INDEX_BYTES)).toEqual([])
  })
})
