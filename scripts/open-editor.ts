/**
 * /edit — open `content/` as an Obsidian vault.
 *
 * meshblog's editing story is Obsidian, not a bespoke editor: wikilinks,
 * backlinks, graph, and properties come for free and match the concept-mesh
 * model the site renders. This launches Obsidian on the repo's `content/`
 * folder, with a 3-tier fallback so a fresh fork on any platform gets *some*
 * useful behaviour instead of a silent no-op.
 *
 * Launch decision splits into PURE functions (path conversion, URI assembly,
 * command selection — unit-tested) and one IMPURE orchestrator (`launch`) that
 * runs execSync and is mocked in tests. GUI launch itself is not CI-testable;
 * it is covered by a one-time manual smoke (prompt_plan §5 2.5).
 *
 *   FALLBACK CHAIN (each step logged)
 *     Tier 1  obsidian://open?path=<vault>   — needs Obsidian + registered vault
 *        │ (a URI no-op can't be detected; --folder forces tier 2)
 *     Tier 2  open vault folder in file manager — always visible; drag into Obsidian
 *        │ (no Obsidian detected, or tier 1 failed)
 *     Tier 3  print install URL + manual steps
 *
 * Reuses the platform/WSL spawn shape from scripts/init.ts rather than
 * reinventing it.
 */

import { execSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'

export const OBSIDIAN_DOWNLOAD_URL = 'https://obsidian.md/download'

// ── Pure: WSL detection (mirrors init.ts platform handling) ───────────────────

export function isWsl(platform: NodeJS.Platform, procVersion: string): boolean {
  if (platform !== 'linux') return false
  return /microsoft/i.test(procVersion)
}

// ── Pure: POSIX → Windows path ───────────────────────────────────────────────

/**
 * Convert a WSL POSIX path to a Windows path: `/mnt/d/projects/meshblog` →
 * `D:\projects\meshblog`. Non-`/mnt/<drive>/` paths pass through unchanged
 * (already-Windows or native). Deterministic — unit-testable without shelling
 * out to `wslpath`.
 */
export function toWinPath(posixPath: string): string {
  const m = /^\/mnt\/([a-zA-Z])\/(.*)$/.exec(posixPath)
  if (!m) return posixPath
  const drive = m[1].toUpperCase()
  const rest = m[2].replace(/\//g, '\\')
  return `${drive}:\\${rest}`
}

// ── Pure: obsidian:// URI ────────────────────────────────────────────────────

/**
 * Build `obsidian://open?path=<urlencoded>`. Fully URL-encodes so spaces,
 * backslashes, and unicode survive (a vault under `D:\My Notes\…` would
 * otherwise produce a malformed URI).
 */
export function buildObsidianUri(vaultPath: string): string {
  return `obsidian://open?path=${encodeURIComponent(vaultPath)}`
}

// ── Pure: per-platform launch command ────────────────────────────────────────

export type Tier = 'uri' | 'folder'

/**
 * Shell command for a given fallback tier, or null when this tier has no
 * command on this platform (caller advances). Pure: everything via arguments.
 */
export function selectLaunchCommand(
  tier: Tier,
  platform: NodeJS.Platform,
  wsl: boolean,
  args: { uri: string; folderWin: string; folderPosix: string },
): string | null {
  if (tier === 'uri') {
    if (wsl || platform === 'win32') return `cmd.exe /c start "" "${args.uri}"`
    if (platform === 'darwin') return `open "${args.uri}"`
    if (platform === 'linux') return `xdg-open "${args.uri}"`
    return null
  }
  // tier === 'folder'
  if (wsl || platform === 'win32') return `explorer.exe "${args.folderWin}"`
  if (platform === 'darwin') return `open "${args.folderPosix}"`
  if (platform === 'linux') return `xdg-open "${args.folderPosix}"`
  return null
}

// ── Pure-ish: Obsidian detection (injectable file check) ─────────────────────

/**
 * Best-effort "is Obsidian installed" check. WSL/win32 → Windows config dir or
 * exe; darwin → .app bundle; linux → config dir. `pathExists` injected for
 * tests. A false is a soft signal (detection can miss non-standard installs),
 * so the caller still warns rather than hard-failing.
 */
export function detectObsidian(
  platform: NodeJS.Platform,
  wsl: boolean,
  homeWin: string | null,
  homePosix: string,
  pathExists: (p: string) => boolean,
): boolean {
  const candidates: string[] = []
  if (wsl || platform === 'win32') {
    if (homeWin) {
      candidates.push(
        `${homeWin}\\AppData\\Roaming\\obsidian`,
        `${homeWin}\\AppData\\Local\\Obsidian\\Obsidian.exe`,
        `${homeWin}\\AppData\\Local\\Programs\\Obsidian\\Obsidian.exe`,
      )
    }
  } else if (platform === 'darwin') {
    candidates.push('/Applications/Obsidian.app', `${homePosix}/Applications/Obsidian.app`)
  } else {
    candidates.push(`${homePosix}/.config/obsidian`, `${homePosix}/.var/app/md.obsidian.Obsidian`)
  }
  return candidates.some(pathExists)
}

// ── Impure: orchestrator ─────────────────────────────────────────────────────

function tryExec(cmd: string): boolean {
  try {
    execSync(cmd, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

export interface LaunchDeps {
  platform: NodeJS.Platform
  procVersion: string
  vaultPosix: string
  homeWin: string | null
  homePosix: string
  pathExists: (p: string) => boolean
  exec: (cmd: string) => boolean
  log: (msg: string) => void
}

/**
 * Run the 3-tier fallback. Returns the tier that ran. Pure inputs via deps so
 * the whole flow is unit-testable with a mocked exec.
 */
export function launch(deps: LaunchDeps): 'uri' | 'folder' | 'install' {
  const wsl = isWsl(deps.platform, deps.procVersion)
  const folderWin = toWinPath(deps.vaultPosix)
  const uri = buildObsidianUri(folderWin)
  const args = { uri, folderWin, folderPosix: deps.vaultPosix }

  const installed = detectObsidian(deps.platform, wsl, deps.homeWin, deps.homePosix, deps.pathExists)

  if (!installed) {
    deps.log(`[edit] Obsidian not detected. Install it: ${OBSIDIAN_DOWNLOAD_URL}`)
    deps.log(`[edit] Then re-run \`bun run edit\`, or open this folder manually: ${deps.vaultPosix}`)
    return 'install'
  }

  // Tier 1 — obsidian:// URI
  const uriCmd = selectLaunchCommand('uri', deps.platform, wsl, args)
  if (uriCmd && deps.exec(uriCmd)) {
    deps.log(`[edit] Opening Obsidian on ${deps.vaultPosix}`)
    deps.log(
      `[edit] If nothing opened, the vault may not be registered yet — run ` +
        `\`bun run edit --folder\` and drag the folder into Obsidian once.`,
    )
    return 'uri'
  }

  // Tier 2 — open the folder in the file manager
  const folderCmd = selectLaunchCommand('folder', deps.platform, wsl, args)
  if (folderCmd && deps.exec(folderCmd)) {
    deps.log(`[edit] Opened the vault folder. In Obsidian: "Open folder as vault".`)
    return 'folder'
  }

  // Tier 3 — give up with instructions
  deps.log(`[edit] Could not launch automatically. Open this folder in Obsidian: ${deps.vaultPosix}`)
  return 'install'
}

// ── CLI entry ────────────────────────────────────────────────────────────────

function safeRead(p: string): string {
  try {
    return fs.readFileSync(p, 'utf8')
  } catch {
    return ''
  }
}

/**
 * Resolve the Windows user home from a WSL/win32 environment so detectObsidian
 * can look under AppData. Best-effort; returns null when undeterminable.
 */
function resolveWinHome(platform: NodeJS.Platform, wsl: boolean): string | null {
  if (platform === 'win32') return process.env.USERPROFILE ?? null
  if (!wsl) return null
  try {
    const users = fs
      .readdirSync('/mnt/c/Users', { withFileTypes: true })
      .filter((d) => d.isDirectory() && !['Public', 'Default', 'All Users'].includes(d.name))
    if (users.length === 1) return `C:\\Users\\${users[0].name}`
    const hit = users.find((u) => {
      try {
        return fs.existsSync(`/mnt/c/Users/${u.name}/AppData/Roaming/obsidian`)
      } catch {
        return false
      }
    })
    return hit ? `C:\\Users\\${hit.name}` : null
  } catch {
    return null
  }
}

function main(): void {
  const repoRoot = process.cwd()
  const vaultPosix = path.join(repoRoot, 'content')
  if (!fs.existsSync(vaultPosix)) {
    console.error(`[edit] No content/ directory at ${vaultPosix} — run from the repo root.`)
    process.exit(1)
  }

  const argv = process.argv.slice(2)
  const folderOnly = argv.includes('--folder')
  const withDev = argv.includes('--with-dev')

  const platform = process.platform
  const procVersion = platform === 'linux' ? safeRead('/proc/version') : ''
  const wsl = isWsl(platform, procVersion)
  const homePosix = process.env.HOME ?? ''
  const homeWin = resolveWinHome(platform, wsl)

  if (folderOnly) {
    const folderWin = toWinPath(vaultPosix)
    const cmd = selectLaunchCommand('folder', platform, wsl, {
      uri: '',
      folderWin,
      folderPosix: vaultPosix,
    })
    if (cmd && tryExec(cmd)) {
      console.log(`[edit] Opened ${vaultPosix} — in Obsidian: "Open folder as vault".`)
    } else {
      console.log(`[edit] Open this folder in Obsidian manually: ${vaultPosix}`)
    }
  } else {
    launch({
      platform,
      procVersion,
      vaultPosix,
      homeWin,
      homePosix,
      pathExists: (p) => {
        try {
          return fs.existsSync(p)
        } catch {
          return false
        }
      },
      exec: tryExec,
      log: (m) => console.log(m),
    })
  }

  if (withDev) {
    console.log(`[edit] Starting dev server — open http://localhost:4321/meshblog/`)
    try {
      execSync('bun run dev', { stdio: 'inherit' })
    } catch {
      // dev server exits on Ctrl-C; nothing to do.
    }
  } else {
    console.log(`[edit] Tip: \`bun run edit --with-dev\` also starts the live preview.`)
  }
}

// Run main() only when executed directly, not when imported by tests. The argv
// check is the portable guard (mirrors scripts/init.ts) — it stays false under
// vitest, whose argv[1] is the vitest binary.
const invokedDirectly = process.argv[1]?.includes('open-editor') ?? false
if (invokedDirectly) {
  main()
}
