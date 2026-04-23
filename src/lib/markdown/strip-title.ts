/**
 * Remove a leading ATX-style H1 (and any immediately following blank lines)
 * from a markdown string. Everything else passes through untouched.
 *
 * Why: article pages render the title in a separate <h1> in .article-header,
 * and excerpt generators strip markdown punctuation but leave the title line
 * intact — both result in the title appearing twice (DOM + excerpt). This
 * helper normalizes both call-sites.
 *
 * Strips the FIRST heading line when it (optionally preceded by whitespace)
 * starts with `# ` (single hash + space). Leading whitespace tolerance matters
 * because `gray-matter` returns content with the blank line after the closing
 * `---` preserved, so real post bodies arrive as `\n\n# Title\n\n...`.
 *
 * Leaves `## ...`, `###...`, or text-first content alone.
 */
export function stripLeadingH1(markdown: string): string {
  return markdown.replace(/^\s*#\s[^\n]*\n+/, '')
}
