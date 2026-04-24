/**
 * init-ask.test.ts — regression coverage for createAskFn's stdin EOF handling.
 *
 * Pre-this-fix createAskFn returned "" when the readline iterator was done.
 * promptVaultPath treats "" as "Path cannot be empty" and retries the same
 * ask() — which got "" again, ad infinitum. Scripted rehearsals that fed
 * truncated answer files or closed stdin mid-prompt hung forever at Step 2
 * without any error signal. Throwing on done=true makes the failure explicit
 * and bubbles up to main()'s try/catch → non-zero exit.
 */
import { describe, it, expect } from "vitest"
import { Readable } from "node:stream"
import { createInterface } from "node:readline"
import { createAskFn } from "../../scripts/init"

describe("createAskFn", () => {
  it("returns the first line for a single-line stdin", async () => {
    const stdin = Readable.from(["hello world\n"])
    const rl = createInterface({ input: stdin })
    const ask = createAskFn(rl)
    await expect(ask("")).resolves.toBe("hello world")
    rl.close()
  })

  it("returns subsequent lines on repeated calls", async () => {
    const stdin = Readable.from(["first\nsecond\n"])
    const rl = createInterface({ input: stdin })
    const ask = createAskFn(rl)
    await expect(ask("")).resolves.toBe("first")
    await expect(ask("")).resolves.toBe("second")
    rl.close()
  })

  it("throws on stdin EOF rather than returning empty string", async () => {
    // Simulates a truncated answers file or a closed pipe. Before the fix,
    // this quietly returned "" and promptVaultPath looped forever.
    const stdin = Readable.from([""])
    const rl = createInterface({ input: stdin })
    const ask = createAskFn(rl)
    await expect(ask("")).rejects.toThrow(/stdin exhausted/)
    rl.close()
  })

  it("throws on second call when only one answer was provided", async () => {
    // Scripted rehearsal wrote the vault path but forgot the repo name.
    // First call succeeds, second throws — operator gets a clear error
    // instead of a hang.
    const stdin = Readable.from(["only-one-line\n"])
    const rl = createInterface({ input: stdin })
    const ask = createAskFn(rl)
    await expect(ask("")).resolves.toBe("only-one-line")
    await expect(ask("")).rejects.toThrow(/stdin exhausted/)
    rl.close()
  })
})
