import { describe, it, expect } from 'vitest'
import {
  isWsl,
  toWinPath,
  winToPosix,
  buildObsidianUri,
  parseObsidianExeFromRegistry,
  psQuote,
  selectLaunchCommand,
  locateObsidian,
  launch,
  OBSIDIAN_DOWNLOAD_URL,
  type LaunchCommand,
  type LaunchDeps,
} from '../open-editor'

describe('isWsl', () => {
  it('true only on linux with microsoft in /proc/version', () => {
    expect(isWsl('linux', 'Linux ... microsoft-standard-WSL2 ...')).toBe(true)
    expect(isWsl('linux', 'Linux 6.1.0-generic')).toBe(false)
    expect(isWsl('darwin', 'microsoft')).toBe(false)
    expect(isWsl('win32', 'microsoft')).toBe(false)
  })
})

describe('toWinPath', () => {
  it('converts /mnt/<drive>/ to a Windows path', () => {
    expect(toWinPath('/mnt/d/projects/meshblog')).toBe('D:\\projects\\meshblog')
    expect(toWinPath('/mnt/c/Users/me/vault')).toBe('C:\\Users\\me\\vault')
  })
  it('uppercases the drive letter', () => {
    expect(toWinPath('/mnt/e/x')).toBe('E:\\x')
  })
  it('passes through non-/mnt paths unchanged', () => {
    expect(toWinPath('/home/me/vault')).toBe('/home/me/vault')
    expect(toWinPath('D:\\already\\win')).toBe('D:\\already\\win')
  })
  it('handles a path with spaces (kept literal, encoded later)', () => {
    expect(toWinPath('/mnt/d/My Notes/vault')).toBe('D:\\My Notes\\vault')
  })
})

describe('winToPosix', () => {
  it('converts a Windows drive path to /mnt/<drive>/', () => {
    expect(winToPosix('D:\\Program Files\\Obsidian\\Obsidian.exe')).toBe(
      '/mnt/d/Program Files/Obsidian/Obsidian.exe',
    )
    expect(winToPosix('C:\\Users\\me\\x')).toBe('/mnt/c/Users/me/x')
  })
  it('round-trips with toWinPath', () => {
    expect(toWinPath(winToPosix('E:\\a\\b'))).toBe('E:\\a\\b')
    expect(winToPosix(toWinPath('/mnt/e/a/b'))).toBe('/mnt/e/a/b')
  })
  it('passes through non-drive paths unchanged', () => {
    expect(winToPosix('/home/me/x')).toBe('/home/me/x')
  })
})

describe('buildObsidianUri', () => {
  it('url-encodes the path including backslashes and colon', () => {
    expect(buildObsidianUri('D:\\projects\\meshblog')).toBe(
      'obsidian://open?path=D%3A%5Cprojects%5Cmeshblog',
    )
  })
  it('encodes spaces and unicode', () => {
    expect(buildObsidianUri('D:\\My Notes\\메모')).toBe(
      'obsidian://open?path=' + encodeURIComponent('D:\\My Notes\\메모'),
    )
    expect(buildObsidianUri('D:\\My Notes\\x')).toContain('My%20Notes')
  })
})

describe('parseObsidianExeFromRegistry', () => {
  it('extracts the exe path, dropping the trailing icon index', () => {
    expect(parseObsidianExeFromRegistry('D:\\Program Files\\Obsidian\\Obsidian.exe,0')).toBe(
      'D:\\Program Files\\Obsidian\\Obsidian.exe',
    )
  })
  it('handles paths without an icon index', () => {
    expect(parseObsidianExeFromRegistry('C:\\Users\\me\\AppData\\Local\\Obsidian\\Obsidian.exe')).toBe(
      'C:\\Users\\me\\AppData\\Local\\Obsidian\\Obsidian.exe',
    )
  })
  it('strips wrapping quotes', () => {
    expect(parseObsidianExeFromRegistry('"D:\\P F\\Obsidian\\Obsidian.exe",0')).toBe(
      'D:\\P F\\Obsidian\\Obsidian.exe',
    )
  })
  it('picks the Obsidian.exe line out of multi-line output', () => {
    const out = '\r\nsome-noise\r\nD:\\Program Files\\Obsidian\\Obsidian.exe,0\r\n'
    expect(parseObsidianExeFromRegistry(out)).toBe('D:\\Program Files\\Obsidian\\Obsidian.exe')
  })
  it('returns null when no Obsidian.exe line is present', () => {
    expect(parseObsidianExeFromRegistry('')).toBeNull()
    expect(parseObsidianExeFromRegistry('C:\\Other\\thing.exe,0')).toBeNull()
  })
})

describe('psQuote', () => {
  it('doubles single quotes for PowerShell single-quoted strings', () => {
    expect(psQuote("D:\\it's\\x")).toBe("D:\\it''s\\x")
    expect(psQuote('no quotes')).toBe('no quotes')
  })
})

describe('selectLaunchCommand', () => {
  const args = {
    uri: 'obsidian://open?path=X',
    exeWin: 'D:\\Program Files\\Obsidian\\Obsidian.exe',
    folderWin: 'D:\\v',
    folderPosix: '/mnt/d/v',
  }

  it('exe tier: WSL/win32 → powershell argv Start-Process -FilePath with uri arg', () => {
    const cmd = selectLaunchCommand('exe', 'linux', true, args) as LaunchCommand
    expect(cmd.file).toBe('powershell.exe')
    expect(cmd.args[0]).toBe('-NoProfile')
    expect(cmd.args[1]).toBe('-Command')
    expect(cmd.args[2]).toContain("Start-Process -FilePath 'D:\\Program Files\\Obsidian\\Obsidian.exe'")
    expect(cmd.args[2]).toContain("-ArgumentList 'obsidian://open?path=X'")
  })
  it('exe tier: null when exeWin is null', () => {
    expect(selectLaunchCommand('exe', 'linux', true, { ...args, exeWin: null })).toBeNull()
  })
  it('exe tier: null on non-Windows', () => {
    expect(selectLaunchCommand('exe', 'darwin', false, args)).toBeNull()
    expect(selectLaunchCommand('exe', 'linux', false, args)).toBeNull()
  })

  it('uri tier: WSL/win32 → powershell argv Start-Process <uri>', () => {
    const cmd = selectLaunchCommand('uri', 'linux', true, args) as LaunchCommand
    expect(cmd.file).toBe('powershell.exe')
    expect(cmd.args).toEqual(['-NoProfile', '-Command', "Start-Process 'obsidian://open?path=X'"])
  })
  it('uri tier: darwin → open, linux → xdg-open', () => {
    expect(selectLaunchCommand('uri', 'darwin', false, args)).toEqual({
      file: 'open',
      args: ['obsidian://open?path=X'],
    })
    expect(selectLaunchCommand('uri', 'linux', false, args)).toEqual({
      file: 'xdg-open',
      args: ['obsidian://open?path=X'],
    })
  })
  it('folder tier: WSL/win32 → explorer.exe with the Windows path', () => {
    expect(selectLaunchCommand('folder', 'linux', true, args)).toEqual({
      file: 'explorer.exe',
      args: ['D:\\v'],
    })
    expect(selectLaunchCommand('folder', 'win32', false, args)).toEqual({
      file: 'explorer.exe',
      args: ['D:\\v'],
    })
  })
  it('folder tier: darwin/linux use the posix path', () => {
    expect(selectLaunchCommand('folder', 'darwin', false, args)).toEqual({
      file: 'open',
      args: ['/mnt/d/v'],
    })
    expect(selectLaunchCommand('folder', 'linux', false, args)).toEqual({
      file: 'xdg-open',
      args: ['/mnt/d/v'],
    })
  })
})

describe('locateObsidian', () => {
  const reg = (s: string) => () => s

  it('WSL: finds the exe via registry (non-standard D: install dir)', () => {
    const regOut = 'D:\\Program Files\\Obsidian\\Obsidian.exe,0'
    const exists = (p: string) => p === '/mnt/d/Program Files/Obsidian/Obsidian.exe'
    const loc = locateObsidian('linux', true, 'C:\\Users\\me', '/home/me', exists, reg(regOut))
    expect(loc.installed).toBe(true)
    expect(loc.exeWin).toBe('D:\\Program Files\\Obsidian\\Obsidian.exe')
  })

  it('WSL: registry path that does not exist on disk is ignored, falls to std dir', () => {
    const regOut = 'D:\\Stale\\Obsidian.exe,0'
    const exists = (p: string) => p === '/mnt/c/Users/me/AppData/Local/Obsidian/Obsidian.exe'
    const loc = locateObsidian('linux', true, 'C:\\Users\\me', '/home/me', exists, reg(regOut))
    expect(loc.installed).toBe(true)
    expect(loc.exeWin).toBe('C:\\Users\\me\\AppData\\Local\\Obsidian\\Obsidian.exe')
  })

  it('WSL: config dir only → installed but exe unknown', () => {
    const exists = (p: string) => p === '/mnt/c/Users/me/AppData/Roaming/obsidian'
    const loc = locateObsidian('linux', true, 'C:\\Users\\me', '/home/me', exists, reg(''))
    expect(loc.installed).toBe(true)
    expect(loc.exeWin).toBeNull()
  })

  it('WSL: nothing anywhere → not installed', () => {
    const loc = locateObsidian('linux', true, 'C:\\Users\\me', '/home/me', () => false, reg(''))
    expect(loc.installed).toBe(false)
    expect(loc.exeWin).toBeNull()
  })

  it('darwin: .app bundle present', () => {
    const exists = (p: string) => p === '/Applications/Obsidian.app'
    const loc = locateObsidian('darwin', false, null, '/Users/me', exists, reg(''))
    expect(loc.installed).toBe(true)
    expect(loc.exeWin).toBeNull()
  })

  it('linux: ~/.config/obsidian present', () => {
    const exists = (p: string) => p === '/home/me/.config/obsidian'
    const loc = locateObsidian('linux', false, null, '/home/me', exists, reg(''))
    expect(loc.installed).toBe(true)
  })
})

describe('launch — fallback chain orchestration', () => {
  // Default deps: WSL, Obsidian found via registry at a D: install dir.
  const base = (over: Partial<LaunchDeps>): LaunchDeps => ({
    platform: 'linux',
    procVersion: 'microsoft-WSL2',
    vaultPosix: '/mnt/d/projects/meshblog/content',
    homeWin: 'C:\\Users\\me',
    homePosix: '/home/me',
    pathExists: (p) => p === '/mnt/d/Program Files/Obsidian/Obsidian.exe',
    readRegistry: () => 'D:\\Program Files\\Obsidian\\Obsidian.exe,0',
    exec: () => false,
    log: () => {},
    ...over,
  })

  // Serialize a LaunchCommand for substring assertions.
  const flat = (c: LaunchCommand) => `${c.file} ${c.args.join(' ')}`

  it('not installed → install tier, logs download URL', () => {
    const logs: string[] = []
    const r = launch(
      base({ pathExists: () => false, readRegistry: () => '', log: (m) => logs.push(m) }),
    )
    expect(r).toBe('install')
    expect(logs.join('\n')).toContain(OBSIDIAN_DOWNLOAD_URL)
  })

  it('exe found + exe exec succeeds → exe tier, launches the discovered exe', () => {
    const calls: LaunchCommand[] = []
    const r = launch(
      base({
        exec: (c) => {
          calls.push(c)
          return true
        },
      }),
    )
    expect(r).toBe('exe')
    expect(flat(calls[0])).toContain('Start-Process -FilePath')
    expect(flat(calls[0])).toContain('Obsidian.exe')
    expect(flat(calls[0])).toContain(encodeURIComponent('D:\\projects\\meshblog\\content'))
  })

  it('exe exec fails → falls to uri tier', () => {
    const calls: LaunchCommand[] = []
    const r = launch(
      base({
        exec: (c) => {
          calls.push(c)
          // only the bare-uri Start-Process form succeeds (no -FilePath)
          const s = flat(c)
          return s.includes('Start-Process ') && !s.includes('-FilePath')
        },
      }),
    )
    expect(r).toBe('uri')
    expect(calls.some((c) => flat(c).includes('-FilePath'))).toBe(true)
    expect(calls.some((c) => flat(c).includes("Start-Process 'obsidian://"))).toBe(true)
  })

  it('exe + uri fail → falls to folder tier', () => {
    const calls: LaunchCommand[] = []
    const r = launch(
      base({
        exec: (c) => {
          calls.push(c)
          return c.file === 'explorer.exe'
        },
      }),
    )
    expect(r).toBe('folder')
    expect(calls.some((c) => c.file === 'explorer.exe')).toBe(true)
  })

  it('installed but every exec fails → install tier with manual instructions', () => {
    const logs: string[] = []
    const r = launch(base({ exec: () => false, log: (m) => logs.push(m) }))
    expect(r).toBe('install')
    expect(logs.join('\n')).toContain('/mnt/d/projects/meshblog/content')
  })

  it('config-dir-only install (exe unknown) → skips exe tier, uses uri tier', () => {
    const calls: LaunchCommand[] = []
    const r = launch(
      base({
        pathExists: (p) => p === '/mnt/c/Users/me/AppData/Roaming/obsidian',
        readRegistry: () => '',
        exec: (c) => {
          calls.push(c)
          return true
        },
      }),
    )
    expect(r).toBe('uri')
    expect(flat(calls[0])).toContain("Start-Process 'obsidian://")
  })
})
