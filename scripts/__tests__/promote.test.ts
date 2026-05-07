/**
 * promote.test.ts — exported helpers in promote.ts.
 *
 * The CLI entry path is NOT exercised here (it spawns audit + refresh
 * subprocesses). Tests focus on the pure helpers + per-file outcome logic.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  existsSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import matter from "gray-matter"
import {
  collectInputs,
  checkFile,
  composePromoted,
  isDraft,
  promoteOne,
  todayISO,
  isSafePath,
  parseArgs,
} from "../promote.ts"

const DRAFT_NOTE = `---
title: Some Note
draft: true
tags:
  - rl
  - ppo
---

# Body

Real content here, sufficient length to clear any future body-length gate
that the audit invariants might add.`

const PUBLISHED_NOTE = `---
title: Already Live
draft: false
tags:
  - ai
published_at: 2026-01-01
---

# Body

Already published — promote should no-op.`

const NO_TAGS_NOTE = `---
title: No Tags
draft: true
tags: []
---

# Body`

describe("isSafePath", () => {
  let cwdBefore: string
  let scratch: string
  beforeEach(() => {
    cwdBefore = process.cwd()
    scratch = mkdtempSync(join(tmpdir(), "promote-safe-"))
    process.chdir(scratch)
  })
  afterEach(() => {
    process.chdir(cwdBefore)
    rmSync(scratch, { recursive: true, force: true })
  })

  it("accepts paths inside cwd", () => {
    writeFileSync("a.md", "body")
    expect(isSafePath("a.md")).toBe(true)
  })

  it("rejects paths escaping cwd via ..", () => {
    expect(isSafePath("../escape.md")).toBe(false)
  })
})

describe("collectInputs", () => {
  let cwdBefore: string
  let scratch: string
  beforeEach(() => {
    cwdBefore = process.cwd()
    scratch = mkdtempSync(join(tmpdir(), "promote-collect-"))
    process.chdir(scratch)
  })
  afterEach(() => {
    process.chdir(cwdBefore)
    rmSync(scratch, { recursive: true, force: true })
  })

  it("returns the file when given a single .md path", () => {
    writeFileSync("a.md", "body")
    expect(collectInputs("a.md")).toEqual(["a.md"])
  })

  it("rejects non-md file", () => {
    writeFileSync("a.txt", "body")
    expect(() => collectInputs("a.txt")).toThrow(/markdown/i)
  })

  it("walks a directory non-recursively", () => {
    require("node:fs").mkdirSync("dir", { recursive: true })
    writeFileSync("dir/a.md", "")
    writeFileSync("dir/b.md", "")
    writeFileSync("dir/skip.txt", "")
    const r = collectInputs("dir")
    expect(r.map((p) => p.split("/").pop())).toEqual(["a.md", "b.md"])
  })

  it("rejects path traversal when target exists", () => {
    require("node:fs").mkdirSync("../sibling-tmp-escape", { recursive: true })
    try {
      expect(() => collectInputs("../sibling-tmp-escape")).toThrow(/escapes vault/)
    } finally {
      rmSync("../sibling-tmp-escape", { recursive: true, force: true })
    }
  })
})

describe("checkFile", () => {
  let cwdBefore: string
  let scratch: string
  beforeEach(() => {
    cwdBefore = process.cwd()
    scratch = mkdtempSync(join(tmpdir(), "promote-check-"))
    process.chdir(scratch)
  })
  afterEach(() => {
    process.chdir(cwdBefore)
    rmSync(scratch, { recursive: true, force: true })
  })

  it("passes for a properly-formed draft", () => {
    writeFileSync("a.md", DRAFT_NOTE)
    expect(checkFile("a.md").ok).toBe(true)
  })

  it("fails when tags are empty", () => {
    writeFileSync("a.md", NO_TAGS_NOTE)
    const r = checkFile("a.md")
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/tags/)
  })

  it("fails when frontmatter is malformed", () => {
    writeFileSync("a.md", "---\ntitle: : :\nstray\n---\nbody")
    const r = checkFile("a.md")
    // gray-matter is forgiving — but at minimum the result either fails
    // parse OR (more likely) succeeds with no `tags` and triggers tags-empty.
    expect(r.ok).toBe(false)
  })
})

describe("isDraft + composePromoted + promoteOne", () => {
  let cwdBefore: string
  let scratch: string
  beforeEach(() => {
    cwdBefore = process.cwd()
    scratch = mkdtempSync(join(tmpdir(), "promote-flow-"))
    process.chdir(scratch)
  })
  afterEach(() => {
    process.chdir(cwdBefore)
    rmSync(scratch, { recursive: true, force: true })
  })

  it("isDraft returns true for draft and false otherwise", () => {
    writeFileSync("d.md", DRAFT_NOTE)
    writeFileSync("p.md", PUBLISHED_NOTE)
    expect(isDraft("d.md")).toBe(true)
    expect(isDraft("p.md")).toBe(false)
  })

  it("composePromoted flips draft + sets published_at when missing", () => {
    writeFileSync("d.md", DRAFT_NOTE)
    const out = composePromoted("d.md", "2026-05-07")
    const { data } = matter(out)
    expect(data.draft).toBe(false)
    expect(data.published_at).toBe("2026-05-07")
    // tags preserved
    expect(data.tags).toEqual(["rl", "ppo"])
  })

  it("composePromoted preserves existing published_at", () => {
    writeFileSync("p.md", PUBLISHED_NOTE)
    const out = composePromoted("p.md", "2026-05-07")
    // gray-matter parses YYYY-MM-DD as a Date object; compare via ISO string
    // truncation. The on-disk YAML still serializes to the original string.
    const { data } = matter(out)
    const stamp =
      data.published_at instanceof Date
        ? data.published_at.toISOString().slice(0, 10)
        : String(data.published_at)
    expect(stamp).toBe("2026-01-01")
  })

  it("promoteOne flips a valid draft", () => {
    writeFileSync("d.md", DRAFT_NOTE)
    const r = promoteOne(
      "d.md",
      { dryRun: false, refresh: false },
      "2026-05-07",
    )
    expect(r.outcome).toBe("promoted")
    const { data } = matter(readFileSync("d.md", "utf-8"))
    expect(data.draft).toBe(false)
    expect(data.published_at).toBe("2026-05-07")
  })

  it("promoteOne is idempotent on already-published", () => {
    writeFileSync("p.md", PUBLISHED_NOTE)
    const r = promoteOne(
      "p.md",
      { dryRun: false, refresh: false },
      "2026-05-07",
    )
    expect(r.outcome).toBe("already-published")
    // file untouched
    const before = PUBLISHED_NOTE
    const after = readFileSync("p.md", "utf-8")
    expect(after).toBe(before)
  })

  it("promoteOne fails on empty tags", () => {
    writeFileSync("e.md", NO_TAGS_NOTE)
    const r = promoteOne(
      "e.md",
      { dryRun: false, refresh: false },
      "2026-05-07",
    )
    expect(r.outcome).toBe("failed")
    if (r.outcome === "failed") expect(r.reason).toMatch(/tags/)
  })

  it("promoteOne --dry-run does not write", () => {
    writeFileSync("d.md", DRAFT_NOTE)
    const before = readFileSync("d.md", "utf-8")
    const r = promoteOne(
      "d.md",
      { dryRun: true, refresh: false },
      "2026-05-07",
    )
    expect(r.outcome).toBe("promoted")
    expect(readFileSync("d.md", "utf-8")).toBe(before)
  })

  it("composePromoted output round-trips parseable frontmatter", () => {
    writeFileSync("d.md", DRAFT_NOTE)
    const out = composePromoted("d.md", "2026-05-07")
    expect(() => matter(out)).not.toThrow()
  })
})

describe("parseArgs", () => {
  it("requires at least one positional path", () => {
    expect(() => parseArgs(["node", "promote.ts"])).toThrow(/usage/)
  })

  it("returns a single positional as a one-element pathArgs array", () => {
    const r = parseArgs(["node", "promote.ts", "content/notes/a.md"])
    expect(r.pathArgs).toEqual(["content/notes/a.md"])
    expect(r.options.dryRun).toBe(false)
    expect(r.options.refresh).toBe(true)
  })

  it("collects multiple positionals", () => {
    const r = parseArgs([
      "node",
      "promote.ts",
      "content/notes/a.md",
      "content/notes/b.md",
      "content/posts/",
    ])
    expect(r.pathArgs).toEqual([
      "content/notes/a.md",
      "content/notes/b.md",
      "content/posts/",
    ])
  })

  it("flags interleaved with positionals are correctly split", () => {
    const r = parseArgs([
      "node",
      "promote.ts",
      "--dry-run",
      "content/notes/a.md",
      "--no-refresh",
      "content/notes/b.md",
    ])
    expect(r.pathArgs).toEqual(["content/notes/a.md", "content/notes/b.md"])
    expect(r.options.dryRun).toBe(true)
    expect(r.options.refresh).toBe(false)
  })
})

describe("todayISO", () => {
  it("returns YYYY-MM-DD with leading zeros", () => {
    expect(todayISO(new Date("2026-03-05T12:00:00Z"))).toBe("2026-03-05")
    expect(todayISO(new Date("2026-12-31T23:59:59Z"))).toBe("2026-12-31")
  })
})
