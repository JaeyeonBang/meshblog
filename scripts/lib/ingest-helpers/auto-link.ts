/**
 * auto-link.ts — insert wikilink markup for known entities, skipping code
 * regions and existing wikilinks.
 *
 * For each suggestion, finds the FIRST whole-word case-insensitive
 * occurrence of `surface` in the body, skips matches inside fenced code
 * (` ``` … ``` `), inline code (` `…` `), or inside an existing wikilink
 * (`[[…]]`), and replaces with `[[<target_slug>|<surface>]]`. Surface
 * casing is preserved as it appeared in the original text.
 *
 * Process suggestions in input order. Each replacement modifies the body,
 * and subsequent searches run against the modified body — natural via
 * re-iteration.
 */

export type LinkSuggestion = { surface: string; target_slug: string }

export type AutoLinkResult = {
  body: string
  applied: LinkSuggestion[]
}

/**
 * Compute the set of (start, end) char ranges in `body` that are NOT
 * eligible for replacement: fenced code blocks, inline code spans, and
 * existing wikilinks. Returns ranges sorted ascending by start.
 */
function computeProtectedRanges(body: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = []

  // 1. Fenced code blocks: ``` … ```  (also ~~~ but we only see backticks
  //    in this codebase)
  const fenceRe = /```[\s\S]*?```/g
  for (const m of body.matchAll(fenceRe)) {
    if (m.index !== undefined) ranges.push([m.index, m.index + m[0].length])
  }

  // 2. Inline code: `…`  — but only on a single line and only when not
  //    inside a fenced range (we'll filter with a check below).
  const inlineRe = /`[^`\n]+`/g
  for (const m of body.matchAll(inlineRe)) {
    if (m.index === undefined) continue
    const insideFence = ranges.some(([s, e]) => m.index! >= s && m.index! < e)
    if (!insideFence) ranges.push([m.index, m.index + m[0].length])
  }

  // 3. Existing wikilinks: [[ ... ]]  (alias form too)
  const wikiRe = /\[\[[^\]]*\]\]/g
  for (const m of body.matchAll(wikiRe)) {
    if (m.index !== undefined) ranges.push([m.index, m.index + m[0].length])
  }

  ranges.sort((a, b) => a[0] - b[0])
  return ranges
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function isInsideRanges(pos: number, len: number, ranges: Array<[number, number]>): boolean {
  // A match `[pos, pos+len)` is "inside" any range that overlaps it.
  for (const [s, e] of ranges) {
    if (pos >= s && pos + len <= e) return true
  }
  return false
}

export function autoLink(body: string, suggestions: LinkSuggestion[]): AutoLinkResult {
  let working = body
  const applied: LinkSuggestion[] = []

  for (const sug of suggestions) {
    const surface = sug.surface
    if (!surface || surface.length < 2) continue

    // Whole-word boundary, case-insensitive. Use a fresh RE per pass since
    // the body changes between iterations.
    const re = new RegExp(`\\b${escapeRegex(surface)}\\b`, "i")

    // Recompute protected ranges against the (possibly modified) working body.
    const ranges = computeProtectedRanges(working)

    // Walk match positions until we find one that isn't protected.
    let cursor = 0
    let placed = false
    while (cursor < working.length) {
      const slice = working.slice(cursor)
      const m = slice.match(re)
      if (!m || m.index === undefined) break

      const absStart = cursor + m.index
      const absEnd = absStart + m[0].length

      if (isInsideRanges(absStart, m[0].length, ranges)) {
        // Skip past this occurrence and keep searching.
        cursor = absEnd
        continue
      }

      // Replace at this exact position (preserve original casing of m[0]).
      const replacement = `[[${sug.target_slug}|${m[0]}]]`
      working = working.slice(0, absStart) + replacement + working.slice(absEnd)
      applied.push(sug)
      placed = true
      break
    }

    if (!placed) {
      // No eligible match — quietly skip this suggestion.
    }
  }

  return { body: working, applied }
}
