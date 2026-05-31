import { describe, it, expect } from 'vitest'
import {
  isWsl,
  toWinPath,
  buildObsidianUri,
  selectLaunchCommand,
  detectObsidian,
  launch,
  OBSIDIAN_DOWNLOAD_URL,
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

describe('selectLaunchCommand', () => {
  const args = { uri: 'obsidian://open?path=X', folderWin: 'D:\\v', folderPosix: '/mnt/d/v' }

  it('uri tier: WSL and win32 use cmd.exe start', () => {
    expect(selectLaunchCommand('uri', 'linux', true, args)).toBe(
      'cmd.exe /c start "" "obsidian://open?path=X"',
    )
    expect(selectLaunchCommand('uri', 'win32', false, args)).toBe(
      'cmd.exe /c start "" "obsidian://open?path=X"',
    )
  })
  it('uri tier: darwin → open, linux → xdg-open', () => {
    expect(selectLaunchCommand('uri', 'darwin', false, args)).toBe('open "obsidian://open?path=X"')
    expect(selectLaunchCommand('uri', 'linux', false, args)).toBe('xdg-open "obsidian://open?path=X"')
  })
  it('folder tier: WSL/win32 use explorer.exe with the Windows path', () => {
    expect(selectLaunchCommand('folder', 'linux', true, args)).toBe('explorer.exe "D:\\v"')
    expect(selectLaunchCommand('folder', 'win32', false, args)).toBe('explorer.exe "D:\\v"')
  })
  it('folder tier: darwin/linux use the posix path', () => {
    expect(selectLaunchCommand('folder', 'darwin', false, args)).toBe('open "/mnt/d/v"')
    expect(selectLaunchCommand('folder', 'linux', false, args)).toBe('xdg-open "/mnt/d/v"')
  })
})

describe('detectObsidian', () => {
  it('WSL: true when AppData/Roaming/obsidian exists', () => {
    const exists = (p: string) => p === 'C:\\Users\\me\\AppData\\Roaming\\obsidian'
    expect(detectObsidian('linux', true, 'C:\\Users\\me', '/home/me', exists)).toBe(true)
  })
  it('WSL: false when nothing exists', () => {
    expect(detectObsidian('linux', true, 'C:\\Users\\me', '/home/me', () => false)).toBe(false)
  })
  it('WSL: false when homeWin is null', () => {
    expect(detectObsidian('linux', true, null, '/home/me', () => true)).toBe(false)
  })
  it('darwin: true when /Applications/Obsidian.app exists', () => {
    const exists = (p: string) => p === '/Applications/Obsidian.app'
    expect(detectObsidian('darwin', false, null, '/Users/me', exists)).toBe(true)
  })
  it('linux: true when ~/.config/obsidian exists', () => {
    const exists = (p: string) => p === '/home/me/.config/obsidian'
    expect(detectObsidian('linux', false, null, '/home/me', exists)).toBe(true)
  })
})

describe('launch — 3-tier fallback orchestration', () => {
  const base = (over: Partial<LaunchDeps>): LaunchDeps => ({
    platform: 'linux',
    procVersion: 'microsoft-WSL2',
    vaultPosix: '/mnt/d/projects/meshblog/content',
    homeWin: 'C:\\Users\\me',
    homePosix: '/home/me',
    pathExists: () => false,
    exec: () => false,
    log: () => {},
    ...over,
  })

  it('Obsidian not detected → install tier, logs download URL', () => {
    const logs: string[] = []
    const r = launch(base({ pathExists: () => false, log: (m) => logs.push(m) }))
    expect(r).toBe('install')
    expect(logs.join('\n')).toContain(OBSIDIAN_DOWNLOAD_URL)
  })

  it('detected + URI exec succeeds → uri tier', () => {
    const calls: string[] = []
    const r = launch(
      base({
        pathExists: () => true,
        exec: (c) => {
          calls.push(c)
          return true
        },
      }),
    )
    expect(r).toBe('uri')
    expect(calls[0]).toContain('cmd.exe /c start')
    expect(calls[0]).toContain('obsidian://open?path=')
  })

  it('detected + URI fails → falls to folder tier', () => {
    const calls: string[] = []
    const r = launch(
      base({
        pathExists: () => true,
        exec: (c) => {
          calls.push(c)
          return c.includes('explorer.exe') // URI fails, folder succeeds
        },
      }),
    )
    expect(r).toBe('folder')
    expect(calls.some((c) => c.includes('obsidian://'))).toBe(true)
    expect(calls.some((c) => c.includes('explorer.exe'))).toBe(true)
  })

  it('detected but every exec fails → install tier with manual instructions', () => {
    const logs: string[] = []
    const r = launch(base({ pathExists: () => true, exec: () => false, log: (m) => logs.push(m) }))
    expect(r).toBe('install')
    expect(logs.join('\n')).toContain('/mnt/d/projects/meshblog/content')
  })

  it('uses the converted Windows path in the URI', () => {
    const calls: string[] = []
    launch(
      base({
        pathExists: () => true,
        exec: (c) => {
          calls.push(c)
          return true
        },
      }),
    )
    expect(calls[0]).toContain(encodeURIComponent('D:\\projects\\meshblog\\content'))
  })
})
