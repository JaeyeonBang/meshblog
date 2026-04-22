/**
 * v1-acceptance.test.ts — reusable smoke for the 6 v1 deliverables in CLAUDE.md.
 *
 * Offline-testable criteria only (#2, #3, #4, #5). The live-URL gates
 * (#6 deploy, #7 daily audit, #1 interactive init) are covered by the
 * post-push protocol in CLAUDE.md and can't run here without network state.
 *
 * Runs after build-smoke.test.ts (alphabetical), so dist/ is populated.
 * If dist/ is missing the whole suite is skipped — the signal comes from
 * build-smoke.
 */
import { describe, it, expect } from "vitest"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { auditDrafts } from "../scripts/audit-drafts"

const REPO_ROOT = join(import.meta.dirname, "..")
const DIST = join(REPO_ROOT, "dist")
const TEST_DB = join(REPO_ROOT, ".data/test-smoke.db")

describe.skipIf(!existsSync(DIST))("v1 acceptance smoke", () => {
  // #2 — fixture build renders real content without OPENAI_API_KEY
  it("#2 fixture build produced at least 5 note pages offline", () => {
    const slugs = readdirSync(join(DIST, "notes"), { withFileTypes: true })
      .filter((d) => d.isDirectory() && existsSync(join(DIST, "notes", d.name, "index.html")))
    expect(slugs.length).toBeGreaterThanOrEqual(5)
  })

  // #3 — wikilinks render as anchors, strip-wikilinks.ts was replaced
  it("#3 strip-wikilinks.ts no longer exists in source tree", () => {
    expect(existsSync(join(REPO_ROOT, "src/lib/markdown/strip-wikilinks.ts"))).toBe(false)
  })

  it("#3 preprocess.ts pipes through resolveWikilinks (not a strip shim)", () => {
    const src = readFileSync(join(REPO_ROOT, "src/lib/markdown/preprocess.ts"), "utf-8")
    expect(src).toContain("resolveWikilinks")
    expect(src).not.toMatch(/\bstripWikilinks\b/)
  })

  // #4 — draft safety net
  it("#4 audit-drafts reports zero draft leaks on the fixture DB", () => {
    const result = auditDrafts({ dbPath: TEST_DB })
    expect(result.leaks).toEqual([])
  })

  // #5 — /graph exposes a Backlinks mode alongside Notes/Concepts
  it("#5 dist/graph/index.html exposes a backlinks mode control", () => {
    const html = readFileSync(join(DIST, "graph", "index.html"), "utf-8")
    expect(html).toMatch(/data-mode="backlinks"|>backlinks</i)
  })

  it("#5 dist/graph/backlinks.json is a JSON artifact with nodes array", () => {
    expect(existsSync(join(DIST, "graph", "backlinks.json"))).toBe(true)
    const json = JSON.parse(readFileSync(join(DIST, "graph", "backlinks.json"), "utf-8"))
    expect(typeof json).toBe("object")
    expect(json).not.toBeNull()
  })
})
