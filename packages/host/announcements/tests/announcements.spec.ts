/**
 * What a deployment's written announcements resolve to, and what they refuse.
 */

import { Context } from '@lyness/cordis'
import { afterEach, describe, expect, it } from 'vitest'
import { newestFirst } from '../src/index.ts'
import type { Announcement } from '../src/index.ts'
import StaticAnnouncements, { BAD_INSTANT, REPEATED_ID, resolveEntries } from '../src/static.ts'
import type { AnnouncementEntry } from '../src/static.ts'

const RELEASE: AnnouncementEntry = {
  id: 'v0-1-7',
  publishedAt: '2026-10-15T08:00:00.000Z',
  title: '0.1.7 发布',
  body: '- 积分可由管理员授予\n- 支持通过企业目录签入',
  version: '0.1.7',
}

const NOTICE: AnnouncementEntry = {
  id: 'maintenance-2026-10-20',
  publishedAt: '2026-10-20T16:00:00.000Z',
  title: '例行维护',
  body: '北京时间 20 日凌晨 2:00 起约 30 分钟。',
}

const live: Context[] = []
afterEach(async () => { for (const ctx of live.splice(0)) await ctx.fiber.dispose() })

/** The source as a deployment gets it: mounted, so it is the service it provides. */
async function source(announcements: readonly AnnouncementEntry[]): Promise<Context> {
  const ctx = new Context()
  await ctx.plugin(StaticAnnouncements, { announcements: [...announcements] }).await()
  live.push(ctx)
  return ctx
}

describe('newestFirst', () => {
  function at(id: string, publishedAt: string): Announcement {
    return { id, publishedAt, title: id, body: id }
  }

  it('puts the most recent announcement first', () => {
    const ordered = newestFirst([at('older', '2026-01-01T00:00:00.000Z'), at('newer', '2026-06-01T00:00:00.000Z')])
    expect(ordered.map(one => one.id)).toEqual(['newer', 'older'])
  })

  it('keeps a fixed order for two published at the same instant', () => {
    const same = '2026-06-01T00:00:00.000Z'
    const first = newestFirst([at('b', same), at('a', same)]).map(one => one.id)
    const second = newestFirst([at('a', same), at('b', same)]).map(one => one.id)
    expect(first).toEqual(second)
  })

  it('leaves the array a caller passed untouched', () => {
    const given = [at('older', '2026-01-01T00:00:00.000Z'), at('newer', '2026-06-01T00:00:00.000Z')]
    newestFirst(given)
    expect(given.map(one => one.id)).toEqual(['older', 'newer'])
  })
})

describe('resolveEntries', () => {
  it('refuses a publication instant nothing can parse', () => {
    expect(() => resolveEntries([{ ...RELEASE, publishedAt: 'last tuesday' }])).toThrow(BAD_INSTANT)
  })

  it('refuses two announcements sharing one identity', () => {
    expect(() => resolveEntries([RELEASE, { ...RELEASE, title: '另一条' }])).toThrow(REPEATED_ID)
  })

  it('omits an absent version rather than carrying a blank one', () => {
    const [resolved] = resolveEntries([NOTICE])
    expect(resolved && 'version' in resolved).toBe(false)
  })

  it('carries the release an announcement describes', () => {
    const [resolved] = resolveEntries([RELEASE])
    expect(resolved?.version).toBe('0.1.7')
  })

  it('carries fuller notes when the deployment published a link', () => {
    const [resolved] = resolveEntries([{ ...RELEASE, url: 'https://example.com/releases/0.1.7' }])
    expect(resolved?.url).toBe('https://example.com/releases/0.1.7')
  })

  it('reads an absent list as an empty one', () => {
    expect(resolveEntries(undefined)).toEqual([])
  })

  it('omits an absent link rather than carrying a blank one', () => {
    const [resolved] = resolveEntries([NOTICE])
    expect(resolved && 'url' in resolved).toBe(false)
  })
})

describe('StaticAnnouncements', () => {
  it('publishes what the operator wrote, newest first', async () => {
    const ctx = await source([RELEASE, NOTICE])
    expect((await ctx.announcements.published()).map(one => one.id))
      .toEqual([NOTICE.id, RELEASE.id])
  })

  it('publishes nothing for a deployment with nothing to say', async () => {
    const ctx = await source([])
    expect(await ctx.announcements.published()).toEqual([])
  })

  it('publishes nothing for a deployment that stated no list at all', async () => {
    const ctx = new Context()
    // The Loader's schema defaults an absent list to empty; a hand-built
    // config has nothing there, and the source has to read that the same way.
    await ctx.plugin(StaticAnnouncements, {}).await()
    live.push(ctx)
    expect(await ctx.announcements.published()).toEqual([])
  })

  it('answers every reader the same list', async () => {
    const ctx = await source([RELEASE])
    expect(await ctx.announcements.published()).toEqual(await ctx.announcements.published())
  })
})
