import { readdirSync, existsSync } from "node:fs"
import { join, basename } from "node:path"

export type DiscoveredFile = {
  path: string
  folder: string
  primarySlug: string
  companionEnPath?: string
}

export interface DiscoverOptions {
  skipUnderscore?: boolean
}

/**
 * Walk one or more base directories and return all primary `.md` files found.
 *
 * Rules:
 * - Files matching `*.en.md` are companion files — they are attached to the
 *   primary entry via `companionEnPath` and NOT returned as independent entries.
 * - A `*.en.md` that has no matching primary `.md` in the same dir is skipped
 *   with a build-time warning.
 * - Files whose names start with `_` are excluded when `skipUnderscore` is true
 *   (default), matching the behaviour of build-index.ts.
 *
 * @param baseDirs  Directories to search (silently skipped when unreadable).
 * @param opts.skipUnderscore  When true (default), `_`-prefixed files excluded.
 */
export function discoverMarkdown(
  baseDirs: string[],
  opts?: DiscoverOptions,
): DiscoveredFile[] {
  const skipUnderscore = opts?.skipUnderscore ?? true
  const found: DiscoveredFile[] = []
  for (const dir of baseDirs) {
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      continue
    }
    // Partition into primary (.md) and companion (.en.md) sets
    const primaryNames = new Set<string>()
    const companionNames: string[] = []
    for (const name of entries) {
      if (skipUnderscore && name.startsWith("_")) continue
      if (!name.endsWith(".md")) continue
      if (name.endsWith(".en.md")) {
        companionNames.push(name)
      } else {
        primaryNames.add(name)
      }
    }
    // Build a lookup: primarySlug → companionEnPath
    const companionBySlug = new Map<string, string>()
    for (const compName of companionNames) {
      // foo.en.md → primary slug is "foo"
      const primarySlug = basename(compName, ".en.md")
      const primaryFile = `${primarySlug}.md`
      if (primaryNames.has(primaryFile)) {
        companionBySlug.set(primarySlug, join(dir, compName))
      } else {
        console.warn(
          `[discover] companion file "${join(dir, compName)}" has no matching primary "${join(dir, primaryFile)}" — skipped`,
        )
      }
    }
    // Emit one entry per primary file
    for (const name of entries) {
      if (skipUnderscore && name.startsWith("_")) continue
      if (!name.endsWith(".md") || name.endsWith(".en.md")) continue
      const primarySlug = basename(name, ".md")
      found.push({
        path: join(dir, name),
        folder: dir,
        primarySlug,
        companionEnPath: companionBySlug.get(primarySlug),
      })
    }
  }
  return found
}
