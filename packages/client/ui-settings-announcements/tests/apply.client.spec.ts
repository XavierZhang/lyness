/**
 * The announcements row's wiring: where it registers, the store it declares,
 * its own locale namespace, and that nothing is read until something asks.
 *
 * The read's own behaviour is pinned in `read.client.spec.ts`, against the
 * reader directly, so this spec never reaches into the framework's
 * type-erased inject factory.
 */

import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import type { Announcement } from '@deepseek-ai/dsh-announcements/types'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { TestRemote } from '@deepseek-ai/dsh-client-test-runtime'
import { announcementsReadOf, apply, inject, NS } from '@deepseek-ai/dsh-client-ui-settings-announcements/client'
import { AnnouncementsRow } from '../src/client/AnnouncementsRow.tsx'
import type { createAnnouncementsRowStore } from '../src/client/settings-store.ts'

const SLOT = 'settings.general.item'

const RELEASE: Announcement = {
  id: 'v0-1-7',
  version: '0.1.7',
  publishedAt: '2026-10-15T08:00:00.000Z',
  title: '0.1.7',
  body: '- Administrators can grant credits',
}

/** A context with the slot registry, a locale, and the row mounted. */
async function bench(published: () => Promise<unknown>) {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  locale.setLocale('zh')
  ctx.provide('locale', locale)
  const events = new TestRemote(ctx, { announcements: { published } })
  events.$host = { home: undefined, isLoopback: true }
  const slots = ctx.get('slots') as SlotRegistry
  const declared = slots.register(
    { name: 'root', children: { [SLOT]: { kind: 'list', scope: 'root' } } } as never,
    () => null,
  )
  const fiber = ctx.plugin({ inject: [...inject], apply })
  await fiber.await()
  return { ctx, slots, locale, declared, fiber }
}

/** The store handle this row registered. */
type Handle = ReturnType<typeof createAnnouncementsRowStore>

describe('ui-settings-announcements apply', () => {
  it('registers after the current-version row', async () => {
    const { slots } = await bench(() => Promise.resolve({ ok: true, value: [] }))
    const entry = slots.entries(SLOT).find(one => one.component === AnnouncementsRow)!
    expect(entry.options).toMatchObject({ id: 'announcements', order: 30 })
  })

  it('declares a store for the row to read through', async () => {
    const { slots } = await bench(() => Promise.resolve({ ok: true, value: [] }))
    const entry = slots.entries(SLOT).find(one => one.component === AnnouncementsRow)!
    const handle = entry.store as Handle
    expect(handle.create().store.getSnapshot()).toEqual({ status: 'idle', announcements: [] })
  })

  it('registers its own copy under its own namespace', async () => {
    const { locale } = await bench(() => Promise.resolve({ ok: true, value: [] }))
    expect(locale.bind(NS)('row')).toBe('系统公告')
  })

  it('reads nothing until something asks', async () => {
    const published = vi.fn(() => Promise.resolve({ ok: true as const, value: [] }))
    await bench(published)
    expect(published).not.toHaveBeenCalled()
  })

  it('reads through the Remote namespace the deployment answers on', async () => {
    const published = vi.fn(() => Promise.resolve({ ok: true as const, value: [] }))
    const { ctx } = await bench(published)
    expect(await announcementsReadOf(ctx)()).toEqual({ ok: true, value: [] })
    expect(published).toHaveBeenCalledOnce()
  })

  it('declares a store whose writes move it through its four states', async () => {
    const { slots } = await bench(() => Promise.resolve({ ok: true, value: [] }))
    const entry = slots.entries(SLOT).find(one => one.component === AnnouncementsRow)!
    const instance = (entry.store as Handle).create()
    instance.actions.begin()
    expect(instance.store.getSnapshot().status).toBe('loading')
    instance.actions.succeed([RELEASE])
    expect(instance.store.getSnapshot()).toEqual({ status: 'ready', announcements: [RELEASE] })
    instance.actions.fail()
    expect(instance.store.getSnapshot()).toMatchObject({ status: 'failed', announcements: [RELEASE] })
    instance.actions.reset()
    expect(instance.store.getSnapshot().status).toBe('idle')
  })

  it('stops offering the row when its plugin is unloaded', async () => {
    const { slots, fiber } = await bench(() => Promise.resolve({ ok: true as const, value: [] }))
    expect(slots.entries(SLOT).filter(one => one.component === AnnouncementsRow)).toHaveLength(1)
    await fiber.dispose()
    expect(slots.entries(SLOT).filter(one => one.component === AnnouncementsRow)).toHaveLength(0)
  })
})
