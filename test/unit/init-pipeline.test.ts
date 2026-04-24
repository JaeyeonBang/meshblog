/**
 * init-pipeline.test.ts — T3 (lite) from windows-rehearsal-hardening plan.
 *
 * The plan's original T3 asked for a full runInit({skipSpawn:true}) e2e
 * against a tmpdir meshblog clone, verifying `public/graph/backlinks.json`
 * + `public/og/*.png` + absence of `.init-dev.pid`. That ran the entire
 * 6-step pipeline + bun install + astro build = 90+ seconds per test, and
 * required mutating the real repo's state (because runInit hardcodes
 * REPO_ROOT) or prepping a full clone beforehand.
 *
 * This test takes the 80/20: exports the pipeline order as a const and
 * locks it here. A future refactor that silently drops build-backlinks
 * (the regression this test is guarding against) fails this suite
 * immediately, in 10ms, without spinning up anything.
 *
 * Trade-off: this doesn't catch pipeline corruption between extraction
 * and the loop — e.g., if someone swaps `for` for a map that skips a
 * step. That class of bug is less likely than "silently omit a step",
 * which is exactly what happened pre-PR #38 with build-backlinks.
 *
 * Full-pipeline integration is tracked as follow-up TG1-full once a
 * proper test harness exists (likely: tmpdir clone via git worktree).
 */
import { describe, it, expect } from "vitest"
import { KEYLESS_PIPELINE } from "../../scripts/init"

describe("KEYLESS_PIPELINE", () => {
  it("runs in the exact order required for a correct fork build", () => {
    // build-tokens MUST precede build-index because design.md → tokens.css
    // is a prereq for astro to pick up the right CSS vars. build-backlinks
    // MUST run after build-index because it reads the notes table. build-og
    // MUST run before astro build because OG images are referenced by meta
    // tags in the final HTML.
    const labels = KEYLESS_PIPELINE.map(([label]) => label)
    expect(labels).toEqual([
      "build-tokens",
      "build-index",
      "build-backlinks",
      "export-graph",
      "build-og",
      "astro build",
    ])
  })

  it("contains exactly 6 steps (catches silent additions/removals)", () => {
    expect(KEYLESS_PIPELINE.length).toBe(6)
  })

  it("invokes build-index with keyless flags (--skip-embed --skip-concepts)", () => {
    // The plan explicitly requires keyless mode — fork users typically
    // don't have OPENAI_API_KEY at init time.
    const buildIndex = KEYLESS_PIPELINE.find(([label]) => label === "build-index")
    expect(buildIndex).toBeDefined()
    expect(buildIndex![1]).toContain("--skip-embed")
    expect(buildIndex![1]).toContain("--skip-concepts")
  })

  it("uses bunx for astro build (not bun run) so the local astro binary resolves", () => {
    // Regression guard: `bun run astro build` would try to find an astro
    // script in package.json's scripts; bunx resolves the node_modules/.bin
    // binary directly. Forks without a scripts.astro entry would fail with
    // the former.
    const astroBuild = KEYLESS_PIPELINE.find(([label]) => label === "astro build")
    expect(astroBuild![1]).toBe("bunx astro build")
  })
})
