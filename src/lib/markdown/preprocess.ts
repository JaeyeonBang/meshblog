import { stripWikilinks } from './strip-wikilinks'

export function preprocessMarkdown(raw: string): string {
  let md = stripWikilinks(raw)
  return md
}
