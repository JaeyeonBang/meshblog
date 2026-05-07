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

export type PiiHit = {
  pattern: string
  line: number
  match: string
}

// Patterns we surface as PII candidates. Advisory only — /promote prints
// these but does NOT block (false-positive cost is too high for hard-fail).
//
// The ODQA team-table redaction (PR #105) and the bulk-ingest dogfood
// (PR #106 → finding) drove this list. Honorifics catch the "방재연 팀장"
// pattern; the `사람:` rule catches `사람: 호준 이` which the v1 honorific-
// only regex missed.
const PII_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "email", re: /[\w._%+-]+@[\w.-]+\.[a-zA-Z]{2,}/g },
  { name: "kr-phone", re: /\b010-?\d{4}-?\d{4}\b/g },
  {
    // Catches both "방재연 팀장" and "방재연 (T8092) (팀장)" — the optional paren
    // groups (one before, one wrapping the honorific) cover the ODQA team-
    // table shape and the bare prose form.
    name: "kr-honorific",
    re: /[가-힣]{2,4}(?:\s*\([^)]*\))?\s*\(?\s*(?:님|씨|연구원|매니저|TL|PM|팀장)\s*\)?/g,
  },
  {
    name: "person-prefix",
    re: /^\s*(?:사람|이름|작성자|담당자|연락처)\s*[:：]\s*[가-힣]{2,4}(?:\s+[가-힣]+)?/gm,
  },
]

/**
 * Scan a file for advisory PII patterns. Returns one entry per match with
 * line number. Empty array means the file looks clean — but this is regex,
 * not a guarantee; the operator should still eyeball before committing
 * obvious-PII-shaped content.
 */
export function findPiiHits(filePath: string): PiiHit[] {
  let raw: string
  try {
    raw = readFileSync(filePath, "utf-8")
  } catch {
    return []
  }
  const lines = raw.split(/\r?\n/)
  const hits: PiiHit[] = []
  for (const { name, re } of PII_PATTERNS) {
    const flagsForLines = re.flags.includes("m") ? re.flags : `${re.flags}m`
    const lineRe = new RegExp(re.source, flagsForLines)
    lines.forEach((line, i) => {
      const matches = line.matchAll(lineRe)
      for (const m of matches) {
        hits.push({ pattern: name, line: i + 1, match: m[0] })
      }
    })
  }
  return hits
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

    // Advisory PII grep on every input file (not just the promoted ones —
    // a future re-run might promote the rest, and the warning is cheap).
    // Print warnings; do NOT block, false-positive cost is too high.
    const piiByFile = new Map<string, PiiHit[]>()
    for (const filePath of inputs) {
      const hits = findPiiHits(filePath)
      if (hits.length > 0) piiByFile.set(filePath, hits)
    }
    if (piiByFile.size > 0) {
      console.log(`\n[promote] PII candidates in ${piiByFile.size} file(s) — review before relying on the public deploy:`)
      for (const [path, hits] of piiByFile) {
        console.log(`    ${path}`)
        for (const h of hits.slice(0, 5)) {
          console.log(`      L${h.line} (${h.pattern}): ${h.match}`)
        }
        if (hits.length > 5) console.log(`      ... and ${hits.length - 5} more`)
      }
      console.log(`  (advisory only — promote did NOT block. Redact + re-promote --force if you want to ship the redacted version.)`)
    }

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
