/**
 * Integration tests for L3 visibility — full Astro build × 3 modes.
 *
 * Each case sets meshblog.config.json, runs `bun run build:fixture`,
 * then verifies the dist output for the L3 fixture slug.
 *
 * L3 slug: 'fixture-글쓰기-철학' (assigned level=3 in seed.sql fixture).
 *
 * These are slow tests (60–120s each). Use describe.sequential so they
 * don't run in parallel (config file is shared state).
 */
import { describe, it, expect, afterAll, vi } from "vitest"
import { execSync } from "node:child_process"
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"

vi.setConfig({ testTimeout: 180_000 })

const ROOT = join(__dirname, "../..")
const CONFIG_PATH = join(ROOT, "meshblog.config.json")
// Slug assigned level=3 in test/fixtures/seed.sql
const L3_SLUG = "fixture-글쓰기-철학"

/**
 * Resolve the dist/notes page path for a given slug.
 * Always returns the worktree-local dist/ path — the builds in this test
 * always run with cwd = ROOT (the worktree), so Astro outputs there.
 * We do NOT fall back to the main repo dist/ because that would produce
 * false positives in the hidden-mode test (a page that was built by a
 * prior full-mode run in the main repo would be detected as "present"
 * even though the worktree's hidden build correctly omitted it).
 */
function resolveDistPage(slug: string): string {
  return join(ROOT, "dist/notes", slug, "index.html")
}

function setConfig(mode: "full" | "keyword-only" | "hidden") {
  writeFileSync(CONFIG_PATH, JSON.stringify({ l3Visibility: mode }))
}

function restoreConfig() {
  writeFileSync(CONFIG_PATH, JSON.stringify({ l3Visibility: "full" }))
}

function runBuild(): void {
  // Wipe dist before each build. Astro re-uses content-hashed prerender chunks
  // across builds, and a stale chunk left in dist/.prerender will fail to
  // resolve under the new build's hash, surfacing as ERR_MODULE_NOT_FOUND.
  rmSync(join(ROOT, "dist"), { recursive: true, force: true })
  execSync("bun run build:fixture", {
    cwd: ROOT,
    stdio: "pipe",
    timeout: 150_000,
  })
}

afterAll(() => {
  restoreConfig()
})

describe.sequential("L3 visibility integration", () => {
  it("full mode: L3 slug renders full article body (no placeholder, no noindex)", () => {
    setConfig("full")
    runBuild()

    const distPage = resolveDistPage(L3_SLUG)
    expect(existsSync(distPage)).toBe(true)
    const html = readFileSync(distPage, "utf-8")
    expect(html).toContain("article")
    expect(html).not.toContain("PRIVATE NOTE")
    expect(html).not.toContain('content="noindex"')
  })

  it("keyword-only mode: L3 slug page exists with PRIVATE NOTE eyebrow and noindex meta", () => {
    setConfig("keyword-only")
    runBuild()

    const distPage = resolveDistPage(L3_SLUG)
    expect(existsSync(distPage)).toBe(true)
    const html = readFileSync(distPage, "utf-8")
    expect(html).toContain("PRIVATE NOTE")
    expect(html).toContain("noindex")
    // Title should still be present (keyword = title visible)
    expect(html).toContain("개발자의 글쓰기 철학")
  })

  it("hidden mode: L3 slug page is absent from dist (404)", () => {
    setConfig("hidden")
    runBuild()

    const distPage = resolveDistPage(L3_SLUG)
    expect(existsSync(distPage)).toBe(false)
  })
})
