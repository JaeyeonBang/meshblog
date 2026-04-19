export function stripWikilinks(md: string): string {
  return md.replace(/\[\[([^\]|]*)(\|([^\]]*))?\]\]/g, (_, target, _pipe, alias) => {
    if (alias) return alias
    if (target) return target
    return ''
  })
}
