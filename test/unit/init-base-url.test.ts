/**
 * init-base-url.test.ts — T2 from windows-rehearsal-hardening plan.
 *
 * Locks in the regex-based extraction of `base:` from astro.config.mjs.
 * /init uses this to print the correct localhost URL after the dev server
 * starts — hardcoding `/meshblog/` broke forks with different repo names
 * (which the rehearsal script patches to match the fork's subpath).
 *
 * Limitations are intentional: template literals and env-based expressions
 * return null (or match only the literal fallback). Full JS parsing is
 * scope creep for a one-shot read at init time.
 */
import { describe, it, expect } from "vitest"
import { parseAstroBase } from "../../scripts/init"

describe("parseAstroBase", () => {
  it("single-quoted standard base", () => {
    const cfg = `import { defineConfig } from 'astro/config'
export default defineConfig({
  base: '/meshblog',
  output: 'static',
})`
    expect(parseAstroBase(cfg)).toBe("meshblog")
  })

  it("double-quoted base", () => {
    const cfg = `export default defineConfig({ base: "/foo-bar-123" })`
    expect(parseAstroBase(cfg)).toBe("foo-bar-123")
  })

  it("returns null when base field is missing entirely", () => {
    const cfg = `export default defineConfig({ output: 'static' })`
    expect(parseAstroBase(cfg)).toBeNull()
  })

  it("returns null for template-literal expression", () => {
    const cfg = "export default defineConfig({ base: `/${process.env.X}` })"
    expect(parseAstroBase(cfg)).toBeNull()
  })

  it("returns null for bare env reference (no string literal in base)", () => {
    const cfg = `export default defineConfig({ base: process.env.BASE })`
    expect(parseAstroBase(cfg)).toBeNull()
  })

  it("returns null for env-or-default expression (regex requires base: + whitespace + quote)", () => {
    // The regex is intentionally strict: `base:` must be followed directly by
    // whitespace and an opening quote. Anything else (including `??` fallback
    // patterns) returns null, and /init's caller warns + falls back to
    // '/meshblog/'.
    const cfg = `export default defineConfig({ base: process.env.BASE ?? '/fallback' })`
    expect(parseAstroBase(cfg)).toBeNull()
  })

  it("extracts the first base literal if multiple exist (regex is non-greedy)", () => {
    const cfg = `export default defineConfig({ base: '/first' })
// old: base: '/second'`
    expect(parseAstroBase(cfg)).toBe("first")
  })

  it("tolerates whitespace variation around the colon", () => {
    expect(parseAstroBase("base:'/tight'")).toBe("tight")
    expect(parseAstroBase("base:   '/loose'")).toBe("loose")
  })

  // Trailing-slash cases — without these, resolveAstroBase produces URLs
  // like http://localhost:4321/meshblog// (double slash). Regression fix.
  it("strips a trailing slash in the literal", () => {
    expect(parseAstroBase(`base: '/meshblog/'`)).toBe("meshblog")
  })

  it("strips a trailing slash even with double quotes and hyphens", () => {
    expect(parseAstroBase(`base: "/foo-bar-2/"`)).toBe("foo-bar-2")
  })

  it("returns null for a lone-slash base (no slug content)", () => {
    // `base: '/'` is semantically "no prefix" — callers want the fallback
    // path, not an empty slug that produces http://localhost:4321//.
    expect(parseAstroBase(`base: '/'`)).toBeNull()
  })
})
