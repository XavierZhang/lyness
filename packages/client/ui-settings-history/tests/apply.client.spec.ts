/**
 * The section's wiring: where it registers, the store it declares, its own
 * locale namespace, and that nothing is read until the section opens.
 *
 * The call's own behaviour is pinned in `operations.client.spec.ts`, against
 * the operations directly, so this spec never reaches into the framework's
 * type-erased inject factory.
 */

import { Context } from '@lyness/cordis'
import { describe, expect, it, vi } from 'vitest'
import { SlotRegistry } from '@lyness/lyn-client-ui-renderer/client'
import { LocaleRuntime } from '@lyness/lyn-client-locale/client'
import { TestRemote } from '@lyness/lyn-client-test-runtime'
import type { AuditEntryView } from '@lyness/lyn-api-admin-audit-controller/types'
import { apply, historyCallsOf, inject, NS } from '@lyness/lyn-client-ui-settings-history/client'
import { HistorySection } from '../src/client/HistorySection.tsx'
import type { createHistorySectionStore } from '../src/client/store.ts'

const SLOT = 'settings.administration.section'

const ENTRY: AuditEntryView = {
  id: '2026-10-26T00:00:00.000Z:one',
  at: '2026-10-26T00:00:00.000Z',
  by: 'ada',
  standing: 'ada:tenant-administrator',
  kind: 'bot',
  subject: 'triage',
  subjectName: 'Triage',
  action: 'added',
  organization: 'acme',
  changes: [{ field: 'displayName', after: 'Triage' }],
}

/** A context with the slot registry, a locale, and the section mounted. */
async function bench(read: () => Promise<unknown> = () => Promise.resolve({ ok: true, value: [ENTRY] })) {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  locale.setLocale('zh')
  ctx.provide('locale', locale)
  const events = new TestRemote(ctx, { audit: { read } })
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

/** The store handle this section registered. */
type Handle = ReturnType<typeof createHistorySectionStore>

/** The slot entry this section registered. */
function entryOf(slots: SlotRegistry) {
  const entry = slots.entries(SLOT).find(one => one.component === HistorySection)
  if (entry === undefined) throw new Error('the history section did not register')
  return entry
}

describe('ui-settings-history apply', () => {
  it('registers after the bots section', async () => {
    const { slots } = await bench()
    // The history is what the people and bots sections changed, so it is read
    // after the records it describes.
    expect(entryOf(slots).options).toMatchObject({ id: 'history', order: 50 })
  })

  it('names itself in the navigation with its own copy', async () => {
    const { slots, locale } = await bench()
    const label = entryOf(slots).options.label
    expect(typeof label === 'function' ? label() : label).toBe('历史')
    expect(locale.bind(NS)('title')).toBe('管理历史')
  })

  it('reads nothing until the section opens', async () => {
    const read = vi.fn(() => Promise.resolve({ ok: true as const, value: [ENTRY] }))
    await bench(read)
    expect(read).not.toHaveBeenCalled()
  })

  it('reads through the Remote namespace the deployment answers on', async () => {
    const read = vi.fn(() => Promise.resolve({ ok: true as const, value: [ENTRY] }))
    const { ctx } = await bench(read)
    expect(await historyCallsOf(ctx).read({})).toEqual({ ok: true, value: [ENTRY] })
    expect(read).toHaveBeenCalledOnce()
  })

  it('declares a store the section reads through', async () => {
    const { slots } = await bench()
    const handle = entryOf(slots).store as Handle
    expect(handle.create().store.getSnapshot()).toEqual({
      status: 'idle',
      entries: [],
      more: false,
      loadingMore: false,
      exporting: false,
      exported: undefined,
      exportFailed: false,
    })
  })

  it('declares a store whose writes move the read through its states', async () => {
    const { slots } = await bench()
    const instance = (entryOf(slots).store as Handle).create()
    instance.actions.begin()
    expect(instance.store.getSnapshot().status).toBe('loading')
    instance.actions.succeed([ENTRY])
    expect(instance.store.getSnapshot()).toMatchObject({ status: 'ready', entries: [ENTRY], more: true })
    // A continuation appends, and an empty one settles that there is nothing
    // older rather than emptying the page.
    instance.actions.appending()
    expect(instance.store.getSnapshot().loadingMore).toBe(true)
    instance.actions.appended([{ ...ENTRY, id: '2026-10-25T00:00:00.000Z:old' }])
    expect(instance.store.getSnapshot().entries).toHaveLength(2)
    instance.actions.appended([])
    expect(instance.store.getSnapshot()).toMatchObject({ more: false, loadingMore: false })
    expect(instance.store.getSnapshot().entries).toHaveLength(2)
    // An export that wrote no file is reported as that, not as a count of
    // nothing.
    instance.actions.exporting()
    expect(instance.store.getSnapshot()).toMatchObject({ exporting: true, exported: undefined })
    instance.actions.exported({ count: 2, complete: true })
    expect(instance.store.getSnapshot())
      .toMatchObject({ exporting: false, exported: { count: 2, complete: true }, exportFailed: false })
    instance.actions.exporting()
    instance.actions.exported(undefined)
    expect(instance.store.getSnapshot()).toMatchObject({ exported: undefined, exportFailed: true })
    instance.actions.fail('forbidden')
    expect(instance.store.getSnapshot().status).toBe('forbidden')
    instance.actions.reset()
    expect(instance.store.getSnapshot().status).toBe('idle')
  })

  it('stops offering the section when its plugin is unloaded', async () => {
    const { slots, fiber } = await bench()
    expect(slots.entries(SLOT).filter(one => one.component === HistorySection)).toHaveLength(1)
    await fiber.dispose()
    expect(slots.entries(SLOT).filter(one => one.component === HistorySection)).toHaveLength(0)
  })
})
