import { readFileSync, existsSync, readdirSync } from "node:fs"
import { basename, extname, join } from "node:path"
import matter from "gray-matter"
import { createDb, queryMany } from "../src/lib/db/index.ts"
import { discoverMarkdown } from "../src/lib/content/discover.ts"
import { loadMeshblogConfig, getL3NoteSlugs } from "../src/lib/config.ts"

const DEFAULT_DB = process.env.MESHBLOG_DB ?? ".data/index.db"
const DEFAULT_DIRS = ["content/posts", "content/notes"]

export type Leak = { id: string; path: string; reason: "draft:true" | "public:false" }

export type L3Leak = { slug: string; path: string; reason: "missing-noindex" | "page-exists" }

export type AuditResult = {
  leaks: Leak[]
  orphans: string[]
  l3Leaks?: L3Leak[]
}

export type AuditOptions = {
  dbPath?: string
  baseDirs?: string[]
  distDir?: string
}

function discoverAll(baseDirs: string[]): { path: string; id: string; fm: Record<string, unknown> }[] {
  return discoverMarkdown(baseDirs, { skipUnderscore: false }).map((f) => {
    const raw = readFileSync(f.path, "utf-8")
    const { data } = matter(raw)
    return { path: f.path, id: basename(f.path, extname(f.path)), fm: data }
  })
}

export function auditDrafts(options: AuditOptions = {}): AuditResult {
  const dbPath = options.dbPath ?? DEFAULT_DB
  const baseDirs = options.baseDirs ?? DEFAULT_DIRS
  const distDir = options.distDir ?? "dist/notes"

  const files = discoverAll(baseDirs)
  const fileIds = new Set(files.map((f) => f.id))

  if (!existsSync(dbPath)) {
    return { leaks: [], orphans: [] }
  }
  const db = createDb(dbPath)
  let dbIds: string[] = []
  try {
    dbIds = queryMany<{ id: string }>(db, "SELECT id FROM notes", []).map((r) => r.id)
  } finally {
    db.close()
  }
  const dbSet = new Set(dbIds)

  const leaks: Leak[] = []
  for (const f of files) {
    const reason: Leak["reason"] | null =
      f.fm.draft === true ? "draft:true" : f.fm.public === false ? "public:false" : null
    if (reason && dbSet.has(f.id)) {
      leaks.push({ id: f.id, path: f.path, reason })
    }
  }

  const orphans = dbIds.filter((id) => !fileIds.has(id))

  // ── L3 visibility audit ──────────────────────────────────────────────────────
  const { l3Visibility } = loadMeshblogConfig()
  const l3Leaks: L3Leak[] = []

  if (l3Visibility !== "full" && existsSync(dbPath) && existsSync(distDir)) {
    const db2 = createDb(dbPath)
    let l3Slugs: Set<string>
    try {
      l3Slugs = getL3NoteSlugs(db2)
    } finally {
      db2.close()
    }

    if (l3Slugs.size > 0) {
      for (const slug of l3Slugs) {
        const pageHtml = join(distDir, slug, "index.html")
        if (l3Visibility === "hidden") {
          // In hidden mode, no L3 page should exist at all.
          if (existsSync(pageHtml)) {
            l3Leaks.push({ slug, path: pageHtml, reason: "page-exists" })
          }
        } else if (l3Visibility === "keyword-only") {
          // In keyword-only mode, each L3 page must contain the PRIVATE NOTE eyebrow.
          if (existsSync(pageHtml)) {
            const html = readFileSync(pageHtml, "utf-8")
            if (!html.includes("PRIVATE NOTE")) {
              l3Leaks.push({ slug, path: pageHtml, reason: "missing-noindex" })
            }
          }
        }
      }
    }
  }

  return { leaks, orphans, l3Leaks }
}

// ── CLI entry ─────────────────────────────────────────────────────────────────
const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("audit-drafts.ts")

if (isMainModule) {
  const result = auditDrafts()
  const hasL3Leaks = (result.l3Leaks ?? []).length > 0
  if (result.leaks.length === 0 && result.orphans.length === 0 && !hasL3Leaks) {
    console.log("[audit] clean. no draft leaks, orphaned DB rows, or L3 visibility violations.")
    process.exit(0)
  }
  if (result.leaks.length > 0) {
    console.error(`[audit] ${result.leaks.length} draft leak(s):`)
    for (const l of result.leaks) {
      console.error(`  ✗ ${l.id}  (${l.reason})  ${l.path}`)
    }
  }
  if (result.orphans.length > 0) {
    console.error(`[audit] ${result.orphans.length} orphan DB row(s) (file deleted but DB row remains):`)
    for (const id of result.orphans) {
      console.error(`  ✗ ${id}`)
    }
  }
  if (hasL3Leaks) {
    console.error(`[audit] ${result.l3Leaks!.length} L3 visibility violation(s):`)
    for (const l of result.l3Leaks!) {
      console.error(`  ✗ ${l.slug}  (${l.reason})  ${l.path}`)
    }
  }
  process.exit(1)
}
