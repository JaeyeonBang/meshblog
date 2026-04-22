import type Database from "better-sqlite3"
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))

/** Current schema version. Increment when adding new tables or altering columns. */
const SCHEMA_VERSION = 5

export function applyMigrations(db: Database.Database): void {
  // WAL + busy timeout (Amendment A / DX #3)
  db.pragma("journal_mode = WAL")
  db.pragma("busy_timeout = 5000")
  db.pragma("foreign_keys = ON")

  // Create schema_version table if it doesn't exist (DX #9)
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER NOT NULL
    )
  `)

  const row = db.prepare("SELECT version FROM schema_version").get() as { version: number } | undefined
  const currentVersion = row?.version ?? 0

  // Pre-schema column additions: ALTER TABLE MUST happen before db.exec(schema)
  // because schema.sql creates indexes that reference columns added by ALTER.
  // Each block checks for column existence so it is safe to run on any DB version.

  // Phase 1 → Phase 2: graph_status + level_pin on notes
  {
    const notesInfo = db.pragma("table_info(notes)") as { name: string }[]
    const cols = new Set(notesInfo.map((c) => c.name))
    if (cols.size > 0) {
      // Only ALTER if the table already exists (cols.size > 0 means notes exists)
      if (!cols.has("graph_status")) {
        db.exec("ALTER TABLE notes ADD COLUMN graph_status TEXT NOT NULL DEFAULT 'pending'")
      }
      if (!cols.has("level_pin")) {
        db.exec("ALTER TABLE notes ADD COLUMN level_pin INTEGER")
      }
      // Phase 4 → Phase 5: category_slug
      if (!cols.has("category_slug")) {
        db.exec("ALTER TABLE notes ADD COLUMN category_slug TEXT")
      }
    }
  }

  // Phase 2 → Phase 3: content_hash on qa_cards
  {
    const qaInfo = db.pragma("table_info(qa_cards)") as { name: string }[]
    const qaCols = new Set(qaInfo.map((c) => c.name))
    if (qaCols.size > 0 && !qaCols.has("content_hash")) {
      db.exec("ALTER TABLE qa_cards ADD COLUMN content_hash TEXT")
    }
  }

  // Apply base schema (idempotent: all CREATE TABLE IF NOT EXISTS + indexes).
  // Column additions above ensure existing tables have the right columns before
  // schema.sql tries to create indexes on those columns.
  const schemaPath = join(__dirname, "schema.sql")
  const schema = readFileSync(schemaPath, "utf-8")
  db.exec(schema)

  // Update schema version stamp.
  if (currentVersion === 0) {
    db.prepare("INSERT INTO schema_version (version) VALUES (?)").run(SCHEMA_VERSION)
  } else if (currentVersion < SCHEMA_VERSION) {
    db.prepare("UPDATE schema_version SET version = ?").run(SCHEMA_VERSION)
  }
}
