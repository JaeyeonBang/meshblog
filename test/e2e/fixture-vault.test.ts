/**
 * fixture-vault.test.ts — E2E corpus test for test/e2e/fixture-vault/.
 *
 * Risk-4 mitigation from CLAUDE.md: "Test-fixture drift — add
 * tests/e2e/fixture-vault/ with 30+ real-shaped notes to CI."
 *
 * Exercises the full build-index + build-backlinks pipeline against the
 * fixture vault and asserts correctness of the key invariants:
 *   - 30 notes total, 28 ingested (2 excluded: draft + public:false)
 *   - draft/public:false notes absent from `notes` table
 *   - wikilink edge cases all produce rows in `wikilinks` table
 *   - missing-target wikilink produces a row with target_id = NULL
 *   - aliased wikilink resolves to the correct note
 *   - image-embed ![[...]] is NOT written to the `wikilinks` table
 *   - unicode and trailing-space cases do not throw
 *
 * Build approach: call runBuildIndex() directly (module import, not CLI),
 * pointing baseDirs at the two fixture-vault subdirs. This mirrors the
 * pattern in build-smoke.test.ts which calls scripts via execSync with
 * MESHBLOG_DB override.
 *
 * Dedicated DB path: .data/test-fixture-vault.db — isolated from smoke DB.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { existsSync, rmSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { runBuildIndex } from "../../scripts/build-index"
import { runBuildBacklinks } from "../../scripts/build-backlinks"
import { createDb, queryMany, queryOne } from "../../src/lib/db/index"

// ── Paths ─────────────────────────────────────────────────────────────────────

const REPO_ROOT = join(import.meta.dirname, "../..")
const VAULT_ROOT = join(import.meta.dirname, "fixture-vault")
const VAULT_CONCEPTS = join(VAULT_ROOT, "concepts")
const VAULT_JOURNAL = join(VAULT_ROOT, "journal")
const TEST_DB = join(REPO_ROOT, ".data/test-fixture-vault.db")

// ── Helpers ───────────────────────────────────────────────────────────────────

/** No-op extractor: skip all LLM entity extraction in fixture runs. */
async function noopExtract() {
  return { entities: [], relationships: [] }
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

describe(
  "fixture-vault e2e",
  { timeout: 60_000 },
  () => {
    // Run once before all tests in this describe block.
    beforeAll(async () => {
      // Ensure .data/ exists
      mkdirSync(join(REPO_ROOT, ".data"), { recursive: true })

      // Remove stale DB from a previous run so we start clean.
      if (existsSync(TEST_DB)) rmSync(TEST_DB)

      // Stage 1: ingest all fixture-vault notes into the DB.
      await runBuildIndex({
        dbPath: TEST_DB,
        baseDirs: [VAULT_CONCEPTS, VAULT_JOURNAL],
        skipEmbed: true,
        skipConcepts: true,
        extract: noopExtract,
      })

      // Stage 2: build wikilinks table from the ingested notes.
      const db = createDb(TEST_DB)
      try {
        const notes = queryMany<{ id: string; title: string; content: string }>(
          db,
          "SELECT id, title, content FROM notes",
          [],
        )
        // dryRun: skip writing backlinks.json so we don't pollute public/graph
        runBuildBacklinks({ db, notes, dryRun: true })
      } finally {
        db.close()
      }
    })

    // ── Coverage ───────────────────────────────────────────────────────────────

    it("at least 28 notes were ingested (30 total minus 2 excluded)", () => {
      const db = createDb(TEST_DB)
      try {
        const row = queryOne<{ cnt: number }>(
          db,
          "SELECT COUNT(*) AS cnt FROM notes",
          [],
        )
        expect(row!.cnt).toBeGreaterThanOrEqual(28)
      } finally {
        db.close()
      }
    })

    // ── Draft exclusion ────────────────────────────────────────────────────────

    it("draft:true note is NOT in the notes table", () => {
      const db = createDb(TEST_DB)
      try {
        const row = queryOne<{ id: string }>(
          db,
          "SELECT id FROM notes WHERE id = ?",
          ["draft-note"],
        )
        expect(row).toBeNull()
      } finally {
        db.close()
      }
    })

    it("public:false note is NOT in the notes table", () => {
      const db = createDb(TEST_DB)
      try {
        const row = queryOne<{ id: string }>(
          db,
          "SELECT id FROM notes WHERE id = ?",
          ["private-note"],
        )
        expect(row).toBeNull()
      } finally {
        db.close()
      }
    })

    // ── Wikilink edge cases — rows must exist in wikilinks table ───────────────

    it("plain wikilink: wikilinks row exists for plain-wikilink-target", () => {
      const db = createDb(TEST_DB)
      try {
        // multi-link-paragraph links to [[plain-wikilink-target]]
        const row = queryOne<{ target_id: string | null }>(
          db,
          "SELECT target_id FROM wikilinks WHERE target_raw = ?",
          ["plain-wikilink-target"],
        )
        expect(row).not.toBeNull()
        expect(row!.target_id).toBe("plain-wikilink-target")
      } finally {
        db.close()
      }
    })

    it("aliased wikilink: wikilinks row has alias column set", () => {
      const db = createDb(TEST_DB)
      try {
        // alias-source.md: [[aliased-note|see here]]
        const row = queryOne<{ target_id: string | null; alias: string | null }>(
          db,
          "SELECT target_id, alias FROM wikilinks WHERE target_raw = ? AND alias IS NOT NULL",
          ["aliased-note"],
        )
        expect(row).not.toBeNull()
        expect(row!.target_id).toBe("aliased-note")
        expect(row!.alias).toBe("see here")
      } finally {
        db.close()
      }
    })

    it("trailing-space wikilink: target resolves after trimming", () => {
      const db = createDb(TEST_DB)
      try {
        // trailing-space-test.md: [[ spaced-target ]] → target_raw = 'spaced-target'
        const row = queryOne<{ target_id: string | null }>(
          db,
          "SELECT target_id FROM wikilinks WHERE target_raw = ? AND source_id = ?",
          ["spaced-target", "trailing-space-test"],
        )
        expect(row).not.toBeNull()
        expect(row!.target_id).toBe("spaced-target")
      } finally {
        db.close()
      }
    })

    it("unicode target (Korean): wikilinks row resolves 한글-노트", () => {
      const db = createDb(TEST_DB)
      try {
        const row = queryOne<{ target_id: string | null }>(
          db,
          "SELECT target_id FROM wikilinks WHERE target_raw = ?",
          ["한글-노트"],
        )
        expect(row).not.toBeNull()
        expect(row!.target_id).not.toBeNull()
      } finally {
        db.close()
      }
    })

    it("unicode target (emoji): wikilinks row exists for émoji-🚀", () => {
      const db = createDb(TEST_DB)
      try {
        const row = queryOne<{ target_id: string | null }>(
          db,
          "SELECT target_id FROM wikilinks WHERE target_raw = ?",
          ["émoji-🚀"],
        )
        expect(row).not.toBeNull()
        // target_id may or may not resolve (emoji slug lowercasing is identity)
        // the important thing is it did not crash
      } finally {
        db.close()
      }
    })

    it("case-collision wikilink: [[foo-bar]] and [[Foo-Bar]] both produce rows", () => {
      const db = createDb(TEST_DB)
      try {
        // Both should be stored as target_raw = 'foo-bar' after lowercasing
        const rows = queryMany<{ target_raw: string; target_id: string | null }>(
          db,
          "SELECT target_raw, target_id FROM wikilinks WHERE source_id = ?",
          ["case-collision-test"],
        )
        expect(rows.length).toBeGreaterThanOrEqual(2)
        const all = rows.filter((r) => r.target_raw === "foo-bar")
        expect(all.length).toBeGreaterThanOrEqual(2)
      } finally {
        db.close()
      }
    })

    it("missing target: wikilinks row has target_id = NULL", () => {
      const db = createDb(TEST_DB)
      try {
        // missing-target-demo.md: [[this-note-does-not-exist]]
        const row = queryOne<{ target_id: string | null }>(
          db,
          "SELECT target_id FROM wikilinks WHERE target_raw = ?",
          ["this-note-does-not-exist"],
        )
        expect(row).not.toBeNull()
        expect(row!.target_id).toBeNull()
      } finally {
        db.close()
      }
    })

    it("cross-directory wikilink: concepts/ → journal/ resolves", () => {
      const db = createDb(TEST_DB)
      try {
        // cross-dir-concept.md links to [[daily-review-2024-01-15]] which lives in journal/
        const row = queryOne<{ target_id: string | null }>(
          db,
          "SELECT target_id FROM wikilinks WHERE source_id = ? AND target_raw = ?",
          ["cross-dir-concept", "daily-review-2024-01-15"],
        )
        expect(row).not.toBeNull()
        expect(row!.target_id).toBe("daily-review-2024-01-15")
      } finally {
        db.close()
      }
    })

    it("multi-link paragraph: long-note-many-links has 10+ wikilink rows", () => {
      const db = createDb(TEST_DB)
      try {
        const row = queryOne<{ cnt: number }>(
          db,
          "SELECT COUNT(*) AS cnt FROM wikilinks WHERE source_id = ?",
          ["long-note-many-links"],
        )
        expect(row!.cnt).toBeGreaterThanOrEqual(10)
      } finally {
        db.close()
      }
    })

    it("self-referential: self-referential note produces a wikilink row", () => {
      const db = createDb(TEST_DB)
      try {
        const row = queryOne<{ source_id: string; target_id: string | null }>(
          db,
          "SELECT source_id, target_id FROM wikilinks WHERE source_id = ? AND target_raw = ?",
          ["self-referential", "self-referential"],
        )
        expect(row).not.toBeNull()
        // self-link resolves to itself
        expect(row!.target_id).toBe("self-referential")
      } finally {
        db.close()
      }
    })

    // ── Image embed ────────────────────────────────────────────────────────────

    it("image embed ![[hero.png]] does NOT produce a wikilinks row", () => {
      const db = createDb(TEST_DB)
      try {
        // build-backlinks skips image embeds (checks for '!' prefix before [[)
        const row = queryOne<{ id: number }>(
          db,
          "SELECT id FROM wikilinks WHERE source_id = ? AND target_raw = ?",
          ["image-embed-note", "hero.png"],
        )
        expect(row).toBeNull()
      } finally {
        db.close()
      }
    })

    it("image embed with alt-text ![[diagrams/flow.svg|Flow diagram]] not in wikilinks", () => {
      const db = createDb(TEST_DB)
      try {
        const row = queryOne<{ id: number }>(
          db,
          "SELECT id FROM wikilinks WHERE source_id = ? AND target_raw LIKE ?",
          ["image-embed-note", "%flow.svg%"],
        )
        expect(row).toBeNull()
      } finally {
        db.close()
      }
    })

    // ── Alias resolution (v1: slug-only) ──────────────────────────────────────

    it("wikilink to aliased-note resolves to note with slug aliased-note", () => {
      const db = createDb(TEST_DB)
      try {
        const note = queryOne<{ id: string; title: string }>(
          db,
          "SELECT id, title FROM notes WHERE id = ?",
          ["aliased-note"],
        )
        expect(note).not.toBeNull()
        expect(note!.title).toBe("Aliased Note")

        // The wikilink row from alias-source.md must point to this note
        const wikilink = queryOne<{ target_id: string }>(
          db,
          "SELECT target_id FROM wikilinks WHERE source_id = ? AND target_raw = ?",
          ["alias-source", "aliased-note"],
        )
        expect(wikilink).not.toBeNull()
        expect(wikilink!.target_id).toBe("aliased-note")
      } finally {
        db.close()
      }
    })

    // ── No-crash guarantee ────────────────────────────────────────────────────

    it("entire pipeline completes without error (no crashing on unicode/trailing-space/collision)", () => {
      // If we reach this test, the beforeAll did not throw.
      // Also verify the DB file exists and has a notes table with rows.
      expect(existsSync(TEST_DB)).toBe(true)
      const db = createDb(TEST_DB)
      try {
        const row = queryOne<{ cnt: number }>(
          db,
          "SELECT COUNT(*) AS cnt FROM notes",
          [],
        )
        expect(row!.cnt).toBeGreaterThan(0)
      } finally {
        db.close()
      }
    })

    // ── Cleanup ───────────────────────────────────────────────────────────────

    afterAll(() => {
      if (existsSync(TEST_DB)) rmSync(TEST_DB)
    })
  },
)
