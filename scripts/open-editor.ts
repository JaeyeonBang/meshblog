/**
 * /edit — open `content/` as an Obsidian vault.
 *
 * meshblog's editing story is Obsidian, not a bespoke editor: wikilinks,
 * backlinks, graph, and properties come for free and match the concept-mesh
 * model the site renders. This launches Obsidian on the repo's `content/`
 * folder, with a fallback chain so any platform gets *some* useful behaviour
 * instead of a silent no-op.
 *
 * Launch decision splits into PURE functions (path conversion, URI assembly,
 * registry-output parsing, command selection — unit-tested) and one IMPURE
 * orchestrator (`launch`) that shells out and is mocked in tests. GUI launch
 * itself is not CI-testable; it is covered by a one-time manual smoke.
 *
 *   FALLBACK CHAIN (each step logged)
 *     Tier 1  Obsidian.exe <uri>   — direct exe + URI; works for non-standard
 *        │                           install dirs (e.g. D:\Program Files) and
 *        │                           registers/opens the vault on first run.
 *     Tier 2  obsidian:// URI via shell — when the exe path is unknown but
 *        │                               Obsidian is installed + URI-registered.
 *     Tier 3  open vault folder in file manager — drag into Obsidian once.
 *     Tier 4  print install URL + manual steps.
 *
 * Why direct-exe is tier 1 on Windows: a fresh `content/` vault is not in
 * Obsidian's vault list, so the bare `obsidian://open?path=` URI is refused by
 * the protocol handler. Invoking the exe with the URI makes Obsidian register
 * the path and open it. The exe also lives outside %LOCALAPPDATA% for many
 * installs (D:\Program Files\…), which the old AppData-only probe missed.
 *
 * Commands are modelled as {file, args[]} and run via execFileSync (NO shell).
 * This was a real bug source: routing PowerShell through `sh -c "...$_..."`
 * ate the `$_` pipeline variables (registry query returned empty), and
 * `cmd.exe start "" "<path with spaces>"` treated the path as a window title.
 * Argv arrays sidestep both quoting hazards entirely.
 */

import { execFileSync, spawn } from 'node:child_process'
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

// ── Pure: Windows path → WSL POSIX path ──────────────────────────────────────

/**
 * Inverse of toWinPath: `D:\Program Files\Obsidian\Obsidian.exe` →
 * `/mnt/d/Program Files/Obsidian/Obsidian.exe`. Used to stat a registry-derived
 * exe path from inside WSL. Non-drive paths pass through unchanged.
 */
export function winToPosix(winPath: string): string {
  const m = /^([a-zA-Z]):\\(.*)$/.exec(winPath)
  if (!m) return winPath
  const drive = m[1].toLowerCase()
  const rest = m[2].replace(/\\/g, '/')
  return `/mnt/${drive}/${rest}`
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

// ── Pure: PowerShell command builders ─────────────────────────────────────────

/** Escape single quotes for a PowerShell single-quoted string ('' = literal '). */
export function psQuote(s: string): string {
  return s.replace(/'/g, "''")
}

/**
 * The registry query as a PowerShell snippet. Exposed for the reader; uses `$_`
 * which is why this must run via execFileSync (argv), never `sh -c`.
 */
export const REGISTRY_PS =
  `(Get-ItemProperty ` +
  `'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',` +
  `'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*' ` +
  `-ErrorAction SilentlyContinue | ` +
  `Where-Object { $_.DisplayName -like '*Obsidian*' } | ` +
  `ForEach-Object { $_.DisplayIcon })`

// ── Pure: parse Obsidian.exe path from registry DisplayIcon output ────────────

/**
 * The Windows uninstall registry stores Obsidian's exe in `DisplayIcon`, e.g.
 * `D:\Program Files\Obsidian\Obsidian.exe,0` (a trailing `,<index>` icon
 * selector). Strip the icon index and surrounding quotes/whitespace. Returns
 * the first line that ends in `Obsidian.exe`, or null.
 *
 * Pure: takes the raw multi-line registry output so it is unit-testable without
 * spawning PowerShell.
 */
export function parseObsidianExeFromRegistry(registryOutput: string): string | null {
  for (const raw of registryOutput.split(/\r?\n/)) {
    let line = raw.trim()
    if (!line) continue
    line = line.replace(/,\d+\s*$/, '') // drop trailing icon index
    line = line.replace(/^"(.*)"$/, '$1').trim() // strip wrapping quotes
    if (/Obsidian\.exe$/i.test(line)) return line
  }
  return null
}

// ── Pure: per-tier launch command (argv form, no shell) ───────────────────────

export type Tier = 'exe' | 'uri' | 'folder'

/** A spawnable command: program + argument vector. No shell interpolation. */
export interface LaunchCommand {
  file: string
  args: string[]
}

/**
 * Build the {file, args[]} command for a tier, or null when this tier has no
 * command on this platform / inputs. Pure: everything via arguments.
 *
 * Windows/WSL uses PowerShell `Start-Process` (handles spaced paths + detaches)
 * passed as an argv array so neither the surrounding shell nor cmd's
 * title-eating `start` can mangle it.
 */
export function selectLaunchCommand(
  tier: Tier,
  platform: NodeJS.Platform,
  wsl: boolean,
  args: { uri: string; exeWin: string | null; folderWin: string; folderPosix: string },
): LaunchCommand | null {
  const win = wsl || platform === 'win32'
  if (tier === 'exe') {
    if (!args.exeWin) return null
    if (win) {
      return {
        file: 'powershell.exe',
        args: [
          '-NoProfile',
          '-Command',
          `Start-Process -FilePath '${psQuote(args.exeWin)}' -ArgumentList '${psQuote(args.uri)}'`,
        ],
      }
    }
    return null // non-Windows resolves the app via uri/open instead
  }
  if (tier === 'uri') {
    if (win) {
      return {
        file: 'powershell.exe',
        args: ['-NoProfile', '-Command', `Start-Process '${psQuote(args.uri)}'`],
      }
    }
    if (platform === 'darwin') return { file: 'open', args: [args.uri] }
    if (platform === 'linux') return { file: 'xdg-open', args: [args.uri] }
    return null
  }
  // tier === 'folder'
  if (win) return { file: 'explorer.exe', args: [args.folderWin] }
  if (platform === 'darwin') return { file: 'open', args: [args.folderPosix] }
  if (platform === 'linux') return { file: 'xdg-open', args: [args.folderPosix] }
  return null
}

// ── Pure-ish: Obsidian discovery (injectable file check + registry reader) ────

export interface ObsidianLocation {
  installed: boolean
  /** Windows-style exe path when known (registry or standard dir), else null. */
  exeWin: string | null
}

/**
 * Locate Obsidian. Order:
 *   1. Registry DisplayIcon (covers non-standard install dirs like D:\…).
 *   2. Standard install dirs under the Windows user home / Applications / config.
 *
 * `readRegistry` returns the raw registry query output (or '' on non-Windows /
 * failure); `pathExists` checks a POSIX path. Both injected for tests.
 */
export function locateObsidian(
  platform: NodeJS.Platform,
  wsl: boolean,
  homeWin: string | null,
  homePosix: string,
  pathExists: (p: string) => boolean,
  readRegistry: () => string,
): ObsidianLocation {
  const win = wsl || platform === 'win32'

  if (win) {
    // 1. Registry.
    const exeWin = parseObsidianExeFromRegistry(readRegistry())
    if (exeWin) {
      const probe = wsl ? winToPosix(exeWin) : exeWin
      if (pathExists(probe)) return { installed: true, exeWin }
    }
    // 2. Standard dirs.
    const stdCandidates: string[] = []
    if (homeWin) {
      stdCandidates.push(
        `${homeWin}\\AppData\\Local\\Obsidian\\Obsidian.exe`,
        `${homeWin}\\AppData\\Local\\Programs\\Obsidian\\Obsidian.exe`,
      )
    }
    for (const c of stdCandidates) {
      const probe = wsl ? winToPosix(c) : c
      if (pathExists(probe)) return { installed: true, exeWin: c }
    }
    // 3. Config dir = installed-but-exe-unknown (URI fallback may still work).
    const cfgWin = homeWin ? `${homeWin}\\AppData\\Roaming\\obsidian` : null
    if (cfgWin && pathExists(wsl ? winToPosix(cfgWin) : cfgWin)) {
      return { installed: true, exeWin: null }
    }
    return { installed: false, exeWin: null }
  }

  if (platform === 'darwin') {
    const apps = ['/Applications/Obsidian.app', `${homePosix}/Applications/Obsidian.app`]
    return { installed: apps.some(pathExists), exeWin: null }
  }

  // linux
  const cfgs = [`${homePosix}/.config/obsidian`, `${homePosix}/.var/app/md.obsidian.Obsidian`]
  return { installed: cfgs.some(pathExists), exeWin: null }
}

// ── Impure: orchestrator ─────────────────────────────────────────────────────

/**
 * Fire-and-forget launch. Detached + unref'd so the GUI app outlives this
 * short-lived `bun run edit` process — otherwise the kernel tears the child
 * down with the parent's process group on Windows (same reason init.ts spawns
 * the dev server detached; see getDevSpawnOptions there).
 *
 * GUI launch has no meaningful exit code (Start-Process / explorer return 0
 * immediately), so success = "spawn didn't synchronously throw". A bad program
 * name (ENOENT) throws synchronously and is reported as failure, letting the
 * fallback chain advance.
 */
function tryExec(cmd: LaunchCommand): boolean {
  try {
    const child = spawn(cmd.file, cmd.args, { detached: true, stdio: 'ignore' })
    let failed = false
    child.on('error', () => {
      failed = true
    })
    // ENOENT surfaces synchronously on the 'error' event in the same tick for
    // a missing binary; give it a microtask before unref. In practice spawn
    // throws synchronously for an unknown file on Windows, caught below.
    if (failed) return false
    child.unref()
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
  readRegistry: () => string
  exec: (cmd: LaunchCommand) => boolean
  log: (msg: string) => void
}

/**
 * Run the fallback chain. Returns the tier that ran. Pure inputs via deps so the
 * whole flow is unit-testable with a mocked exec + registry reader.
 */
export function launch(deps: LaunchDeps): 'exe' | 'uri' | 'folder' | 'install' {
  const wsl = isWsl(deps.platform, deps.procVersion)
  const folderWin = toWinPath(deps.vaultPosix)
  const uri = buildObsidianUri(folderWin)

  const loc = locateObsidian(
    deps.platform,
    wsl,
    deps.homeWin,
    deps.homePosix,
    deps.pathExists,
    deps.readRegistry,
  )

  const args = { uri, exeWin: loc.exeWin, folderWin, folderPosix: deps.vaultPosix }

  if (!loc.installed) {
    deps.log(`[edit] Obsidian not detected. Install it: ${OBSIDIAN_DOWNLOAD_URL}`)
    deps.log(`[edit] Then re-run \`bun run edit\`, or open this folder manually: ${deps.vaultPosix}`)
    return 'install'
  }

  // Tier 1 — direct exe + URI (handles non-standard install dirs + fresh vault).
  const exeCmd = selectLaunchCommand('exe', deps.platform, wsl, args)
  if (exeCmd && deps.exec(exeCmd)) {
    deps.log(`[edit] Opening Obsidian (${loc.exeWin}) on ${deps.vaultPosix}`)
    deps.log(`[edit] First time? In Obsidian, confirm "Open" / "Trust author" for the vault.`)
    return 'exe'
  }

  // Tier 2 — obsidian:// URI via shell (exe path unknown but URI-registered).
  const uriCmd = selectLaunchCommand('uri', deps.platform, wsl, args)
  if (uriCmd && deps.exec(uriCmd)) {
    deps.log(`[edit] Opening Obsidian on ${deps.vaultPosix}`)
    deps.log(
      `[edit] If nothing opened, the vault isn't registered yet — run ` +
        `\`bun run edit --folder\` and use "Open folder as vault" once.`,
    )
    return 'uri'
  }

  // Tier 3 — open the folder in the file manager.
  const folderCmd = selectLaunchCommand('folder', deps.platform, wsl, args)
  if (folderCmd && deps.exec(folderCmd)) {
    deps.log(`[edit] Opened the vault folder. In Obsidian: "Open folder as vault" → ${deps.vaultPosix}`)
    return 'folder'
  }

  // Tier 4 — give up with instructions.
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
 * Query the Windows uninstall registry for Obsidian's exe path. Returns the raw
 * PowerShell output (DisplayIcon lines) or '' on non-Windows / failure. Runs
 * via execFileSync (argv) so PowerShell's `$_` survives — routing through a
 * shell ate it and returned empty.
 */
function readWindowsRegistry(win: boolean): string {
  if (!win) return ''
  try {
    return execFileSync('powershell.exe', ['-NoProfile', '-Command', REGISTRY_PS], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch {
    return ''
  }
}

/**
 * Resolve the Windows user home from a WSL/win32 environment. Best-effort;
 * returns null when undeterminable.
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
  const win = wsl || platform === 'win32'
  const homePosix = process.env.HOME ?? ''
  const homeWin = resolveWinHome(platform, wsl)

  if (folderOnly) {
    const folderWin = toWinPath(vaultPosix)
    const cmd = selectLaunchCommand('folder', platform, wsl, {
      uri: '',
      exeWin: null,
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
      readRegistry: () => readWindowsRegistry(win),
      exec: tryExec,
      log: (m) => console.log(m),
    })
  }

  if (withDev) {
    console.log(`[edit] Starting dev server — open http://localhost:4321/meshblog/`)
    try {
      execFileSync('bun', ['run', 'dev'], { stdio: 'inherit' })
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
