/**
 * archive.ts — copy raw input file to .cache/sources/<slug>.<ext> for
 * provenance. The archive dir is gitignored; archives are local-only.
 *
 * Throws if the target already exists — caller decides --force semantics.
 */

import { copyFileSync, existsSync, mkdirSync } from "node:fs"
import { extname, join, resolve } from "node:path"

const ARCHIVE_DIR = ".cache/sources"

export function archivePath(slug: string, srcPath: string): string {
  const ext = extname(srcPath).toLowerCase()
  return join(ARCHIVE_DIR, `${slug}${ext}`)
}

export function archiveRaw(srcPath: string, slug: string): string {
  const target = archivePath(slug, srcPath)
  if (existsSync(target)) {
    throw new Error(
      `archive already exists: ${target}\n` +
      `  Re-running ingest on the same slug? Pass --force to overwrite.`
    )
  }
  mkdirSync(ARCHIVE_DIR, { recursive: true })
  copyFileSync(srcPath, target)
  return resolve(target)
}
