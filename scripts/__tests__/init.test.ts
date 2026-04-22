/**
 * scripts/__tests__/init.test.ts
 * Unit tests for scripts/init.ts helpers.
 *
 * Covers the two latent D1 bugs surfaced in the fork-from-zero rehearsal:
 *   1. countVaultMarkdown — underpins the "vault empty → fixture fallback,
 *      vault has content → real build" branch that init must take after
 *      linkVault. Previously init unconditionally ran FIXTURE_ONLY=1 and
 *      masked every fork user's real content.
 *   2. linkVault — already exported; keep a regression test that an existing
 *      real directory at the target is not clobbered by a symlink attempt
 *      (EEXIST) and a symlink can be replaced cleanly.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  mkdirSync,
  rmSync,
  writeFileSync,
  readFileSync,
  existsSync,
  lstatSync,
  symlinkSync,
} from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { countVaultMarkdown, linkVault } from '../init.ts'

const BASE = join(tmpdir(), `mb-init-test-${process.pid}-${Date.now()}`)

describe('countVaultMarkdown', () => {
  beforeEach(() => {
    rmSync(BASE, { recursive: true, force: true })
    mkdirSync(BASE, { recursive: true })
  })
  afterEach(() => {
    rmSync(BASE, { recursive: true, force: true })
  })

  it('returns 0 for an empty directory', () => {
    expect(countVaultMarkdown(BASE)).toBe(0)
  })

  it('returns 0 for a directory with only non-markdown files', () => {
    writeFileSync(join(BASE, 'readme.txt'), 'x')
    writeFileSync(join(BASE, 'image.png'), 'x')
    expect(countVaultMarkdown(BASE)).toBe(0)
  })

  it('counts top-level .md files only', () => {
    writeFileSync(join(BASE, 'a.md'), 'x')
    writeFileSync(join(BASE, 'b.md'), 'x')
    writeFileSync(join(BASE, 'c.txt'), 'x')
    expect(countVaultMarkdown(BASE)).toBe(2)
  })

  it('counts nested .md files recursively', () => {
    mkdirSync(join(BASE, 'sub', 'deep'), { recursive: true })
    writeFileSync(join(BASE, 'top.md'), 'x')
    writeFileSync(join(BASE, 'sub', 'mid.md'), 'x')
    writeFileSync(join(BASE, 'sub', 'deep', 'bottom.md'), 'x')
    expect(countVaultMarkdown(BASE)).toBe(3)
  })

  it('skips dot-prefixed directories (.obsidian, .git)', () => {
    mkdirSync(join(BASE, '.obsidian'))
    mkdirSync(join(BASE, '.git'))
    writeFileSync(join(BASE, '.obsidian', 'config.md'), 'x')
    writeFileSync(join(BASE, '.git', 'HEAD.md'), 'x')
    writeFileSync(join(BASE, 'real.md'), 'x')
    expect(countVaultMarkdown(BASE)).toBe(1)
  })

  it('returns 0 when the path does not exist (defensive)', () => {
    expect(countVaultMarkdown(join(BASE, 'does-not-exist'))).toBe(0)
  })
})

describe('linkVault', () => {
  beforeEach(() => {
    rmSync(BASE, { recursive: true, force: true })
    mkdirSync(BASE, { recursive: true })
  })
  afterEach(() => {
    rmSync(BASE, { recursive: true, force: true })
  })

  it('materializes a real directory with vault files copied in', () => {
    // Why copy instead of symlink: `git add .` serializes a symlink as the
    // stored path (e.g. /tmp/test-vault), so on CI the symlink resolves to
    // a non-existent directory and build-index finds 0 markdown files in
    // content/notes/. Making linkVault copy + watch means fork users can
    // `git push` their notes without any manual materialization step.
    const vault = join(BASE, 'vault')
    const target = join(BASE, 'content-notes')
    mkdirSync(vault)
    writeFileSync(join(vault, 'one.md'), 'hello')

    linkVault(vault, target)

    const stat = lstatSync(target)
    expect(stat.isSymbolicLink()).toBe(false)
    expect(stat.isDirectory()).toBe(true)
    expect(existsSync(join(target, 'one.md'))).toBe(true)
    expect(readFileSync(join(target, 'one.md'), 'utf-8')).toBe('hello')
  })

  it('replaces an existing symlink pointing elsewhere with a populated dir', () => {
    // Upgrade path: a user who ran the old symlink-based init and now re-runs
    // the copy-based init. The stale symlink must not linger.
    const vault = join(BASE, 'vault')
    const oldVault = join(BASE, 'old-vault')
    const target = join(BASE, 'content-notes')
    mkdirSync(vault)
    writeFileSync(join(vault, 'fresh.md'), 'fresh')
    mkdirSync(oldVault)
    writeFileSync(join(oldVault, 'stale.md'), 'stale')
    symlinkSync(oldVault, target, 'dir')

    linkVault(vault, target)

    expect(lstatSync(target).isSymbolicLink()).toBe(false)
    expect(lstatSync(target).isDirectory()).toBe(true)
    expect(existsSync(join(target, 'fresh.md'))).toBe(true)
    expect(existsSync(join(target, 'stale.md'))).toBe(false)
  })

  it('replaces an existing empty real directory with a populated dir', () => {
    // Fresh degit lays down content/notes/ as a real directory with
    // placeholder files; init must swap it for the user's vault content.
    const vault = join(BASE, 'vault')
    const target = join(BASE, 'content-notes')
    mkdirSync(vault)
    writeFileSync(join(vault, 'real.md'), 'real')
    mkdirSync(target)
    writeFileSync(join(target, 'placeholder.md'), 'placeholder')

    linkVault(vault, target)

    expect(lstatSync(target).isSymbolicLink()).toBe(false)
    expect(lstatSync(target).isDirectory()).toBe(true)
    expect(existsSync(join(target, 'real.md'))).toBe(true)
    expect(existsSync(join(target, 'placeholder.md'))).toBe(false)
  })
})
