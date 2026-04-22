/**
 * init-smoke.test.ts — Tier-1 automated coverage of the fork-from-zero flow.
 *
 * Exercises the Windows-sensitive pieces of scripts/init.ts from CLAUDE.md's
 * v1 acceptance #1 without needing a Windows host:
 *   - countVaultMarkdown() recursion + dot-dir skip + unicode names
 *   - linkVault() materializes a real directory (not a symlink — regression
 *     guard for commit 72bac69) and preserves nested subdirs, images, and
 *     unicode-named notes.
 *
 * Uses `{ skipWatch: true }` to avoid leaking fs.watch handles that would
 * keep vitest's event loop alive on teardown.
 *
 * Deliberately out of scope: the interactive prompt flow, deploy.yml
 * generation, and dev server spawn. Those need a full sandboxed clone and
 * Windows can't be simulated here.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { existsSync, lstatSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { countVaultMarkdown, linkVault } from "../../scripts/init"

const FIXTURE_VAULT = join(import.meta.dirname, "fixture-vault")

describe("init smoke — copy semantics + markdown count", () => {
  let sandbox: string

  beforeEach(() => {
    sandbox = mkdtempSync(join(tmpdir(), "meshblog-init-"))
  })

  afterEach(() => {
    if (existsSync(sandbox)) rmSync(sandbox, { recursive: true, force: true })
  })

  // ── countVaultMarkdown ──────────────────────────────────────────────────────

  it("countVaultMarkdown returns 30 for the fixture vault", () => {
    expect(countVaultMarkdown(FIXTURE_VAULT)).toBe(30)
  })

  it("countVaultMarkdown returns 0 for an empty dir (triggers fixture fallback)", () => {
    const empty = join(sandbox, "empty-vault")
    mkdirSync(empty)
    expect(countVaultMarkdown(empty)).toBe(0)
  })

  it("countVaultMarkdown returns 0 for a missing dir", () => {
    expect(countVaultMarkdown(join(sandbox, "does-not-exist"))).toBe(0)
  })

  it("countVaultMarkdown skips dot-directories (.obsidian, .git, .trash)", () => {
    const vault = join(sandbox, "dotted-vault")
    mkdirSync(vault)
    mkdirSync(join(vault, ".obsidian"))
    mkdirSync(join(vault, ".git"))
    writeFileSync(join(vault, "real.md"), "# real")
    writeFileSync(join(vault, ".obsidian", "config.md"), "# hidden")
    writeFileSync(join(vault, ".git", "HEAD.md"), "# hidden")
    expect(countVaultMarkdown(vault)).toBe(1)
  })

  // ── linkVault ───────────────────────────────────────────────────────────────

  it("linkVault copies all 30 fixture notes into a real directory (not a symlink)", () => {
    const target = join(sandbox, "content-notes")
    linkVault(FIXTURE_VAULT, target, { skipWatch: true })

    // Regression guard for commit 72bac69: target must be a real directory,
    // not a symlink. `git push` on a forked repo breaks if content/notes/ is
    // a symlink because the target path doesn't exist on the remote.
    expect(lstatSync(target).isSymbolicLink()).toBe(false)
    expect(lstatSync(target).isDirectory()).toBe(true)

    expect(countVaultMarkdown(target)).toBe(30)
  })

  it("linkVault preserves nested subdirectories (concepts/ + journal/ + concepts/diagrams/)", () => {
    const target = join(sandbox, "content-notes")
    linkVault(FIXTURE_VAULT, target, { skipWatch: true })

    expect(existsSync(join(target, "concepts"))).toBe(true)
    expect(existsSync(join(target, "journal"))).toBe(true)
    expect(existsSync(join(target, "concepts", "diagrams", "flow.svg"))).toBe(true)
  })

  it("linkVault preserves unicode filenames (한글, émoji)", () => {
    const target = join(sandbox, "content-notes")
    linkVault(FIXTURE_VAULT, target, { skipWatch: true })

    // These are the adversarial unicode cases from CLAUDE.md Active Risk #1.
    expect(existsSync(join(target, "concepts", "한글-노트.md"))).toBe(true)
    expect(existsSync(join(target, "concepts", "émoji-🚀.md"))).toBe(true)
  })

  it("linkVault preserves non-markdown assets (images)", () => {
    const target = join(sandbox, "content-notes")
    linkVault(FIXTURE_VAULT, target, { skipWatch: true })

    expect(existsSync(join(target, "concepts", "hero.png"))).toBe(true)
  })

  it("linkVault produces a standalone copy (source deletion does not break target)", () => {
    const sourceCopy = join(sandbox, "ephemeral-vault")
    mkdirSync(sourceCopy)
    writeFileSync(join(sourceCopy, "only-note.md"), "# only\ncontent here")

    const target = join(sandbox, "content-notes")
    linkVault(sourceCopy, target, { skipWatch: true })

    // Delete the source — if target were a symlink, the read would fail.
    rmSync(sourceCopy, { recursive: true, force: true })

    const content = readFileSync(join(target, "only-note.md"), "utf-8")
    expect(content).toBe("# only\ncontent here")
  })

  it("linkVault replaces an existing stale target directory", () => {
    const target = join(sandbox, "content-notes")
    mkdirSync(target)
    writeFileSync(join(target, "stale.md"), "# stale")

    linkVault(FIXTURE_VAULT, target, { skipWatch: true })

    // The old stale file must be gone; the vault contents must be there.
    expect(existsSync(join(target, "stale.md"))).toBe(false)
    expect(existsSync(join(target, "concepts"))).toBe(true)
    expect(countVaultMarkdown(target)).toBe(30)
  })

  it("linkVault with skipWatch completes synchronously and copies before returning", () => {
    // Proves (a) skipWatch short-circuits before the fs.watch call — otherwise
    // this file would leave a live watcher handle that prevents vitest's
    // afterEach cleanup from deleting the sandbox, and subsequent tests would
    // observe stale state — and (b) the copy happens eagerly, so callers can
    // read the target immediately after the synchronous return.
    const target = join(sandbox, "content-notes")
    linkVault(FIXTURE_VAULT, target, { skipWatch: true })
    expect(countVaultMarkdown(target)).toBe(30)
    expect(existsSync(join(target, "concepts", "한글-노트.md"))).toBe(true)
  })
})

// ── fixture-vault shape assertions ──────────────────────────────────────────
// Not strictly init-related, but double-checks that the corpus in
// test/e2e/fixture-vault/ has the 30-note shape the other e2e tests expect.
// If a fixture file is accidentally deleted, this test fails fast.

describe("init smoke — fixture vault shape", () => {
  it("fixture vault has exactly 30 markdown notes across concepts/ + journal/", () => {
    const total = countVaultMarkdown(FIXTURE_VAULT)
    expect(total).toBe(30)
  })

  it("fixture vault contains the adversarial wikilink cases from Risk #1", () => {
    // Presence check (counted by filename) — full parsing is covered by
    // fixture-vault.test.ts.
    const concepts = readdirSync(join(FIXTURE_VAULT, "concepts"))
    expect(concepts).toContain("한글-노트.md")
    expect(concepts).toContain("émoji-🚀.md")
    expect(concepts).toContain("spaced-target.md")
    expect(concepts).toContain("foo-bar.md")
  })
})
