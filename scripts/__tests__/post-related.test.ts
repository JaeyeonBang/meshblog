/**
 * scripts/__tests__/post-related.test.ts
 * Unit tests for the getPostRelated() data-layer function.
 *
 * Strategy: spin up a real SQLite DB via createDb(), insert fixture rows for
 * two posts in content/posts, then assert resolution behaviour:
 *   - known slug → resolved to {slug, title}
 *   - unknown slug → dropped silently
 *   - empty relatedSlugs → returns []
 *   - self-reference → dropped (because the target row exists, but we still
 *     resolve it; this is intentional — editors are responsible for not
 *     listing themselves)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { existsSync, unlinkSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createDb } from '../../src/lib/db/index.ts'
import Database from 'better-sqlite3'

const TEST_DB = join(tmpdir(), `post-related-test-${Date.now()}.db`)

let db: ReturnType<typeof createDb>

function seedPosts(db: Database.Database) {
  db.exec(`
    INSERT INTO notes (id, slug, title, content, content_hash, folder_path, tags, related, graph_status)
    VALUES
      ('09-ppo', '09-ppo', 'PPO: Proximal Policy Optimization', 'Content about PPO.', 'hash09', 'content/posts', '[]', '[]', 'done'),
      ('01-deep-rl', '01-deep-rl', 'Deep RL from Human Preferences', 'Content about RLHF.', 'hash01', 'content/posts', '[]', '["09-ppo"]', 'done'),
      ('02-agent',  '02-agent',  'Agent AI Paper List',           'Content about agents.', 'hash02', 'content/posts', '[]', '["09-ppo","nonexistent"]', 'done'),
      ('03-empty',  '03-empty',  'Empty Related',                  'Content with no related.', 'hash03', 'content/posts', '[]', '[]', 'done')
  `)
}

beforeAll(() => {
  mkdirSync(join(tmpdir()), { recursive: true })
  db = createDb(TEST_DB)
  seedPosts(db)
  db.close()
})

afterAll(() => {
  for (const suffix of ['', '-shm', '-wal']) {
    const f = TEST_DB + suffix
    if (existsSync(f)) unlinkSync(f)
  }
})

// ── import under test (after DB is seeded) ───────────────────────────────────

process.env.MESHBLOG_DB = TEST_DB

const { getPostBySlug, getPostRelated } = await import('../../src/lib/pages/posts.js')

// ── tests ─────────────────────────────────────────────────────────────────────

describe('getPostRelated()', () => {
  it('returns [] for a post with no related slugs', () => {
    const post = getPostBySlug('03-empty')
    expect(post).not.toBeNull()
    const result = getPostRelated(post!)
    expect(result).toEqual([])
  })

  it('resolves a single known related slug to {slug, title}', () => {
    const post = getPostBySlug('01-deep-rl')
    expect(post).not.toBeNull()
    expect(post!.relatedSlugs).toEqual(['09-ppo'])

    const result = getPostRelated(post!)
    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('09-ppo')
    expect(result[0].title).toBe('PPO: Proximal Policy Optimization')
  })

  it('drops unknown slugs silently', () => {
    const post = getPostBySlug('02-agent')
    expect(post).not.toBeNull()
    // relatedSlugs: ["09-ppo", "nonexistent"]
    const result = getPostRelated(post!)
    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('09-ppo')
  })

  it('each resolved item has slug and title as strings', () => {
    const post = getPostBySlug('01-deep-rl')
    const result = getPostRelated(post!)
    for (const r of result) {
      expect(typeof r.slug).toBe('string')
      expect(typeof r.title).toBe('string')
    }
  })

  it('relatedSlugs on PostRow is an array (always)', () => {
    const post = getPostBySlug('03-empty')
    expect(Array.isArray(post!.relatedSlugs)).toBe(true)
  })
})

describe('PostRow.relatedSlugs', () => {
  it('is parsed from JSON when the field is present', () => {
    const post = getPostBySlug('01-deep-rl')
    expect(post!.relatedSlugs).toEqual(['09-ppo'])
  })

  it('defaults to [] when related is empty JSON array', () => {
    const post = getPostBySlug('09-ppo')
    expect(post!.relatedSlugs).toEqual([])
  })
})
