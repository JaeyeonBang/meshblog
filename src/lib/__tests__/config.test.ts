/**
 * config.test.ts
 *
 * Tests for loadMeshblogConfig — 6 cases per plan §5.
 *
 * Strategy: write real temp files + chdir into temp dir so loadMeshblogConfig
 * reads from process.cwd(). Reset cache in beforeEach via __resetConfigCache.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { mkdtempSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

// ── Hoisted mock: intercept console.warn to assert on it silently ─────────────
// We do NOT vi.mock node:fs — instead we use real temp dirs via process.chdir.

let loadMeshblogConfig: () => import("../config").MeshblogConfig
let __resetConfigCache: () => void
let savedCwd: string
let tmpDir: string

beforeEach(async () => {
  // Fresh module reference each test — reimport so module-level cache is exposed
  // but cleared via __resetConfigCache
  const mod = await import("../config")
  loadMeshblogConfig = mod.loadMeshblogConfig
  __resetConfigCache = mod.__resetConfigCache
  __resetConfigCache()

  savedCwd = process.cwd()
  tmpDir = mkdtempSync(join(tmpdir(), "meshblog-config-test-"))
  process.chdir(tmpDir)
})

afterEach(() => {
  process.chdir(savedCwd)
  rmSync(tmpDir, { recursive: true, force: true })
  __resetConfigCache()
  vi.restoreAllMocks()
})

describe("loadMeshblogConfig", () => {
  it("falls back to 'full' + warns when file is missing", () => {
    // tmpDir has no meshblog.config.json
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    const config = loadMeshblogConfig()

    expect(config.l3Visibility).toBe("full")
    expect(warnSpy).toHaveBeenCalledOnce()
    expect(warnSpy.mock.calls[0][0]).toContain("not found")
  })

  it("falls back to 'full' + warns on malformed JSON", () => {
    writeFileSync(join(tmpDir, "meshblog.config.json"), "{ not valid json }")
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    const config = loadMeshblogConfig()

    expect(config.l3Visibility).toBe("full")
    expect(warnSpy).toHaveBeenCalledOnce()
    expect(warnSpy.mock.calls[0][0]).toContain("malformed JSON")
  })

  it("falls back to 'full' + warns on invalid mode string", () => {
    writeFileSync(
      join(tmpDir, "meshblog.config.json"),
      JSON.stringify({ l3Visibility: "L3" }),
    )
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    const config = loadMeshblogConfig()

    expect(config.l3Visibility).toBe("full")
    expect(warnSpy).toHaveBeenCalledOnce()
    expect(warnSpy.mock.calls[0][0]).toContain("invalid l3Visibility")
  })

  it("parses valid 'full' config", () => {
    writeFileSync(
      join(tmpDir, "meshblog.config.json"),
      JSON.stringify({ l3Visibility: "full" }),
    )

    const config = loadMeshblogConfig()
    expect(config.l3Visibility).toBe("full")
  })

  it("parses valid 'keyword-only' config", () => {
    writeFileSync(
      join(tmpDir, "meshblog.config.json"),
      JSON.stringify({ l3Visibility: "keyword-only" }),
    )

    const config = loadMeshblogConfig()
    expect(config.l3Visibility).toBe("keyword-only")
  })

  it("returns memoized result on second call (file read once)", () => {
    writeFileSync(
      join(tmpDir, "meshblog.config.json"),
      JSON.stringify({ l3Visibility: "hidden" }),
    )

    const first = loadMeshblogConfig()
    // Overwrite file — memoized result should still be the original
    writeFileSync(
      join(tmpDir, "meshblog.config.json"),
      JSON.stringify({ l3Visibility: "full" }),
    )
    const second = loadMeshblogConfig()

    expect(first).toBe(second) // same object reference — memoized
    expect(second.l3Visibility).toBe("hidden") // not re-read
  })
})
