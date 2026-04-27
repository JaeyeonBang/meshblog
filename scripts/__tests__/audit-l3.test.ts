import { describe, it, expect, beforeEach, afterEach } from "vitest"
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
  rmSync,
  existsSync,
  unlinkSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { auditDrafts } from "../audit-drafts.ts"
import { createDb, execute } from "../../src/lib/db/index.ts"
import { __resetConfigCache } from "../../src/lib/config.ts"

const TMP_DIR = ".data"
const TMP_DB = join(TMP_DIR, "test-audit-l3.db")
const CONFIG_PATH = "meshblog.config.json"

function seedNoteWithLevel(
  dbPath: string,
  slug: string,
  level: number,
) {
  const db = createDb(dbPath)
  execute(
    db,
    `INSERT OR IGNORE INTO notes (id, slug, title, content, content_hash, folder_path)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [slug, slug, `title ${slug}`, "body", "hash", "content/notes"],
  )
  execute(
    db,
    `INSERT OR REPLACE INTO graph_levels (graph_type, node_id, level, pagerank, pinned)
     VALUES ('note', ?, ?, 0.1, 0)`,
    [slug, level],
  )
  db.close()
}

describe("audit-l3 — L3 visibility leak detection", () => {
  let distDir: string
  let savedConfig: string | null = null

  beforeEach(() => {
    if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true })
    if (existsSync(TMP_DB)) unlinkSync(TMP_DB)
    __resetConfigCache()

    // Save existing config if present
    try {
      savedConfig = readFileSync(CONFIG_PATH, "utf-8")
    } catch {
      savedConfig = null
    }

    // Create a temp dist dir
    distDir = mkdtempSync(join(tmpdir(), "audit-l3-dist-"))
  })

  afterEach(() => {
    __resetConfigCache()
    // Restore config
    if (savedConfig !== null) {
      writeFileSync(CONFIG_PATH, savedConfig)
    } else if (existsSync(CONFIG_PATH)) {
      unlinkSync(CONFIG_PATH)
    }
    rmSync(distDir, { recursive: true, force: true })
    if (existsSync(TMP_DB)) unlinkSync(TMP_DB)
  })

  it("hidden mode: flags L3 page that exists in dist", () => {
    seedNoteWithLevel(TMP_DB, "my-l3-note", 3)
    // Write a dist page for the L3 slug
    const pageDir = join(distDir, "my-l3-note")
    mkdirSync(pageDir, { recursive: true })
    writeFileSync(join(pageDir, "index.html"), "<html><body>full content</body></html>")

    writeFileSync(CONFIG_PATH, JSON.stringify({ l3Visibility: "hidden" }))

    const result = auditDrafts({
      dbPath: TMP_DB,
      baseDirs: [],
      distDir,
    })

    expect(result.l3Leaks).toBeDefined()
    expect(result.l3Leaks!.map((l) => l.slug)).toContain("my-l3-note")
    expect(result.l3Leaks![0].reason).toBe("page-exists")
  })

  it("keyword-only mode: flags L3 page missing PRIVATE NOTE eyebrow", () => {
    seedNoteWithLevel(TMP_DB, "my-l3-note", 3)
    // Write an L3 page WITHOUT the eyebrow
    const pageDir = join(distDir, "my-l3-note")
    mkdirSync(pageDir, { recursive: true })
    writeFileSync(join(pageDir, "index.html"), "<html><body>full body content here</body></html>")

    writeFileSync(CONFIG_PATH, JSON.stringify({ l3Visibility: "keyword-only" }))

    const result = auditDrafts({
      dbPath: TMP_DB,
      baseDirs: [],
      distDir,
    })

    expect(result.l3Leaks).toBeDefined()
    expect(result.l3Leaks!.map((l) => l.slug)).toContain("my-l3-note")
    expect(result.l3Leaks![0].reason).toBe("missing-noindex")
  })

  it("keyword-only mode: passes when L3 page contains PRIVATE NOTE eyebrow", () => {
    seedNoteWithLevel(TMP_DB, "my-l3-note", 3)
    const pageDir = join(distDir, "my-l3-note")
    mkdirSync(pageDir, { recursive: true })
    writeFileSync(
      join(pageDir, "index.html"),
      "<html><body><p class=\"eyebrow\">PRIVATE NOTE</p></body></html>",
    )

    writeFileSync(CONFIG_PATH, JSON.stringify({ l3Visibility: "keyword-only" }))

    const result = auditDrafts({
      dbPath: TMP_DB,
      baseDirs: [],
      distDir,
    })

    expect(result.l3Leaks).toBeDefined()
    expect(result.l3Leaks!).toHaveLength(0)
  })

  it("full mode: skips L3 audit entirely", () => {
    seedNoteWithLevel(TMP_DB, "my-l3-note", 3)
    // Even if a full page exists, full mode should not flag it
    const pageDir = join(distDir, "my-l3-note")
    mkdirSync(pageDir, { recursive: true })
    writeFileSync(join(pageDir, "index.html"), "<html><body>full content</body></html>")

    writeFileSync(CONFIG_PATH, JSON.stringify({ l3Visibility: "full" }))

    const result = auditDrafts({
      dbPath: TMP_DB,
      baseDirs: [],
      distDir,
    })

    // l3Leaks should be empty (no audit in full mode)
    expect(result.l3Leaks ?? []).toHaveLength(0)
  })
})
