/**
 * Remove a leading ATX-style H1 (and any immediately following blank lines)
 * from a markdown string. Everything else passes through untouched.
 *
 * Why: article pages render the title in a separate <h1> in .article-header,
 * and excerpt generators strip markdown punctuation but leave the title line
 * intact — both result in the title appearing twice (DOM + excerpt). This
 * helper normalizes both call-sites.
 *
 * Only strips the FIRST line when it starts with `# ` (single hash + space).
 * Leaves `## ...`, `###...`, or text-first content alone.
 */
export function stripLeadingH1(markdown: string): string {
  return markdown.replace(/^#\s[^\n]*\n+/, '')
}
