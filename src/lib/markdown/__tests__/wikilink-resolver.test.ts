import { describe, it, expect } from 'vitest'
import { buildNoteResolver } from '../wikilink-resolver'

// ── Existing tests (updated for new return shape { resolve, collisions }) ──────

const notes = [
  { slug: 'prisma-vs-drizzle', title: 'Prisma vs Drizzle' },
  { slug: '03-astro-basics', title: 'Astro Basics' },
  { slug: 'unicode-note', title: '한글 메모' },
]

describe('buildNoteResolver — basic (no aliases)', () => {
  it('resolves by exact title (case-insensitive)', () => {
    const { resolve } = buildNoteResolver(notes)
    expect(resolve('Prisma vs Drizzle')).toEqual({
      slug: 'prisma-vs-drizzle',
      title: 'Prisma vs Drizzle',
    })
    expect(resolve('prisma vs drizzle')).toEqual({
      slug: 'prisma-vs-drizzle',
      title: 'Prisma vs Drizzle',
    })
  })

  it('falls back to slug when title does not match', () => {
    const { resolve } = buildNoteResolver(notes)
    expect(resolve('03-astro-basics')).toEqual({
      slug: '03-astro-basics',
      title: 'Astro Basics',
    })
  })

  it('unknown target → null', () => {
    const { resolve } = buildNoteResolver(notes)
    expect(resolve('Does Not Exist')).toBeNull()
  })

  it('empty string → null (never matches)', () => {
    const { resolve } = buildNoteResolver(notes)
    expect(resolve('')).toBeNull()
    expect(resolve('   ')).toBeNull()
  })

  it('unicode titles match', () => {
    const { resolve } = buildNoteResolver(notes)
    expect(resolve('한글 메모')).toEqual({
      slug: 'unicode-note',
      title: '한글 메모',
    })
  })

  it('trimmed whitespace around target', () => {
    const { resolve } = buildNoteResolver(notes)
    expect(resolve('  Astro Basics  ')).toEqual({
      slug: '03-astro-basics',
      title: 'Astro Basics',
    })
  })

  it('no aliases → empty collisions array', () => {
    const { collisions } = buildNoteResolver(notes)
    expect(collisions).toHaveLength(0)
  })
})

// ── New alias tests (TDD red-first) ────────────────────────────────────────────

describe('buildNoteResolver — alias resolution', () => {
  it('alias resolves to the note slug', () => {
    const { resolve } = buildNoteResolver([
      { slug: '09-ppo', title: 'Proximal Policy Optimization', aliases: ['PPO'] },
    ])
    expect(resolve('PPO')).toEqual({ slug: '09-ppo', title: 'Proximal Policy Optimization' })
  })

  it('alias lookup is case-insensitive', () => {
    const { resolve } = buildNoteResolver([
      { slug: '09-ppo', title: 'Proximal Policy Optimization', aliases: ['PPO'] },
    ])
    expect(resolve('ppo')).toEqual({ slug: '09-ppo', title: 'Proximal Policy Optimization' })
    expect(resolve('Ppo')).toEqual({ slug: '09-ppo', title: 'Proximal Policy Optimization' })
  })

  it('alias whitespace is trimmed before lookup', () => {
    const { resolve } = buildNoteResolver([
      { slug: '09-ppo', title: 'Proximal Policy Optimization', aliases: ['  PPO  '] },
    ])
    expect(resolve('PPO')).toEqual({ slug: '09-ppo', title: 'Proximal Policy Optimization' })
    expect(resolve('  PPO  ')).toEqual({ slug: '09-ppo', title: 'Proximal Policy Optimization' })
  })

  it('alias collision: two notes claim same alias → collisions list, neither resolves', () => {
    const { resolve, collisions } = buildNoteResolver([
      { slug: 'note-a', title: 'Note A', aliases: ['X'] },
      { slug: 'note-c', title: 'Note C', aliases: ['X'] },
    ])
    expect(collisions).toHaveLength(1)
    expect(collisions[0].alias).toBe('x')
    expect(collisions[0].claimers).toContain('note-a')
    expect(collisions[0].claimers).toContain('note-c')
    // Neither note resolves via the contested alias
    expect(resolve('X')).toBeNull()
    expect(resolve('x')).toBeNull()
  })

  it('alias collides with slug → slug wins, alias claim ignored, no collision', () => {
    // note-a has slug '09-ppo'; note-b claims alias '09-ppo'
    // The slug match in bySlug takes precedence; note-b's alias claim is silently dropped
    const { resolve, collisions } = buildNoteResolver([
      { slug: '09-ppo', title: 'PPO Note', aliases: [] },
      { slug: 'note-b', title: 'Note B', aliases: ['09-ppo'] },
    ])
    // No collision recorded (slug wins quietly)
    expect(collisions).toHaveLength(0)
    // '09-ppo' resolves to the slug note, not note-b via alias
    expect(resolve('09-ppo')).toEqual({ slug: '09-ppo', title: 'PPO Note' })
  })

  it('aliases field absent → behaves identically to before (back-compat)', () => {
    // Notes without `aliases` key — should work exactly as before
    const { resolve, collisions } = buildNoteResolver([
      { slug: 'foo', title: 'Foo Note' },
      { slug: 'bar', title: 'Bar Note' },
    ])
    expect(resolve('foo')).toEqual({ slug: 'foo', title: 'Foo Note' })
    expect(resolve('Bar Note')).toEqual({ slug: 'bar', title: 'Bar Note' })
    expect(resolve('missing')).toBeNull()
    expect(collisions).toHaveLength(0)
  })

  it('lookup order: bySlug → byTitle → byAlias → null', () => {
    // slug wins over title when they would match the same key
    const { resolve } = buildNoteResolver([
      { slug: 'self-attention', title: 'Self Attention Note', aliases: ['attn'] },
      { slug: 'another', title: 'Another', aliases: ['something'] },
    ])
    // Direct slug match
    expect(resolve('self-attention')).toEqual({ slug: 'self-attention', title: 'Self Attention Note' })
    // Title match
    expect(resolve('Self Attention Note')).toEqual({ slug: 'self-attention', title: 'Self Attention Note' })
    // Alias match (last resort)
    expect(resolve('attn')).toEqual({ slug: 'self-attention', title: 'Self Attention Note' })
    // Nothing matches
    expect(resolve('unknown')).toBeNull()
  })
})
