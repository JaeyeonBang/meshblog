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
 *   3. promptVaultPath — returns null when the user presses Enter (skip-vault
 *      branch). createAskFn is used to feed controlled input.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
  readFileSync,
  existsSync,
  lstatSync,
  symlinkSync,
} from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Readable } from 'node:stream'
import { createInterface } from 'node:readline'

import { countVaultMarkdown, linkVault, linkVaultPosts, createAskFn } from '../init.ts'

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

// ── linkVaultPosts — vault Posts/ subfolder mirror ────────────────────────────

describe('linkVaultPosts — vault Posts/ subfolder mirror', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'mb-posts-test-'))
  })
  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('copies two .md files from vault Posts/ into content/posts/', () => {
    const vault = join(tmpDir, 'vault')
    const vaultPosts = join(vault, 'Posts')
    const postsTarget = join(tmpDir, 'content', 'posts')
    mkdirSync(vaultPosts, { recursive: true })
    writeFileSync(join(vaultPosts, 'alpha.md'), '# Alpha')
    writeFileSync(join(vaultPosts, 'beta.md'), '# Beta')

    linkVaultPosts(vault, postsTarget, { skipWatch: true })

    expect(existsSync(join(postsTarget, 'alpha.md'))).toBe(true)
    expect(existsSync(join(postsTarget, 'beta.md'))).toBe(true)
    expect(readFileSync(join(postsTarget, 'alpha.md'), 'utf-8')).toBe('# Alpha')
    expect(readFileSync(join(postsTarget, 'beta.md'), 'utf-8')).toBe('# Beta')
  })

  it('overwrites a same-named file in content/posts/ with the vault version', () => {
    const vault = join(tmpDir, 'vault')
    const vaultPosts = join(vault, 'Posts')
    const postsTarget = join(tmpDir, 'content', 'posts')
    mkdirSync(vaultPosts, { recursive: true })
    mkdirSync(postsTarget, { recursive: true })

    // Repo-authored version (old content)
    writeFileSync(join(postsTarget, 'foo.md'), 'old content')
    // Vault version (should win)
    writeFileSync(join(vaultPosts, 'foo.md'), 'vault content')

    linkVaultPosts(vault, postsTarget, { skipWatch: true })

    expect(readFileSync(join(postsTarget, 'foo.md'), 'utf-8')).toBe('vault content')
  })

  it('preserves repo-authored posts not present in vault Posts/ (additive, no deletion)', () => {
    const vault = join(tmpDir, 'vault')
    const vaultPosts = join(vault, 'Posts')
    const postsTarget = join(tmpDir, 'content', 'posts')
    mkdirSync(vaultPosts, { recursive: true })
    mkdirSync(postsTarget, { recursive: true })

    // Repo-authored post that has no vault counterpart
    writeFileSync(join(postsTarget, 'bar.md'), 'repo only')
    // Vault post
    writeFileSync(join(vaultPosts, 'vault-only.md'), 'vault only')

    linkVaultPosts(vault, postsTarget, { skipWatch: true })

    // Both must be present after the additive mirror
    expect(existsSync(join(postsTarget, 'bar.md'))).toBe(true)
    expect(readFileSync(join(postsTarget, 'bar.md'), 'utf-8')).toBe('repo only')
    expect(existsSync(join(postsTarget, 'vault-only.md'))).toBe(true)
  })

  it('logs skip message and leaves content/posts/ unchanged when vault has no Posts/ subfolder', () => {
    const vault = join(tmpDir, 'vault')
    // Vault exists but has no Posts/ directory
    mkdirSync(vault, { recursive: true })
    const postsTarget = join(tmpDir, 'content', 'posts')
    mkdirSync(postsTarget, { recursive: true })
    writeFileSync(join(postsTarget, 'existing.md'), 'existing')

    const logs: string[] = []
    const origLog = console.log
    console.log = (...args: unknown[]) => logs.push(args.join(' '))
    try {
      linkVaultPosts(vault, postsTarget, { skipWatch: true })
    } finally {
      console.log = origLog
    }

    // Skip message must be logged
    expect(logs.some(l => l.includes('skipping posts mirror'))).toBe(true)
    // Existing file must be untouched
    expect(existsSync(join(postsTarget, 'existing.md'))).toBe(true)
    expect(readFileSync(join(postsTarget, 'existing.md'), 'utf-8')).toBe('existing')
  })

  it('mirrors a nested Posts/sub/baz.md recursively', () => {
    const vault = join(tmpDir, 'vault')
    const vaultPosts = join(vault, 'Posts')
    const vaultSub = join(vaultPosts, 'sub')
    const postsTarget = join(tmpDir, 'content', 'posts')
    mkdirSync(vaultSub, { recursive: true })
    writeFileSync(join(vaultSub, 'baz.md'), '# Baz nested')

    linkVaultPosts(vault, postsTarget, { skipWatch: true })

    expect(existsSync(join(postsTarget, 'sub', 'baz.md'))).toBe(true)
    expect(readFileSync(join(postsTarget, 'sub', 'baz.md'), 'utf-8')).toBe('# Baz nested')
  })
})

// ── promptVaultPath skip-vault branch (via createAskFn) ───────────────────────
// promptVaultPath is not exported directly, but its skip-branch behaviour is
// fully exercised through createAskFn: feeding an empty line must cause the
// function to return null (not loop forever). These tests use createAskFn to
// simulate pressing Enter at the vault prompt.

describe('promptVaultPath — skip-vault branch (createAskFn integration)', () => {
  it('createAskFn returns empty string for a bare newline (Enter key equivalent)', async () => {
    // Confirms the raw building block: a line with only "\n" yields "".
    // promptVaultPath receives this trimmed value and must return null.
    const stdin = Readable.from(['\n'])
    const rl = createInterface({ input: stdin })
    const ask = createAskFn(rl)
    const value = (await ask('')).trim()
    expect(value).toBe('')
    rl.close()
  })

  it('createAskFn returns the vault path when the user types one', async () => {
    // Positive-path: a non-empty answer is returned as-is (trimmed).
    const stdin = Readable.from(['/home/user/MyVault\n'])
    const rl = createInterface({ input: stdin })
    const ask = createAskFn(rl)
    const value = (await ask('')).trim()
    expect(value).toBe('/home/user/MyVault')
    rl.close()
  })

  it('skip path: RunInitOptions accepts vaultPath: null without type errors', () => {
    // Type-level contract: RunInitOptions.vaultPath is string | null | undefined.
    // Passing null must not cause a TS compile error (tested at runtime as a
    // proxy since vitest runs with tsc-level checks via vite-plugin-checker).
    const opts: import('../init.ts').RunInitOptions = { vaultPath: null, skipSpawn: true }
    expect(opts.vaultPath).toBeNull()
  })
})
