import Database from 'better-sqlite3'
import { existsSync } from 'node:fs'

/** Resolve the DB path lazily on each call so tests that flip
 *  `process.env.MESHBLOG_DB` between suites get the right database, not a
 *  module-load-time snapshot. Production runs see the same effective value. */
export function getDbPath(): string {
  return process.env.MESHBLOG_DB ?? '.data/index.db'
}

/** @deprecated Use getDbPath() — kept for back-compat with tests/scripts
 *  that referenced the const. Always reflects the current env. */
export const DB_PATH = getDbPath()

export function openReadonlyDb(): Database.Database | null {
  const path = getDbPath()
  if (!existsSync(path)) return null
  try {
    const db = new Database(path, { readonly: true, fileMustExist: true })
    db.pragma('query_only = ON')
    return db
  } catch (err) {
    console.error('[pages/db] open failed:', err)
    return null
  }
}
