/**
 * scripts/init.ts — D1 init skill
 *
 * One-time setup for a meshblog fork:
 *  1. Prompt for Obsidian vault absolute path (validates existence)
 *  2. Prompt for GitHub repo name (optional, auto-detects from git remote)
 *  3. Symlink content/notes/ → vault path (fallback: cpSync + fs.watch on EPERM/EACCES)
 *  4. Write .env.local template if missing
 *  5. Verify .github/workflows/deploy.yml exists (generate minimal one if not)
 *  6. Build the site: real (keyless) pipeline when the vault has notes,
 *     fixture fallback only when it's empty, then spawn `bun run dev`
 *
 * Note on readline: we use the base `node:readline` API and consume its
 * async-iterator output. The promise-based `readline/promises` wrapper hangs
 * on the second `rl.question` call under piped stdin in Bun — which made every
 * scripted rehearsal silently no-op after the first prompt.
 */

import * as fs from "node:fs"
import * as net from "node:net"
import * as path from "node:path"
import { createInterface, type Interface as ReadlineInterface } from "node:readline"
import { execSync, spawn } from "node:child_process"

// ── Constants ─────────────────────────────────────────────────────────────────

const REPO_ROOT = path.resolve(import.meta.dirname, "..")
const CONTENT_NOTES = path.join(REPO_ROOT, "content", "notes")
const ENV_LOCAL = path.join(REPO_ROOT, ".env.local")
const DEPLOY_YML = path.join(REPO_ROOT, ".github", "workflows", "deploy.yml")
const ASTRO_CONFIG = path.join(REPO_ROOT, "astro.config.mjs")

// ── Platform-scoped spawn options (test seam) ────────────────────────────────

/**
 * Dev server spawn options per platform.
 *
 * Windows puts parent + child in the same job object with `detached: false`,
 * so when the parent `process.exit(0)`s (which /init does after print-and-spawn),
 * the kernel kills the orphaned child immediately. `detached: true` creates a
 * new console + process group, letting the child survive. `stdio: "ignore"`
 * is required for new-console detachment on Windows — it gives up log streaming
 * in exchange for the server actually staying up.
 *
 * On non-Windows, `detached: false` + `stdio: "inherit"` preserves the current
 * behavior: dev logs stream to the operator's terminal.
 */
export function getDevSpawnOptions(
  platform: NodeJS.Platform,
): { detached: boolean; stdio: "inherit" | "ignore" } {
  if (platform === "win32") {
    return { detached: true, stdio: "ignore" }
  }
  return { detached: false, stdio: "inherit" }
}

// ── astro.config.mjs base parser (test seam) ──────────────────────────────────

/**
 * Extract the subpath from `base: '/foo'` or `base: "/foo"` in astro.config.mjs.
 * Returns the slug without slashes, or null if the field is missing or expressed
 * as anything other than an immediate string literal.
 *
 * Only matches when `base:` is directly followed by whitespace and a quoted
 * string literal. Template literals, function calls, and env-based expressions
 * (`process.env.BASE ?? '/default'`) return null. Accepted as-is because:
 * (a) /init's caller always falls back to `/meshblog/` + a stderr warning
 *     when this returns null, so downstream is safe,
 * (b) full JS parsing here is scope creep for a one-shot read at init time.
 */
export function parseAstroBase(content: string): string | null {
  const m = content.match(/base:\s*['"]\/([^'"]+)['"]/)
  return m?.[1] ?? null
}

// ── Exported helper for unit tests ────────────────────────────────────────────

/**
 * Materialize vaultPath into target as a real directory (not a symlink) and
 * start a watcher that mirrors subsequent vault edits.
 *
 * Symlinks were the original design, but `git add .` serializes a symlink as
 * its literal target path, so `git push` ships a dangling reference; CI's
 * build-index then reads 0 markdown files from content/notes/ and the
 * fork user sees only the baseline posts on live. Always copying makes the
 * publish path work out of the box. The watcher preserves the "vault is the
 * source of truth" mental model — Obsidian edits still flow through.
 */
export function linkVault(
  vaultPath: string,
  target: string,
  opts: { skipWatch?: boolean } = {},
): void {
  // /init is documented as one-time setup (SKILL.md). Any existing state at
  // `target` is either a stale symlink from a previous run, or the placeholder
  // content/notes/ that ships with a fresh degit — both are safe to replace.
  if (fs.existsSync(target)) {
    const stat = fs.lstatSync(target)
    if (stat.isSymbolicLink()) {
      fs.unlinkSync(target)
    } else if (stat.isDirectory()) {
      fs.rmSync(target, { recursive: true, force: true })
    }
  }

  fs.mkdirSync(target, { recursive: true })
  fs.cpSync(vaultPath, target, { recursive: true })
  console.log(`[init] Copied vault contents into ${target}`)

  // Test seam: tests exercise copy semantics without the persistent watcher
  // (fs.watch keeps the event loop alive and hangs vitest on teardown).
  if (opts.skipWatch) return

  fs.watch(vaultPath, { recursive: true }, (event, filename) => {
    if (!filename) return
    const src = path.join(vaultPath, filename)
    const dst = path.join(target, filename)
    try {
      if (fs.existsSync(src)) {
        const dstDir = path.dirname(dst)
        fs.mkdirSync(dstDir, { recursive: true })
        fs.copyFileSync(src, dst)
      }
    } catch {
      // Silently skip transient errors (file deleted mid-copy, etc.)
    }
  })
  console.log(`[init] Watching ${vaultPath} — edits will mirror into ${target}`)
}

/**
 * Count markdown files under a vault, recursively. Skips dot-directories
 * (`.obsidian`, `.git`, `.trash`, …) so Obsidian metadata doesn't inflate the
 * count. Returns 0 for a missing directory — used by main() to branch between
 * the real-vault build and the fixture fallback.
 */
export function countVaultMarkdown(dir: string): number {
  if (!fs.existsSync(dir)) return 0
  let n = 0
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      n += countVaultMarkdown(full)
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      n++
    }
  }
  return n
}

/**
 * Return a `ask(prompt)` function that reads one line per call from the
 * readline interface's async iterator. Works under both TTY and piped stdin;
 * the `readline/promises` variant hangs on the second call under piped stdin
 * in Bun (empirically verified 2026-04-22).
 */
export function createAskFn(rl: ReadlineInterface): (prompt: string) => Promise<string> {
  const iter = rl[Symbol.asyncIterator]()
  return async (prompt: string): Promise<string> => {
    process.stdout.write(prompt)
    const { value, done } = await iter.next()
    return done ? "" : String(value)
  }
}

// ── Git remote detection ───────────────────────────────────────────────────────

function detectGitRemote(): string | null {
  try {
    const remote = execSync("git remote get-url origin", {
      cwd: REPO_ROOT,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim()
    // Extract owner/repo from HTTPS or SSH URL
    const httpsMatch = remote.match(/github\.com[/:]([^/]+\/[^/.]+)(?:\.git)?$/)
    if (httpsMatch) return httpsMatch[1]
    return null
  } catch {
    return null
  }
}

// ── .env.local ────────────────────────────────────────────────────────────────

function writeEnvLocal(): void {
  if (fs.existsSync(ENV_LOCAL)) {
    console.log("[init] .env.local already exists — skipping")
    return
  }
  const content = `# meshblog local environment
# Optional — enables embeddings + Q&A generation
# OPENAI_API_KEY=sk-...
`
  fs.writeFileSync(ENV_LOCAL, content, "utf-8")
  console.log("[init] Created .env.local template")
}

// ── deploy.yml ────────────────────────────────────────────────────────────────

const MINIMAL_DEPLOY_YML = `name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.x

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Prepare runtime dirs
        run: mkdir -p .data public/graph public/og content/notes content/posts

      - name: Build index (skip embeddings when key missing)
        run: |
          if [ -n "\${OPENAI_API_KEY:-}" ]; then
            bun run build-index
          else
            echo "::warning::OPENAI_API_KEY missing — running build-index with --skip-embed --skip-concepts"
            bun run build-index -- --skip-embed --skip-concepts
          fi
        env:
          OPENAI_API_KEY: \${{ secrets.OPENAI_API_KEY }}

      - name: Export graph
        run: bun run export-graph

      - name: Astro build
        run: bunx astro build
        env:
          OPENAI_API_KEY: \${{ secrets.OPENAI_API_KEY }}
          NODE_ENV: production

      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
`

function verifyDeployYml(repoName: string | null): void {
  if (fs.existsSync(DEPLOY_YML)) {
    console.log("[init] .github/workflows/deploy.yml already exists — leaving untouched")
    return
  }
  fs.mkdirSync(path.dirname(DEPLOY_YML), { recursive: true })
  fs.writeFileSync(DEPLOY_YML, MINIMAL_DEPLOY_YML, "utf-8")
  console.log("[init] Generated minimal .github/workflows/deploy.yml")
  if (repoName) {
    console.log(`[init] Remember to enable GitHub Pages in Settings → Pages for ${repoName}`)
  }
}

// ── Prompt helpers ────────────────────────────────────────────────────────────

type Ask = (prompt: string) => Promise<string>

async function promptVaultPath(ask: Ask): Promise<string> {
  while (true) {
    const input = (await ask("Obsidian vault absolute path: ")).trim()
    if (!input) {
      console.error("[init] Path cannot be empty. Please enter an absolute path.")
      continue
    }
    if (!path.isAbsolute(input)) {
      console.error("[init] Must be an absolute path (e.g. /home/user/MyVault or C:\\Users\\…\\MyVault).")
      continue
    }
    if (!fs.existsSync(input)) {
      console.error(`[init] Directory not found: ${input}`)
      continue
    }
    const stat = fs.statSync(input)
    if (!stat.isDirectory()) {
      console.error(`[init] Not a directory: ${input}`)
      continue
    }
    return input
  }
}

async function promptRepoName(ask: Ask): Promise<string | null> {
  const detected = detectGitRemote()
  const hint = detected ? ` [${detected}]` : " [e.g. JaeyeonBang/meshblog]"
  const input = (
    await ask(`GitHub repo name (owner/name)${hint} — Enter to ${detected ? "accept detected" : "skip"}: `)
  ).trim()

  if (!input) return detected
  if (!/^[^/]+\/[^/]+$/.test(input)) {
    console.warn("[init] Repo name should be in owner/name format — recorded as-is.")
  }
  return input
}

// ── Main entry ────────────────────────────────────────────────────────────────

/**
 * Options for `runInit`. All fields optional — when omitted, the behavior
 * matches the original interactive `/init` flow.
 *
 * Tests use `vaultPath` + `repoName` to bypass readline prompts, and
 * `skipSpawn` to return before launching the dev server (no background
 * processes to clean up).
 */
export interface RunInitOptions {
  vaultPath?: string
  repoName?: string | null
  skipSpawn?: boolean
}

export async function runInit(opts: RunInitOptions = {}): Promise<void> {
  console.log("\n=== meshblog /init ===\n")

  const rl = createInterface({ input: process.stdin })
  const ask = createAskFn(rl)

  try {
    // 1. Vault path
    const vaultPath = opts.vaultPath ?? (await promptVaultPath(ask))

    // 2. GitHub repo name
    const repoName =
      opts.repoName !== undefined ? opts.repoName : await promptRepoName(ask)

    rl.close()

    console.log("")

    // 3. Link vault
    linkVault(vaultPath, CONTENT_NOTES)

    // 4. Write .env.local
    writeEnvLocal()

    // 5. Verify deploy.yml
    verifyDeployYml(repoName)

    // 6. Build the site. Keyless users still see their real vault — the
    //    fixture seed is only used when the vault is genuinely empty.
    //    Both paths need the runtime dirs that CI creates explicitly; on a
    //    fresh degit these don't exist yet.
    for (const dir of [".data", "public/graph", "public/og"]) {
      fs.mkdirSync(path.join(REPO_ROOT, dir), { recursive: true })
    }

    const vaultNotes = countVaultMarkdown(vaultPath)
    console.log(`\n[init] Vault contains ${vaultNotes} markdown file(s)`)

    if (vaultNotes === 0) {
      console.log("[init] Empty vault — falling back to fixture build")
      execSync("bun run build:fixture", {
        cwd: REPO_ROOT,
        stdio: "inherit",
        env: { ...process.env },
      })
    } else {
      // Pipeline mirrors package.json's `refresh` script so forks produce
      // the same artifacts CI does on `main` pushes:
      //   tokens → index → backlinks → graph → og → astro build
      //
      // - build-tokens: design.md → src/styles/tokens.css (stale CSS otherwise)
      // - build-index: markdown → SQLite (--skip-embed --skip-concepts keyless)
      // - build-backlinks: wikilinks → public/graph/backlinks.json (empty
      //   Backlinks mode on /graph otherwise)
      // - export-graph: SQLite → public/graph/{notes,concepts}.json
      // - build-og: OG images for link previews (missing otherwise)
      // - astro build: final static site
      console.log("[init] Running keyless build pipeline …")
      const pipeline: Array<[string, string]> = [
        ["build-tokens", "bun run build-tokens"],
        ["build-index", "bun run build-index -- --skip-embed --skip-concepts"],
        ["build-backlinks", "bun run build-backlinks"],
        ["export-graph", "bun run export-graph"],
        ["build-og", "bun run build-og"],
        ["astro build", "bunx astro build"],
      ]
      for (const [label, cmd] of pipeline) {
        console.log(`[init] ${label} …`)
        execSync(cmd, {
          cwd: REPO_ROOT,
          stdio: "inherit",
          env:
            label === "astro build"
              ? { ...process.env, NODE_ENV: "production" }
              : { ...process.env },
        })
      }
    }

    if (opts.skipSpawn) {
      console.log("\n[init] Done (skipSpawn mode — dev server not started).\n")
      return
    }

    // 7. Spawn dev server (non-blocking). Platform-specific options: see
    //    getDevSpawnOptions jsdoc for why Windows needs detached:true.
    console.log("\n[init] Starting dev server …")
    const spawnOpts = getDevSpawnOptions(process.platform)
    const dev = spawn("bun", ["run", "dev"], {
      cwd: REPO_ROOT,
      ...spawnOpts,
      env: { ...process.env },
    })
    dev.unref()

    // Write the PID so the orphaned dev server can be stopped without
    // hunting through Task Manager. Windows especially — detached:true
    // means no parent-child link, and `bun run dev` spawns nested
    // processes, so we record the spawn-level PID and tell the operator
    // how to kill it.
    if (dev.pid !== undefined) {
      const pidPath = path.join(REPO_ROOT, ".init-dev.pid")
      try {
        fs.writeFileSync(pidPath, String(dev.pid), "utf-8")
        console.log(`[init] dev PID ${dev.pid} written to .init-dev.pid`)
        if (process.platform === "win32") {
          console.log(
            "[init] To stop: Stop-Process -Id (Get-Content .init-dev.pid)",
          )
        } else {
          console.log("[init] To stop: kill $(cat .init-dev.pid)")
        }
      } catch (err) {
        console.error(`[init] WARNING: could not write .init-dev.pid: ${err}`)
      }
    }

    // Resolve the site's base path from astro.config.mjs. Forks with custom
    // repo names patch this field; old behavior hardcoded /meshblog/ and
    // printed a URL that 404'd. Fall back to /meshblog/ (original default)
    // when the file is missing or the base field is dynamic — with a stderr
    // warning so the drift is not silent.
    const baseSlug = resolveAstroBase()
    const openUrl = `http://localhost:4321/${baseSlug}/`

    // Probe port 4321 so silent spawn failures (missing bun, port in use,
    // astro crash) become visible before we tell the operator "Open: ...".
    // Fail-soft: the dev server may still be booting at probe time; a failed
    // probe is a warning, not an error exit.
    const probeOk = await probePort(4321, 2000)
    if (probeOk) {
      console.log(`\n[init] Done. Open: ${openUrl}\n`)
    } else {
      console.error(
        `\n[init] WARNING: dev server not responding on port 4321 after 2s. ` +
          `PID ${dev.pid ?? "?"}. The server may still be starting — try opening ` +
          `${openUrl} in a moment. If it stays unreachable, ` +
          `check that bun is on PATH and port 4321 is free.\n`,
      )
    }
  } catch (err) {
    rl.close()
    throw err
  }
}

/**
 * Read astro.config.mjs and return the base slug (no slashes) via
 * parseAstroBase. Falls back to "meshblog" with a stderr warning when the
 * file is missing or the base field can't be parsed — so a silent drift
 * (e.g., someone switches to a template literal) surfaces immediately
 * instead of producing a 404 URL.
 */
function resolveAstroBase(): string {
  try {
    if (!fs.existsSync(ASTRO_CONFIG)) {
      console.error(
        "[init] WARNING: astro.config.mjs not found — using default base /meshblog/",
      )
      return "meshblog"
    }
    const content = fs.readFileSync(ASTRO_CONFIG, "utf-8")
    const parsed = parseAstroBase(content)
    if (parsed === null) {
      console.error(
        "[init] WARNING: could not parse astro.config.mjs base field " +
          "(dynamic expression?) — falling back to /meshblog/",
      )
      return "meshblog"
    }
    return parsed
  } catch (err) {
    console.error(`[init] WARNING: failed to read astro.config.mjs: ${err}`)
    return "meshblog"
  }
}

/**
 * Probe TCP port with timeout. Returns true on connect, false on timeout or
 * ECONNREFUSED. Used after dev spawn to catch silent startup failures.
 */
function probePort(port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    const done = (ok: boolean) => {
      socket.destroy()
      resolve(ok)
    }
    socket.setTimeout(timeoutMs)
    socket.once("connect", () => done(true))
    socket.once("timeout", () => done(false))
    socket.once("error", () => done(false))
    socket.connect(port, "127.0.0.1")
  })
}

async function main(): Promise<void> {
  try {
    await runInit()
    process.exit(0)
  } catch (err) {
    console.error("[init] Fatal error:", err)
    process.exit(1)
  }
}

// Run only when executed directly
const isMain =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("init.ts")

if (isMain) {
  main()
}
