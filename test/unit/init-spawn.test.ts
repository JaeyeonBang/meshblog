/**
 * init-spawn.test.ts — T1 from windows-rehearsal-hardening plan.
 *
 * Locks in the platform-scoped spawn options for the dev server launched
 * at the end of /init. On Windows, detached:false would kill the child
 * when the parent process.exit()s; detached:true + stdio:ignore keeps it
 * alive in its own console. Everywhere else, stdio:inherit streams logs
 * so the operator can see dev output.
 *
 * A regression here would silently break `/init` on Windows — the operator
 * sees "Open: http://..." but the server is gone. No test can catch that
 * from WSL, so the next best thing is locking in the branch that decides
 * which options apply.
 */
import { describe, it, expect } from "vitest"
import { getDevSpawnOptions } from "../../scripts/init"

describe("getDevSpawnOptions", () => {
  it("win32 returns detached:true + stdio:ignore so dev survives parent exit", () => {
    expect(getDevSpawnOptions("win32")).toEqual({
      detached: true,
      stdio: "ignore",
    })
  })

  it("linux returns detached:false + stdio:inherit so dev logs stream", () => {
    expect(getDevSpawnOptions("linux")).toEqual({
      detached: false,
      stdio: "inherit",
    })
  })

  it("darwin uses the non-Windows profile", () => {
    expect(getDevSpawnOptions("darwin")).toEqual({
      detached: false,
      stdio: "inherit",
    })
  })

  it("unknown platform falls through to the non-Windows profile (safe default)", () => {
    // Platforms like freebsd, openbsd, sunos — treat like Unix.
    expect(getDevSpawnOptions("freebsd" as NodeJS.Platform)).toEqual({
      detached: false,
      stdio: "inherit",
    })
  })
})
