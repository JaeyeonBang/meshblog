/**
 * build-smoke.test.ts — Task 12: full-build artifact smoke test.
 *
 * Proves that a complete fixture build produces every artifact we claim to ship.
 * Runs in CI as a gate. No real API calls — FIXTURE_ONLY=1 skips all LLM steps.
 *
 * Build order (writes to public/ first, then astro copies to dist/):
 *   1. FIXTURE_ONLY=1 bun run build-index  — seed DB from test/fixtures/seed.sql
 *   2. bun run export-graph                — public/graph/*.json
 *   3. bun run build-manifest              — public/notes-manifest.json
 *   4. bun run build-og                    — public/og/index.png
 *   5. bun run build-rss                   — public/atom.xml
 *   6. bun astro build                     — dist/ (copies public/ + renders pages)
 */
import { describe, it, expect, beforeAll } from "vitest"
import { execSync } from "node:child_process"
import { existsSync, readFileSync, statSync, readdirSync } from "node:fs"
import { join } from "node:path"

const REPO_ROOT = join(import.meta.dirname, "..")
const DIST = join(REPO_ROOT, "dist")
// Isolate from live DB so developer's real content survives test runs
const TEST_DB = join(REPO_ROOT, ".data/test-smoke.db")

function run(cmd: string): void {
  execSync(cmd, {
    cwd: REPO_ROOT,
    env: { ...process.env, FIXTURE_ONLY: "1", MESHBLOG_DB: TEST_DB },
    encoding: "utf-8",
    stdio: "pipe",
  })
}

describe("build smoke", { timeout: 180_000 }, () => {
  beforeAll(() => {
    // Step 1: seed DB from fixtures (no LLM calls)
    run("FIXTURE_ONLY=1 bun run build-index")

    // Step 2: export graph JSON to public/graph/
    run("bun run export-graph")

    // Step 3: build notes-manifest.json to public/
    run("bun run build-manifest")

    // Step 4: build OG PNG to public/og/
    run("bun run build-og")

    // Step 5: build Atom feed to public/
    run("bun run build-rss")

    // Step 6: astro static build — copies public/ into dist/ and renders pages
    // Clear stale vite/prerender cache to avoid ERR_MODULE_NOT_FOUND from prior runs
    run("rm -rf dist node_modules/.vite")
    run("bun run build")
  }, 120_000)

  // ── dist/index.html ──────────────────────────────────────────────────────────

  it("dist/index.html exists", () => {
    expect(existsSync(join(DIST, "index.html"))).toBe(true)
  })

  it("dist/index.html renders a hero h1 and the meshblog wordmark", () => {
    const html = readFileSync(join(DIST, "index.html"), "utf-8")
    // Editorial redesign: the wordmark is a .logo span in TopBar, and the home
    // hero uses an h1 for site-specific intro copy. Require both to be present.
    expect(html).toMatch(/<h1\b[^>]*>[^<]+<\/h1>|<h1\b[^>]*>[\s\S]*?<\/h1>/)
    expect(html).toMatch(/class="[^"]*\blogo\b[^"]*"[^>]*>meshblog/)
  })

  // ── dist/graph/index.html ────────────────────────────────────────────────────

  it("dist/graph/index.html exists (Task 11 graph page)", () => {
    expect(existsSync(join(DIST, "graph", "index.html"))).toBe(true)
  })

  // ── dist/notes/<slug>/index.html ─────────────────────────────────────────────

  it("at least one dist/notes/<slug>/index.html exists (fixture has 5 notes)", () => {
    const notesDir = join(DIST, "notes")
    expect(existsSync(notesDir)).toBe(true)

    const slugDirs = readdirSync(notesDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)

    expect(slugDirs.length).toBeGreaterThanOrEqual(1)

    // At least one slug directory must contain index.html
    const hasHtml = slugDirs.some((slug) =>
      existsSync(join(notesDir, slug, "index.html")),
    )
    expect(hasHtml).toBe(true)
  })

  // ── dist/atom.xml ────────────────────────────────────────────────────────────

  it("dist/atom.xml exists", () => {
    expect(existsSync(join(DIST, "atom.xml"))).toBe(true)
  })

  it("dist/atom.xml starts with <?xml and contains <feed", () => {
    const xml = readFileSync(join(DIST, "atom.xml"), "utf-8")
    expect(xml.trimStart()).toMatch(/^<\?xml/)
    expect(xml).toContain("<feed")
  })

  // ── dist/og/index.png ────────────────────────────────────────────────────────

  it("dist/og/index.png exists", () => {
    expect(existsSync(join(DIST, "og", "index.png"))).toBe(true)
  })

  it("dist/og/index.png is larger than 10 KB (real PNG, not a 1×1 placeholder)", () => {
    const { size } = statSync(join(DIST, "og", "index.png"))
    expect(size).toBeGreaterThan(10 * 1024)
  })

  // ── dist/graph/note-l1.json ──────────────────────────────────────────────────

  it("dist/graph/note-l1.json exists", () => {
    expect(existsSync(join(DIST, "graph", "note-l1.json"))).toBe(true)
  })

  it("dist/graph/note-l1.json parses as JSON with nodes and links arrays", () => {
    const raw = readFileSync(join(DIST, "graph", "note-l1.json"), "utf-8")
    const json = JSON.parse(raw) as { nodes: unknown[]; links: unknown[] }
    expect(Array.isArray(json.nodes)).toBe(true)
    expect(Array.isArray(json.links)).toBe(true)
  })

  // ── dist/notes-manifest.json ─────────────────────────────────────────────────

  it("dist/notes-manifest.json exists", () => {
    expect(existsSync(join(DIST, "notes-manifest.json"))).toBe(true)
  })

  it("dist/notes-manifest.json parses as JSON and is non-empty", () => {
    const raw = readFileSync(join(DIST, "notes-manifest.json"), "utf-8")
    const manifest = JSON.parse(raw) as Record<string, unknown>
    expect(typeof manifest).toBe("object")
    expect(manifest).not.toBeNull()
    expect(Object.keys(manifest).length).toBeGreaterThan(0)
  })

  // ── T3: article page prose + metadata classes ─────────────────────────────

  it("a sampled note page has class=\"prose\" on the article element (T3)", () => {
    const notesDir = join(DIST, "notes")
    const slugDirs = readdirSync(notesDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)

    expect(slugDirs.length).toBeGreaterThanOrEqual(1)

    // Check the first slug that has an index.html
    const slugWithHtml = slugDirs.find((slug) =>
      existsSync(join(notesDir, slug, "index.html")),
    )
    expect(slugWithHtml).toBeDefined()

    const html = readFileSync(join(notesDir, slugWithHtml!, "index.html"), "utf-8")
    // Accept either `class="prose"` alone or `class="prose ..."` (e.g. prose note-prose)
    expect(html).toMatch(/class="[^"]*\bprose\b[^"]*"/)
  })

  it("a sampled note page has .kind-badge element (T3)", () => {
    const notesDir = join(DIST, "notes")
    const slugDirs = readdirSync(notesDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)

    const slugWithHtml = slugDirs.find((slug) =>
      existsSync(join(notesDir, slug, "index.html")),
    )
    expect(slugWithHtml).toBeDefined()

    const html = readFileSync(join(notesDir, slugWithHtml!, "index.html"), "utf-8")
    expect(html).toContain("kind-badge")
  })

  it("a sampled note page has reading-time text (T3)", () => {
    const notesDir = join(DIST, "notes")
    const slugDirs = readdirSync(notesDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)

    const slugWithHtml = slugDirs.find((slug) =>
      existsSync(join(notesDir, slug, "index.html")),
    )
    expect(slugWithHtml).toBeDefined()

    const html = readFileSync(join(notesDir, slugWithHtml!, "index.html"), "utf-8")
    expect(html).toMatch(/\d+ min ·/)
  })

  // ── Title consistency (Round 7 #4 Consistency & Standards regression gate) ──
  //
  // Every dist HTML page must satisfy:
  //   1. <title> present, non-empty
  //   2. Home (dist/index.html) is exactly "meshblog"
  //   3. Every other page ends with "· meshblog" — the brand suffix
  //   4. No title may use an em-dash (—) as a separator; "·" is canonical
  //
  // Why: title separator drifted to a mix of "·" and "—" across /graph, /404,
  // and article pages had no brand suffix at all — caught by Round 7 QA sweep.

  it("all dist HTML pages use consistent <title> pattern", () => {
    function findHtmlFiles(dir: string, acc: string[] = []): string[] {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith(".")) continue
        const full = join(dir, entry.name)
        if (entry.isDirectory()) findHtmlFiles(full, acc)
        else if (entry.name.endsWith(".html")) acc.push(full)
      }
      return acc
    }

    const htmlFiles = findHtmlFiles(DIST)
    expect(htmlFiles.length).toBeGreaterThan(0)

    const violations: string[] = []
    for (const file of htmlFiles) {
      const rel = file.slice(DIST.length + 1)
      const html = readFileSync(file, "utf-8")
      const m = html.match(/<title>([^<]*)<\/title>/)
      if (!m) {
        violations.push(`${rel}: missing <title>`)
        continue
      }
      const title = m[1].trim()
      if (title.length === 0) {
        violations.push(`${rel}: empty <title>`)
        continue
      }
      if (title.includes("—")) {
        violations.push(`${rel}: em-dash in <title> — use "·" as separator (${JSON.stringify(title)})`)
      }
      if (rel === "index.html") {
        if (title !== "meshblog") {
          violations.push(`${rel}: home title must be exactly "meshblog", got ${JSON.stringify(title)}`)
        }
        continue
      }
      if (!title.endsWith("· meshblog")) {
        violations.push(`${rel}: title ${JSON.stringify(title)} must end with "· meshblog"`)
      }
    }

    expect(violations, `Title consistency violations:\n  ${violations.join("\n  ")}`).toEqual([])
  })

  // ── P1: TOC extraction actually works ───────────────────────────────────────
  //
  // Regression gate: previously the TOC scaffold was `[{label:'도입', level:1}]`
  // hardcoded in [slug].astro, causing 1-item TOC on every article regardless
  // of heading count. Now TOC is extracted from rendered HTML via extractToc().

  it("at least one note page renders a TOC with more than 1 entry", () => {
    const notesDir = join(DIST, "notes")
    const slugDirs = readdirSync(notesDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
    let maxEntries = 0
    for (const slug of slugDirs) {
      const file = join(notesDir, slug, "index.html")
      if (!existsSync(file)) continue
      const html = readFileSync(file, "utf-8")
      // Count TOC anchor links inside .reader-aside that link to heading anchors (#id).
      // The TOC renders <a href="#slug-id"> for each heading extracted by extractToc().
      const asideBlock = html.match(/<aside[^>]*class="[^"]*reader-aside[^"]*"[^>]*>([\s\S]*?)<\/aside>/)
      if (!asideBlock) continue
      const linkCount = (asideBlock[1].match(/<a[^>]*href="#[^"]+"/g) || []).length
      if (linkCount > maxEntries) maxEntries = linkCount
    }
    expect(maxEntries, "at least one note page should have a multi-entry TOC").toBeGreaterThan(1)
  })

  // ── P2: excerpt (meta description) must not contain H2 heading text ──────
  //
  // Regression gate: excerpt sliced right into a mid-body H2 on post 26,
  // leaking "실제로 부닥친 문제들" into the preview. plainExcerpt() strips
  // all heading lines before slicing.

  it("no article meta description leaks H2 heading text", () => {
    function walk(dir: string): string[] {
      const acc: string[] = []
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith(".")) continue
        const full = join(dir, entry.name)
        if (entry.isDirectory()) acc.push(...walk(full))
        else if (entry.name === "index.html") acc.push(full)
      }
      return acc
    }
    const articleFiles = [
      ...walk(join(DIST, "notes")),
      ...walk(join(DIST, "posts")),
    ]
    expect(articleFiles.length).toBeGreaterThan(0)
    const violations: string[] = []
    for (const file of articleFiles) {
      const html = readFileSync(file, "utf-8")
      const descM = html.match(/<meta name="description" content="([^"]+)"/)
      if (!descM) continue
      const desc = descM[1]
      // Collect all H2 plain text on this page
      const h2s = Array.from(html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/g))
        .map(m => m[1].replace(/<[^>]+>/g, '').trim())
        .filter(t => t.length > 5)
      for (const h2 of h2s) {
        if (desc.includes(h2)) {
          violations.push(`${file.slice(DIST.length + 1)}: description contains H2 text "${h2}"`)
        }
      }
    }
    expect(violations, `Excerpt leaks:\n  ${violations.join("\n  ")}`).toEqual([])
  })

  // ── P3: /graph page has a back-to-posts affordance ────────────────────
  it("/graph page has a visible back-to-posts link", () => {
    const html = readFileSync(join(DIST, "graph", "index.html"), "utf-8")
    // Check that both graph-back class and /posts href are present on the same <a> tag
    // (attribute order may vary from Astro's renderer)
    expect(html).toMatch(/class="graph-back"/)
    expect(html).toMatch(/href="[^"]*\/posts\/?[^"]*"[^>]*class="graph-back"|class="graph-back"[^>]*href="[^"]*\/posts\/?[^"]*"/)
  })
})
