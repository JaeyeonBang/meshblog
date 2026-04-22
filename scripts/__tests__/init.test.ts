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
  existsSync,
  lstatSync,
  readlinkSync,
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

  it('creates a symlink when the target does not exist', () => {
    const vault = join(BASE, 'vault')
    const target = join(BASE, 'content-notes')
    mkdirSync(vault)
    writeFileSync(join(vault, 'one.md'), 'x')

    linkVault(vault, target)

    expect(lstatSync(target).isSymbolicLink()).toBe(true)
    expect(readlinkSync(target)).toBe(vault)
  })

  it('replaces an existing symlink pointing elsewhere', () => {
    const vault = join(BASE, 'vault')
    const oldVault = join(BASE, 'old-vault')
    const target = join(BASE, 'content-notes')
    mkdirSync(vault)
    mkdirSync(oldVault)
    symlinkSync(oldVault, target, 'dir')

    linkVault(vault, target)

    expect(lstatSync(target).isSymbolicLink()).toBe(true)
    expect(readlinkSync(target)).toBe(vault)
  })

  it('replaces an existing empty real directory with a symlink', () => {
    // Fresh degit always lays down content/notes/ as a real directory;
    // init must be able to swap it for a symlink to the user's vault.
    const vault = join(BASE, 'vault')
    const target = join(BASE, 'content-notes')
    mkdirSync(vault)
    writeFileSync(join(vault, 'one.md'), 'x')
    mkdirSync(target)

    linkVault(vault, target)

    expect(lstatSync(target).isSymbolicLink()).toBe(true)
    expect(readlinkSync(target)).toBe(vault)
  })
})
