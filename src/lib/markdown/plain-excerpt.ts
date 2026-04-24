/**
 * Collapse a markdown body into a plain-text preview bounded by `maxChars`.
 *
 * Strips ATX headings at ANY level and position — not just the leading `# Title`.
 * Without this, mid-body `## 섹션` text can leak into a char-sliced excerpt when
 * the slice lands mid-section (Round 8 regression on post 26).
 *
 * Pipeline: strip heading lines → strip inline markdown chars → collapse
 * whitespace runs → trim → slice → trimEnd.
 */
export function plainExcerpt(markdown: string, maxChars: number): string {
  return markdown
    .replace(/^#+\s[^\n]*\n*/gm, '')
    .replace(/[#*`_~\[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxChars)
    .trimEnd()
}
