#!/usr/bin/env tsx
/**
 * scripts/promote.ts — flip draft notes/posts to published with a checklist gate.
 *
 * Usage:
 *   bun run promote <path> [--dry-run] [--no-refresh]
 *
 * Path is a single .md file or a directory of .md files. Accepts both
 * content/notes/*.md and content/posts/*.md. Refuses paths with `..` segments
 * to keep operations inside the vault.
 *
 * Pipeline (per file):
 *   1. frontmatter parses
 *   2. tags is non-empty
 *   3. (whole-batch once) bun run audit passes
 *   4. flip draft:false, set published_at: <today UTC>
 *   5. atomic write (.tmp + rename)
 * After all files, spawn `bun run refresh` unless --no-refresh.
 *
 * Idempotent: file already at draft:false → log + exit 0 (per file).
 * Whole-batch exit code: 0 if no FAIL; 1 if any FAIL.
 */

import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

import {
  existsSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"
import { dirname, extname, join, resolve } from "node:path"
import { spawn, spawnSync } from "node:child_process"
import matter from "gray-matter"

const VAULT_DIRS = ["content/notes", "content/posts"]

export type PromoteOptions = {
  dryRun: boolean
  refresh: boolean
}

export type CheckResult =
  | { ok: true; reason?: undefined }
  | { ok: false; reason: string }

export type PerFileOutcome = {
  path: string
  outcome: "promoted" | "already-published" | "failed"
  reason?: string
}

// ── helpers (exported for tests) ─────────────────────────────────────────────

/** Reject paths that escape the vault via `..`. */
export function isSafePath(p: string): boolean {
  const resolved = resolve(p)
  const cwd = resolve(".")
  return resolved.startsWith(cwd + "/") || resolved === cwd
}

/** Walk a path: file → [path]; directory → all .md files (non-recursive). */
export function collectInputs(pathArg: string): string[] {
  if (!existsSync(pathArg)) throw new Error(`path not found: ${pathArg}`)
  if (!isSafePath(pathArg)) throw new Error(`path escapes vault (.. segments): ${pathArg}`)
  const stat = statSync(pathArg)
  if (stat.isFile()) {
    if (extname(pathArg).toLowerCase() !== ".md") {
      throw new Error(`not a markdown file: ${pathArg}`)
    }
    return [pathArg]
  }
  if (!stat.isDirectory()) throw new Error(`not a file or directory: ${pathArg}`)
  return readdirSync(pathArg)
    .filter((f) => f.endsWith(".md"))
    .map((f) => join(pathArg, f))
    .sort()
}

/** Inspect frontmatter + decide check outcomes. */
export function checkFile(filePath: string): CheckResult {
  let raw: string
  try {
    raw = readFileSync(filePath, "utf-8")
  } catch (err) {
    return { ok: false, reason: `read failed: ${(err as Error).message}` }
  }
  let parsed: ReturnType<typeof matter>
  try {
    parsed = matter(raw)
  } catch (err) {
    return { ok: false, reason: `frontmatter parse failed: ${(err as Error).message}` }
  }
  const fm = parsed.data
  if (!Array.isArray(fm.tags) || fm.tags.length === 0) {
    return { ok: false, reason: "tags is empty (must be non-empty array)" }
  }
  return { ok: true }
}

/** Compose a promoted version of the frontmatter + body (no fs writes). */
export function composePromoted(filePath: string, today: string): string {
  const raw = readFileSync(filePath, "utf-8")
  const parsed = matter(raw)
  const fm = { ...parsed.data, draft: false } as Record<string, unknown>
  if (!fm.published_at) fm.published_at = today
  return matter.stringify(parsed.content, fm)
}

/** Atomic write: tmpfile then rename. */
export function atomicWrite(targetPath: string, content: string): void {
  const tmp = `${targetPath}.tmp`
  writeFileSync(tmp, content, "utf-8")
  try {
    renameSync(tmp, targetPath)
  } catch (err) {
    try { unlinkSync(tmp) } catch { /* ignore */ }
    throw err
  }
}

/** Today's date in YYYY-MM-DD (UTC) — deterministic, testable. */
export function todayISO(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}

/** Returns true when frontmatter currently has draft:true. */
export function isDraft(filePath: string): boolean {
  const raw = readFileSync(filePath, "utf-8")
  const { data } = matter(raw)
  return data.draft === true
}

export type AuditDeps = {
  runAudit: () => { exitCode: number; stderr: string }
}

/** Default audit invocation: `bun run audit`. Tests inject a stub. */
const defaultAudit: AuditDeps["runAudit"] = () => {
  const r = spawnSync("bun", ["run", "audit"], { encoding: "utf-8" })
  return { exitCode: r.status ?? 1, stderr: r.stderr ?? "" }
}

/** Promote a single file given options + injectable today. Returns outcome. */
export function promoteOne(
  filePath: string,
  options: PromoteOptions,
  today: string,
): PerFileOutcome {
  if (!isDraft(filePath)) {
    return { path: filePath, outcome: "already-published" }
  }
  const check = checkFile(filePath)
  if (!check.ok) return { path: filePath, outcome: "failed", reason: check.reason }

  if (options.dryRun) {
    return { path: filePath, outcome: "promoted", reason: "[dry-run] would flip draft:false" }
  }

  const content = composePromoted(filePath, today)
  atomicWrite(filePath, content)
  return { path: filePath, outcome: "promoted" }
}

export function spawnRefresh(): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("bun", ["run", "refresh"], { stdio: "inherit" })
    child.on("close", (code) => {
      if (code === 0) resolve()
      else reject(new Error(`bun run refresh exited with code ${code}`))
    })
    child.on("error", reject)
  })
}

// ── CLI entry ─────────────────────────────────────────────────────────────────

export function parseArgs(argv: string[]): { pathArgs: string[]; options: PromoteOptions } {
  const args = argv.slice(2)
  const positional = args.filter((a) => !a.startsWith("--"))
  if (positional.length === 0) {
    throw new Error("usage: bun run promote <path>... [--dry-run] [--no-refresh]")
  }
  return {
    pathArgs: positional,
    options: {
      dryRun: args.includes("--dry-run"),
      refresh: !args.includes("--no-refresh"),
    },
  }
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("promote.ts")

if (isMainModule) {
  ;(async () => {
    let pathArgs: string[]
    let options: PromoteOptions
    try {
      ({ pathArgs, options } = parseArgs(process.argv))
    } catch (err) {
      console.error(`[promote] ${(err as Error).message}`)
      process.exit(1)
      return
    }

    const inputs: string[] = []
    try {
      for (const p of pathArgs) {
        for (const f of collectInputs(p)) {
          if (!inputs.includes(f)) inputs.push(f)
        }
      }
    } catch (err) {
      console.error(`[promote] ${(err as Error).message}`)
      process.exit(1)
      return
    }

    if (inputs.length === 0) {
      console.error(`[promote] no markdown files in ${pathArgs.join(", ")}`)
      process.exit(1)
      return
    }

    // Audit gate (whole-batch). Skip in dry-run to make UX faster.
    if (!options.dryRun) {
      const audit = defaultAudit()
      if (audit.exitCode !== 0) {
        console.error("[promote] FAIL — `bun run audit` did not pass. Fix violations first.")
        if (audit.stderr) console.error(audit.stderr.slice(0, 800))
        process.exit(1)
        return
      }
    }

    const today = todayISO()
    const outcomes: PerFileOutcome[] = []
    for (const filePath of inputs) {
      try {
        outcomes.push(promoteOne(filePath, options, today))
      } catch (err) {
        outcomes.push({
          path: filePath,
          outcome: "failed",
          reason: (err as Error).message,
        })
      }
    }

    const promoted = outcomes.filter((o) => o.outcome === "promoted")
    const already = outcomes.filter((o) => o.outcome === "already-published")
    const failed = outcomes.filter((o) => o.outcome === "failed")

    console.log("\n[promote] summary:")
    console.log(`  promoted: ${promoted.length}`)
    console.log(`  already-published: ${already.length}`)
    console.log(`  failed: ${failed.length}`)
    for (const o of promoted) console.log(`    PROMOTED ${o.path}${o.reason ? ` (${o.reason})` : ""}`)
    for (const o of already) console.log(`    SKIP     ${o.path} (already published)`)
    for (const o of failed) console.log(`    FAIL     ${o.path} — ${o.reason ?? "unknown"}`)

    if (failed.length > 0) {
      process.exit(1)
      return
    }

    if (promoted.length > 0 && options.refresh && !options.dryRun) {
      console.log("\n[promote] running bun run refresh...")
      try {
        await spawnRefresh()
      } catch (err) {
        console.error(`[promote] refresh failed: ${(err as Error).message}`)
        process.exit(1)
        return
      }
    }

    process.exit(0)
  })().catch((err) => {
    console.error("[promote] fatal:", err)
    process.exit(1)
  })
}
