import { readFileSync } from "node:fs"
import { join } from "node:path"
import type Database from "better-sqlite3"

// ── Types ────────────────────────────────────────────────────────────────────

export type L3Visibility = "full" | "keyword-only" | "hidden"

export interface MeshblogConfig {
  l3Visibility: L3Visibility
}

const VALID_MODES: L3Visibility[] = ["full", "keyword-only", "hidden"]
const DEFAULT_CONFIG: MeshblogConfig = { l3Visibility: "full" }

// ── Module-level memoization ─────────────────────────────────────────────────

let _configCache: MeshblogConfig | null = null
// WeakMap so multiple DB instances can each have their own memoized Set
const _l3SlugsCache = new WeakMap<Database.Database, Set<string>>()

// ── Test helper ──────────────────────────────────────────────────────────────

/**
 * Clears both memoization caches. Call in beforeEach in tests.
 */
export function __resetConfigCache(): void {
  _configCache = null
  // WeakMap entries are garbage-collected when DB instances go out of scope,
  // but tests may reuse the same DB instance — clear by rebuilding is not
  // possible with WeakMap. Tests must pass fresh DB instances per case, or
  // use a per-test DB reference that naturally drops from the map.
  // The config cache is what matters most for loadMeshblogConfig tests.
}

// ── loadMeshblogConfig ───────────────────────────────────────────────────────

/**
 * Reads meshblog.config.json from process.cwd().
 * Memoizes at module level — one read per build.
 * Falls back to { l3Visibility: 'full' } + console.warn on:
 *   - file missing
 *   - malformed JSON
 *   - invalid mode value
 */
export function loadMeshblogConfig(): MeshblogConfig {
  if (_configCache !== null) return _configCache

  const configPath = join(process.cwd(), "meshblog.config.json")
  let raw: string

  try {
    raw = readFileSync(configPath, "utf-8")
  } catch {
    console.warn(
      "[meshblog] meshblog.config.json not found — using default { l3Visibility: 'full' }",
    )
    _configCache = DEFAULT_CONFIG
    return _configCache
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    console.warn(
      "[meshblog] meshblog.config.json contains malformed JSON — using default { l3Visibility: 'full' }",
    )
    _configCache = DEFAULT_CONFIG
    return _configCache
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("l3Visibility" in parsed) ||
    !VALID_MODES.includes((parsed as Record<string, unknown>).l3Visibility as L3Visibility)
  ) {
    console.warn(
      `[meshblog] meshblog.config.json has invalid l3Visibility value — using default 'full'. Valid values: ${VALID_MODES.join(", ")}`,
    )
    _configCache = DEFAULT_CONFIG
    return _configCache
  }

  _configCache = { l3Visibility: (parsed as Record<string, unknown>).l3Visibility as L3Visibility }
  return _configCache
}

// ── getL3NoteSlugs ───────────────────────────────────────────────────────────

/**
 * Queries graph_levels for note-level L3 node_ids.
 * Memoizes per DB instance.
 * Returns empty Set + console.warn if graph_levels table doesn't exist.
 */
export function getL3NoteSlugs(db: Database.Database): Set<string> {
  const cached = _l3SlugsCache.get(db)
  if (cached !== undefined) return cached

  let rows: Array<{ node_id: string }>
  try {
    rows = db
      .prepare(
        `SELECT node_id FROM graph_levels WHERE graph_type = 'note' AND level = 3`,
      )
      .all() as Array<{ node_id: string }>
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes("no such table")) {
      console.warn(
        "[meshblog] graph_levels table not found — L3 set is empty. Run `bun run refresh` or `bun run scripts/export-graph.ts` first.",
      )
    } else {
      console.warn(`[meshblog] getL3NoteSlugs query failed: ${msg}`)
    }
    const empty = new Set<string>()
    _l3SlugsCache.set(db, empty)
    return empty
  }

  const slugs = new Set(rows.map((r) => r.node_id))
  _l3SlugsCache.set(db, slugs)
  return slugs
}

// ── filterL3 ─────────────────────────────────────────────────────────────────

/**
 * DRY chokepoint for L3 visibility filtering.
 * - 'full'   → returns input unchanged
 * - 'keyword-only' | 'hidden' → strips items whose id (or slug) is in l3 set
 */
export function filterL3<T extends { id: string } | { slug: string }>(
  notes: T[],
  mode: L3Visibility,
  l3: Set<string>,
): T[] {
  if (mode === "full") return notes
  return notes.filter((item) => {
    const key = "id" in item ? item.id : item.slug
    return !l3.has(key)
  })
}
