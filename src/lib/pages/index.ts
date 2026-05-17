// Type contracts for parallel agents (B and C):
// PostRow:     { id: string, slug: string, title: string, content: string, tags: string[], created_at: string, updated_at: string, level_pin: number | null }
// NoteRow:     { id: string, slug: string, title: string, content: string, tags: string[], created_at: string, updated_at: string, level_pin: number | null }
// QaCard:      { id: string, tier: 'note'|'concept'|'global', question: string, answer: string, lang: string, scope_id: string | null }
// RelatedNote: { id: string, slug: string, title: string, score: number }

export { openReadonlyDb } from './db'
export { listPosts } from './posts'
export type { PostRow } from './posts'
export { listNotes, listAllNotesUnfiltered, listAllLinkable, listAllNoteSlugs } from './notes'
export type { NoteRow } from './notes'
export { getQaForNote, getHomepageQa } from './qa'
export type { QaCard } from './qa'
export { getRelatedNotes } from './related'
export type { RelatedNote } from './related'
export { getBacklinksForNote } from './backlinks'
export type { Backlink } from './backlinks'
export { listCategories, listNotesByCategory, listPostsByCategory } from './categories'
export type { CategoryRow } from './categories'
