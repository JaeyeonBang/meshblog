/**
 * scripts/l3-visibility.ts — L3 visibility skill CLI
 *
 * Interactive chooser for how L3 (PageRank leaf) notes are published.
 * Reads current meshblog.config.json, shows L3 note stats, awaits
 * a single keypress (f/k/h/c), writes config atomically.
 *
 * Usage: bun run l3-visibility
 */

import { writeFileSync, existsSync, renameSync } from "node:fs"
import { join } from "node:path"
import { createInterface } from "node:readline"
import Database from "better-sqlite3"
import { loadMeshblogConfig, getL3NoteSlugs } from "../src/lib/config.ts"
import type { L3Visibility } from "../src/lib/config.ts"

// ── Constants ────────────────────────────────────────────────────────────────

const REPO_ROOT = join(import.meta.dirname, "..")
const CONFIG_PATH = join(REPO_ROOT, "meshblog.config.json")
const DB_PATH = join(REPO_ROOT, ".data", "index.db")

const MODE_LABELS: Record<L3Visibility, string> = {
  "full": "그래프 + 본문 모두 공개",
  "keyword-only": "그래프 노드는 보이지만, 클릭 시 \"비공개\" 안내 페이지",
  "hidden": "그래프에서도 빠지고 본문도 404",
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function writeConfigAtomic(mode: L3Visibility): void {
  const content = JSON.stringify({ l3Visibility: mode }, null, 2) + "\n"
  // Write to temp then rename for atomicity on POSIX;
  // on Windows renameSync may fail if target exists — fall back to direct write.
  const tmp = CONFIG_PATH + ".tmp"
  writeFileSync(tmp, content, "utf-8")
  try {
    renameSync(tmp, CONFIG_PATH)
  } catch {
    writeFileSync(CONFIG_PATH, content, "utf-8")
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // Load current config
  const config = loadMeshblogConfig()
  const currentMode = config.l3Visibility

  // Open DB and get L3 slugs
  if (!existsSync(DB_PATH)) {
    console.log(
      "graph_levels 테이블이 없습니다. `bun run refresh` 또는 `bun run scripts/export-graph.ts` 를 먼저 실행하세요.",
    )
    process.exit(0)
  }

  let db: Database.Database
  let l3Slugs: Set<string>
  let totalNotes: number

  try {
    db = new Database(DB_PATH, { readonly: true, fileMustExist: true })
    db.pragma("query_only = ON")
  } catch (err) {
    console.error("[l3-visibility] DB open failed:", err)
    process.exit(1)
  }

  try {
    l3Slugs = getL3NoteSlugs(db)
  } catch {
    // getL3NoteSlugs itself handles missing table gracefully — this is a belt+suspenders catch
    console.log(
      "graph_levels 테이블이 없습니다. `bun run refresh` 또는 `bun run scripts/export-graph.ts` 를 먼저 실행하세요.",
    )
    db.close()
    process.exit(0)
  }

  // Check if graph_levels returned empty because table is missing (warn was printed)
  // vs genuinely empty. We distinguish by re-checking the table directly.
  let tableExists = true
  try {
    db.prepare("SELECT 1 FROM graph_levels LIMIT 1").get()
  } catch {
    tableExists = false
  }

  if (!tableExists) {
    console.log(
      "graph_levels 테이블이 없습니다. `bun run refresh` 또는 `bun run scripts/export-graph.ts` 를 먼저 실행하세요.",
    )
    db.close()
    process.exit(0)
  }

  // Get total note count for percentage display
  try {
    const row = db
      .prepare(
        "SELECT COUNT(*) as cnt FROM notes WHERE folder_path = 'content/notes'",
      )
      .get() as { cnt: number } | undefined
    totalNotes = row?.cnt ?? 0
  } catch {
    totalNotes = 0
  }

  db.close()

  // Empty state
  if (l3Slugs.size === 0) {
    console.log(
      "L3 노트 0개. PageRank 결과가 비어있거나 export-graph가 아직 실행되지 않았습니다.",
    )
    console.log("먼저 `bun run refresh` 를 실행해 주세요.")
    process.exit(0)
  }

  // Build preview list (up to 3 examples)
  const examples = [...l3Slugs].slice(0, 3).join(", ")
  const moreSuffix = l3Slugs.size > 3 ? " ..." : ""
  const pct = totalNotes > 0 ? Math.round((l3Slugs.size / totalNotes) * 100) : 0

  // Display header
  console.log(`현재 모드: ${currentMode}`)
  console.log(
    `L3 노트: ${l3Slugs.size}개 (전체 ${totalNotes}개 중 ${pct}%)`,
  )
  console.log(`└ 예시: ${examples}${moreSuffix}`)
  console.log()
  console.log("이 노트들을 어떻게 노출할까요?")

  const currentMarker = (mode: L3Visibility) =>
    currentMode === mode ? " (현재)" : ""

  console.log(
    `  [f] full           — ${MODE_LABELS["full"]}${currentMarker("full")}`,
  )
  console.log(
    `  [k] keyword-only   — ${MODE_LABELS["keyword-only"]}${currentMarker("keyword-only")}`,
  )
  console.log(
    `  [h] hidden         — ${MODE_LABELS["hidden"]}${currentMarker("hidden")}`,
  )
  console.log()

  // Await single character input
  const rl = createInterface({ input: process.stdin, output: process.stdout })

  const choice = await new Promise<string>((resolve) => {
    process.stdout.write("선택 (f/k/h, c=취소): ")
    process.stdin.setRawMode?.(true)
    process.stdin.resume()
    process.stdin.once("data", (data: Buffer) => {
      const char = data.toString().toLowerCase().trim()
      resolve(char)
    })
  })

  process.stdin.setRawMode?.(false)
  rl.close()
  console.log() // newline after char input

  const modeMap: Record<string, L3Visibility> = {
    f: "full",
    k: "keyword-only",
    h: "hidden",
  }

  if (choice === "c" || choice === "") {
    console.log("취소됨.")
    process.exit(0)
  }

  const selectedMode = modeMap[choice]
  if (!selectedMode) {
    console.error(`알 수 없는 선택: '${choice}'. f, k, h, c 중 하나를 선택하세요.`)
    process.exit(1)
  }

  // Write config atomically
  writeConfigAtomic(selectedMode)

  console.log(`→ ${selectedMode} 적용. \`bun run refresh\` 실행하세요.`)
  process.exit(0)
}

main().catch((err) => {
  console.error("[l3-visibility] unexpected error:", err)
  process.exit(1)
})
