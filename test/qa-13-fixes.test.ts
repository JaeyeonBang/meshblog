/**
 * qa-13-fixes.test.ts — source-level regression tests for the 13 polish fixes
 * the user shipped between PR #72 and PR #80.
 *
 * Each user-numbered item gets its own describe block. Failures here mean the
 * shipped fix has been reverted or never landed.
 *
 * Source-level (not dist) so they stay deterministic with no API keys.
 */
import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const ROOT = join(import.meta.dirname, "..")
const read = (p: string) => readFileSync(join(ROOT, p), "utf-8")

const TOKENS_CSS = read("src/styles/tokens.css")
const POSTS_INDEX = read("src/pages/posts/index.astro")
const POST_SLUG = read("src/pages/posts/[slug].astro")
const HOME_PAGE = read("src/pages/index.astro")
const TOP_BAR = read("src/components/ui/organisms/TopBar.astro")
const FOOTER = read("src/components/ui/organisms/Footer.astro")
const GRAPH_VIEW = read("src/components/GraphView.tsx")
const GRAPH_CSS = read("src/components/GraphView.module.css")
const POST_MESH_CSS = read("src/components/PostMeshGraph.module.css")
const POST_SIDEBAR = read("src/components/ui/molecules/PostSidebar.astro")

// ── #1 · /posts tag-filter from query string ───────────────────────────────
describe("#1 tag-filter on /posts", () => {
  it("posts/index.astro renders a filter chip placeholder + clear button", () => {
    expect(POSTS_INDEX).toMatch(/data-filter-bar/)
    expect(POSTS_INDEX).toMatch(/data-filter-tag/)
    expect(POSTS_INDEX).toMatch(/data-filter-clear/)
  })

  it("inline script reads ?tag= from URL and filters cards by data-tags", () => {
    expect(POSTS_INDEX).toMatch(/URLSearchParams\(window\.location\.search\)/)
    expect(POSTS_INDEX).toMatch(/'data-tags'|"data-tags"/)
  })

  it("PostCard joins tags with U+001F so embedded punctuation cannot mis-split", () => {
    const card = read("src/components/ui/molecules/PostCard.astro")
    expect(card).toMatch(/tags\.join\(['"`]\\u001F/)
  })
})

// ── #2 · English serif paired with Pretendard ──────────────────────────────
describe("#2 typography pairs Source Serif 4 + Pretendard", () => {
  it("--f-disp / --f-serif both lead with Source Serif 4", () => {
    expect(TOKENS_CSS).toMatch(/--f-disp:\s*['"]Source Serif 4['"]/)
    expect(TOKENS_CSS).toMatch(/--f-serif:\s*['"]Source Serif 4['"]/)
  })

  it("--f-sans falls back through Pretendard before system fonts", () => {
    expect(TOKENS_CSS).toMatch(/--f-sans:\s*['"]Pretendard['"]/)
  })
})

// ── #3 · Zoom +/-/reset buttons on /graph ──────────────────────────────────
describe("#3 graph zoom controls", () => {
  it("GraphView wires three buttons to ZoomController.zoomIn/zoomOut/reset", () => {
    expect(GRAPH_VIEW).toMatch(/zoomCtrl\?\.zoomIn\(\)/)
    expect(GRAPH_VIEW).toMatch(/zoomCtrl\?\.zoomOut\(\)/)
    expect(GRAPH_VIEW).toMatch(/zoomCtrl\?\.reset\(\)/)
  })

  it("zoom buttons announce themselves via aria-label", () => {
    expect(GRAPH_VIEW).toMatch(/aria-label="Zoom in"/)
    expect(GRAPH_VIEW).toMatch(/aria-label="Zoom out"/)
    expect(GRAPH_VIEW).toMatch(/aria-label="Reset zoom"/)
  })
})

// ── #4 · Edge contrast ─────────────────────────────────────────────────────
describe("#4 graph edge visibility", () => {
  it(".links line uses ink-3 stroke at ≥ 0.7 opacity", () => {
    const linkRule = GRAPH_CSS.match(/\.svg :global\(\.links line\)\s*\{[^}]+\}/)?.[0] ?? ""
    expect(linkRule).toMatch(/stroke:\s*var\(--ink-3\)/)
    const opacity = Number(linkRule.match(/stroke-opacity:\s*([\d.]+)/)?.[1] ?? 0)
    expect(opacity).toBeGreaterThanOrEqual(0.7)
  })

  it("active edge state pops to var(--ink) full opacity", () => {
    expect(GRAPH_CSS).toMatch(/edge--active[\s\S]*stroke:\s*var\(--ink\)[\s\S]*stroke-opacity:\s*1/)
  })
})

// ── #5 · /graph defaults to L3 on first visit ──────────────────────────────
describe("#5 default level is L3 when no params", () => {
  it("getInitialState returns level=3 when neither ?mode nor ?level is present", () => {
    expect(GRAPH_VIEW).toMatch(/Fresh load[\s\S]*level\s*=\s*3/)
  })
})

// ── #6 · Legend lists category colors in graph bottom-right ───────────────
describe("#6 graph legend", () => {
  it("GraphView imports + renders <Legend> with derived legendCategories", () => {
    expect(GRAPH_VIEW).toMatch(/import\s*\{\s*Legend\s*\}/)
    expect(GRAPH_VIEW).toMatch(/<Legend\s+categories=\{legendCategories\}/)
  })

  it("Legend panel is positioned bottom-right", () => {
    const legendCss = read("src/components/graph/Legend.module.css")
    expect(legendCss).toMatch(/position:\s*absolute/)
    expect(legendCss).toMatch(/bottom:\s*var\(--space/)
    expect(legendCss).toMatch(/right:\s*var\(--space/)
  })
})

// ── #7 · Two graphs in the post sidebar ────────────────────────────────────
describe("#7 post page has related-mesh + concept-graph", () => {
  it("PostSidebar mounts PostMeshGraph (related)", () => {
    expect(POST_SIDEBAR).toMatch(/<PostMeshGraph[\s\S]*nodes=\{meshNodes\}/)
  })

  it("PostSidebar mounts PostConceptGraph (concept) under conceptGraph guard", () => {
    expect(POST_SIDEBAR).toMatch(/<PostConceptGraph[\s\S]*nodes=\{conceptGraph.nodes\}/)
    // Require at least 2 nodes so single-concept posts don't render a degenerate
    // "1 concepts · 0 links" widget (caught during /qa-13-fixes review).
    expect(POST_SIDEBAR).toMatch(/conceptGraph\.nodes\.length\s*>\s*1/)
  })

  it("concept graph section is sticky-bottom (sticky-concept-section)", () => {
    expect(POST_SIDEBAR).toMatch(/sticky-concept-section[\s\S]*position:\s*sticky/)
  })

  it("PostConceptGraph component supports compact + expanded modes", () => {
    const cg = read("src/components/PostConceptGraph.tsx")
    expect(cg).toMatch(/COMPACT_MODE/)
    expect(cg).toMatch(/EXPANDED_MODE/)
    expect(cg).toMatch(/setIsExpanded\(true\)/)
  })
})

// ── #8 · Related-link unification (mesh node + grid both → /posts) ────────
describe("#8 related links resolve to canonical folder via manifest", () => {
  it("mesh-data resolveNeighborHref consults notes-manifest.json", () => {
    const meshLib = read("src/lib/mesh-data.ts")
    expect(meshLib).toMatch(/notes-manifest\.json/)
    expect(meshLib).toMatch(/resolveNeighborHref/)
  })

  it("posts/[slug].astro derives related-grid kind from manifest folder", () => {
    expect(POST_SLUG).toMatch(/manifest\[r\.id\]\?\.folder/)
    expect(POST_SLUG).toMatch(/folder === ['"]posts['"]\s*\?\s*['"]post['"]\s*:\s*['"]note['"]/)
  })

  it("related-grid items render the kind badge per item (P or N)", () => {
    expect(POST_SLUG).toMatch(/kind === ['"]post['"]\s*\?\s*['"]P['"]\s*:\s*['"]N['"]/)
  })
})

// ── #9 · Categories list does not advertise dead taxonomies ────────────────
// Live: only "AI" exists. Sidebar should NOT show engineering/writing/design/
// personal as clickable rows, since they 404 on GitHub Pages.
describe("#9 PostSidebar only links to real categories", () => {
  it("sidebar does NOT hardcode a 5-item fallback that includes empty taxonomies", () => {
    // The current code holds a FALLBACK_CATEGORIES list. Once #9 is done it
    // should be gone, replaced with a filter on (noteCount + postCount) > 0.
    const hasHardFallback = /FALLBACK_CATEGORIES\s*[:=]\s*\[/.test(POST_SIDEBAR)
    expect(hasHardFallback, "PostSidebar still hard-codes 5 fallback categories — drop the unused four").toBe(false)
  })

  it("sidebar filters to categories that have ≥ 1 note or post", () => {
    expect(POST_SIDEBAR).toMatch(/noteCount\s*\+\s*[\w.]*postCount\)\s*>\s*0/)
  })
})

// ── #10 · Hero font-size shrunk ────────────────────────────────────────────
describe("#10 hero font-size reduced", () => {
  it("--fs-hero clamp upper bound is ≤ 60px", () => {
    const m = TOKENS_CSS.match(/--fs-hero:\s*clamp\(\s*[\d.]+px,\s*[\d.]+vw,\s*([\d.]+)px/)
    expect(m).toBeTruthy()
    const max = Number(m![1])
    expect(max).toBeLessThanOrEqual(60)
  })

  it("home hero h1 uses var(--fs-hero), not a hand-rolled clamp", () => {
    const heroRule = HOME_PAGE.match(/\.home-hero\s+h1\s*\{[\s\S]*?\}/)?.[0] ?? ""
    expect(heroRule).toMatch(/font-size:\s*var\(--fs-hero\)/)
  })
})

// ── #11 · Search button has no kbd shortcut glyph ──────────────────────────
describe("#11 TopBar search button has no visible shortcut glyph", () => {
  it("the search button block contains the label but no kbd-flagged ⌘K", () => {
    // Slice from the search-button opening to its closing </button>.
    const searchBlock = TOP_BAR
      .match(/aria-label="Open search[\s\S]*?<\/button>/)?.[0] ?? ""
    expect(searchBlock, "search button not found").not.toBe("")
    expect(searchBlock).toMatch(/btn-search-label[^<]*search/)
    // No <span class="kbd">…</span> shortcut glyph inside the visible markup.
    expect(searchBlock).not.toMatch(/class="kbd"/)
  })

  it("⌘K stays in aria-label only (a11y) — not in visual markup", () => {
    expect(TOP_BAR).toMatch(/aria-label="Open search \(⌘K\)"/)
  })
})

// ── #12 · Footer cleanup ───────────────────────────────────────────────────
describe("#12 footer", () => {
  it("has 4 columns: brand · read · explore · about", () => {
    const cols = FOOTER.match(/<div class="footer-col">/g) ?? []
    expect(cols.length).toBe(4)
  })

  it("links go through withBase (no raw /posts /notes /graph)", () => {
    // Inside the footer block: every internal link must be withBase()
    expect(FOOTER).not.toMatch(/href="\/(posts|notes|graph|categories|about)"/)
  })

  it("external github link opens in new tab with rel=noopener", () => {
    expect(FOOTER).toMatch(/href="https:\/\/github\.com\/JaeyeonBang\/meshblog"\s+target="_blank"\s+rel="noopener"/)
  })
})

// ── #13 · Home graph stays inside its layout when zoomed ───────────────────
describe("#13 home graph does not bleed past its container", () => {
  it("PostMeshGraph .wrap clips overflow and pins aspect-ratio", () => {
    const wrapRule = POST_MESH_CSS.match(/\.wrap\s*\{[\s\S]*?\}/)?.[0] ?? ""
    expect(wrapRule).toMatch(/overflow:\s*hidden/)
    expect(wrapRule).toMatch(/aspect-ratio:\s*1\s*\/\s*1/)
  })
})

// ── Found by Claude · additional regressions ───────────────────────────────
describe("additional QA findings", () => {
  it("post sticky concept-graph hides when fewer than 2 nodes (avoid degenerate '1 concepts · 0 links')", () => {
    expect(POST_SIDEBAR).toMatch(/conceptGraph\.nodes\.length\s*>\s*1/)
  })

  it("posts/[slug].astro removes unused stripLeadingH1 import", () => {
    // Right now astro-check warns about it; once cleaned, this stays green.
    // Posts page still uses stripLeadingH1 inside renderMarkdownToHtml — so
    // the assertion is that the import IS used downstream.
    if (/stripLeadingH1/.test(POST_SLUG)) {
      expect(POST_SLUG).toMatch(/stripLeadingH1\(/)
    }
  })

  it("posts/index.astro drops the unused stripLeadingH1 import", () => {
    if (POSTS_INDEX.includes("import { stripLeadingH1 }")) {
      expect(POSTS_INDEX, "import is dead — drop it").toMatch(/stripLeadingH1\(/)
    }
  })

  it("categories/[slug].astro drops the unused stripLeadingH1 import", () => {
    const slug = read("src/pages/categories/[slug].astro")
    if (slug.includes("import { stripLeadingH1 }")) {
      expect(slug, "import is dead — drop it").toMatch(/stripLeadingH1\(/)
    }
  })
})
