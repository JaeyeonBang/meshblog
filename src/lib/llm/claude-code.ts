/**
 * Claude Code CLI subprocess wrapper.
 *
 * All LLM calls in this project go through `claude -p` (no OpenRouter). The
 * project ships as a personal blog harness; users are already authenticated
 * via their Claude Code session, so this avoids a second API key + a second
 * billing relationship.
 *
 * Trade-off: each `claude -p` spawn loads the user's session context (~55-79K
 * cache tokens), which is heavier than a flat HTTP call. For a personal blog
 * with infrequent ingest/synth operations the wall-time cost is acceptable;
 * the marginal monetary cost is zero on Pro/Max.
 */

import { spawn } from "node:child_process"
import { execSync } from "node:child_process"

/** Bump MODEL_VERSION when pinning to a new Claude Code version (FGR-2 hash key). */
export const MODEL_VERSION = "claude-code-cli"

/** Chat-style message used by all prompt builders. */
export type ChatMessage = {
  role: "system" | "user" | "assistant"
  content: string
}

/**
 * Call the Claude Code CLI with a prompt, returning the parsed JSON response.
 * The CLI is invoked as: `claude -p "<prompt>" --output-format json`
 */
export async function callClaude(prompt: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const args = ["-p", prompt, "--output-format", "json"]
    const child = spawn("claude", args, { stdio: ["ignore", "pipe", "pipe"] })

    let stdout = ""
    let stderr = ""

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    child.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(`claude exit ${code}: ${stderr.slice(0, 500)}`))
      }
      try {
        resolve(JSON.parse(stdout))
      } catch {
        reject(new Error(`parse fail: ${stdout.slice(0, 200)}`))
      }
    })

    child.on("error", (err) => {
      reject(new Error(`Failed to spawn claude: ${err.message}. Install: https://docs.anthropic.com/claude-code`))
    })
  })
}

/**
 * Check that the `claude` CLI binary is available.
 * Throws a descriptive error with install link if not found.
 */
export function checkClaudeAvailable(): void {
  try {
    execSync("which claude", { stdio: "ignore" })
  } catch {
    throw new Error(
      "Claude Code CLI not found in PATH.\n" +
      "  Problem: `claude` binary is missing.\n" +
      "  Cause:   Claude Code is not installed or not on PATH.\n" +
      "  Fix:     Install from https://docs.anthropic.com/claude-code and run `claude --version` to verify.",
    )
  }
}

type RetryOptions = {
  retries?: number
  baseMs?: number
  maxMs?: number
}

/**
 * Retry an async function with exponential backoff.
 * Handles transient Claude Code CLI errors (rate limits, process errors).
 * Default: 3 retries, 1s → 2s → 4s (capped at 10s).
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const { retries = 3, baseMs = 1000, maxMs = 10000 } = options
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (attempt < retries) {
        const delay = Math.min(baseMs * Math.pow(2, attempt), maxMs)
        console.warn(`[claude-code] attempt ${attempt + 1} failed: ${lastError.message}. Retrying in ${delay}ms...`)
        await new Promise((r) => setTimeout(r, delay))
      }
    }
  }

  throw lastError ?? new Error("retryWithBackoff: unknown error")
}

/**
 * Concatenate a ChatMessage[] into the single-prompt format `claude -p` accepts.
 * The CLI doesn't expose a system/user role split, so we encode it inline.
 */
function messagesToPrompt(messages: ChatMessage[]): string {
  return messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n")
}

/**
 * Unwrap the `--output-format json` envelope from `claude -p`.
 *
 * The CLI returns `{ type, subtype, result, ... }` where `result` is the
 * model's actual response (a string, sometimes containing JSON). When the
 * model is asked to return JSON, callers want the parsed inner JSON, not
 * the envelope.
 *
 * Behavior:
 *   • envelope with `result: "<json string>"` → parse and return the inner object
 *   • envelope with `result: <object>`         → return the inner object as-is
 *   • envelope with non-JSON `result: "..."`   → return the raw string
 *   • bare object (no `result` key)            → return as-is (already parsed)
 */
function unwrapClaudeResult(response: unknown): unknown {
  if (typeof response !== "object" || response === null || !("result" in response)) {
    return response
  }
  const inner = (response as { result: unknown }).result
  if (typeof inner === "string") {
    try {
      return JSON.parse(inner)
    } catch {
      return inner
    }
  }
  return inner
}

/**
 * Convenience wrapper: builds the single-prompt form, calls `claude -p` with
 * retry, and returns the unwrapped JSON payload. The default 3-retry backoff
 * matches `generate-qa.ts` (1s → 2s → 4s, capped at 10s).
 */
export async function callClaudeMessages(
  messages: ChatMessage[],
  options: RetryOptions = {},
): Promise<unknown> {
  const prompt = messagesToPrompt(messages)
  const response = await retryWithBackoff(() => callClaude(prompt), options)
  return unwrapClaudeResult(response)
}
