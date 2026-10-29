/**
 * The section's wiring: that it mounts the namespace it calls, where it
 * registers, the store it declares, its own locale namespace, and that the
 * download control follows the plugin that owns the download.
 */

import { Context } from '@lyness/cordis'
import { describe, expect, it, vi } from 'vitest'
import { SlotRegistry } from '@lyness/lyn-client-ui-renderer/client'
import { LocaleRuntime } from '@lyness/lyn-client-locale/client'
import { TestRemote } from '@lyness/lyn-client-test-runtime'
import { SessionId } from '@lyness/lyn-session/types'
import { apply, dataCallsOf, inject, NS } from '@lyness/lyn-client-ui-settings-data/client'
import { DataSection } from '../src/client/DataSection.tsx'
import type { DataSectionInjected } from '../src/client/DataSection.tsx'
import type { DataActions } from '../src/client/binding.ts'
import type { createDataSectionStore } from '../src/client/store.ts'

const SLOT = 'settings.section'

/** One catalog snapshot carrying a single conversation. */
const CATALOG = {
  ids: [SessionId('mine')],
  byId: {
    mine: {
      id: SessionId('mine'),
      displayTitle: 'The quarterly plan',
      running: false,
      retainedBy: {},
      blank: false,
      updatedAt: 100,
    },
  },
  phase: 'ready',
  projectionsBySession: {},
}

interface BenchOptions {
  /** What `sessionData.delete` answers. */
  deleteCall?: () => Promise<unknown>
  /** Whether the download plugin is mounted. */
  download?: boolean
}

/** A context with the slot registry, a locale, the session catalog, and the section mounted. */
async function bench(options: BenchOptions = {}) {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  locale.setLocale('zh')
  ctx.provide('locale', locale)
  const refresh = vi.fn(() => Promise.resolve())
  ctx.provide('sessions', {
    list: { getSnapshot: () => CATALOG, subscribe: () => () => {} },
    refresh,
  })
  const download = vi.fn(() => Promise.resolve())
  if (options.download !== false) ctx.provide('sessionLogDownload', { download })
  const remote = new TestRemote(ctx, {
    sessionData: {
      delete: options.deleteCall ?? (() => Promise.resolve({ ok: true, value: { removed: ['mine'] } })),
    },
  })
  remote.$host = { home: undefined, isLoopback: true }
  const slots = ctx.get('slots') as SlotRegistry
  const declared = slots.register(
    { name: 'root', children: { [SLOT]: { kind: 'list', scope: 'root' } } } as never,
    () => null,
  )
  const fiber = ctx.plugin({ inject: [...inject], apply })
  await fiber.await()
  return { ctx, slots, locale, declared, fiber, remote, download, refresh }
}

/** The store handle this section registered. */
type Handle = ReturnType<typeof createDataSectionStore>

/** The slot entry this section registered. */
function entryOf(slots: SlotRegistry) {
  const entry = slots.entries(SLOT).find(one => one.component === DataSection)
  if (entry === undefined) throw new Error('the data section did not register')
  return entry
}

/** The injected face the framework would bake for this section. */
function faceOf(slots: SlotRegistry): DataSectionInjected {
  const inject = entryOf(slots).inject as (actions: DataActions) => DataSectionInjected & Record<string, unknown>
  return inject({ work: vi.fn(), done: vi.fn(), refused: vi.fn(), confirm: vi.fn(), cancel: vi.fn() })
}

describe('ui-settings-data apply', () => {
  it('mounts the namespace it calls rather than relying on another plugin to', async () => {
    const { remote } = await bench()
    expect(remote.mounted).toHaveLength(1)
  })

  it('registers last in the personal plane', async () => {
    const { slots } = await bench()
    expect(entryOf(slots).options).toMatchObject({ id: 'data', order: 40 })
  })

  it('names itself in the navigation with its own copy', async () => {
    const { slots, locale } = await bench()
    const label = entryOf(slots).options.label
    expect(typeof label === 'function' ? label() : label).toBe('数据')
    expect(locale.bind(NS)('title')).toBe('你的对话')
  })

  it('lists the session catalog\'s own conversations rather than a second listing', async () => {
    const { slots } = await bench()
    expect(faceOf(slots).hooks.conversations.getSnapshot()).toEqual([
      { id: 'mine', title: 'The quarterly plan', updatedAt: 100 },
    ])
  })

  it('starts the download the export plugin owns', async () => {
    const { slots, download } = await bench()
    faceOf(slots).exportConversation('mine')
    expect(download).toHaveBeenCalledWith(SessionId('mine'))
  })

  it('reports no download where that plugin is not mounted', async () => {
    const withDownload = await bench()
    expect(withDownload.slots && faceOf(withDownload.slots).hooks.exportAvailable.getSnapshot()).toBe(true)
    const without = await bench({ download: false })
    expect(faceOf(without.slots).hooks.exportAvailable.getSnapshot()).toBe(false)
    // The control is inert rather than absent in the face; the component
    // reads the same answer the sentence does.
    expect(() => { faceOf(without.slots).exportConversation('mine') }).not.toThrow()
  })

  it('deletes through the Remote namespace the deployment answers on, then re-reads the catalog', async () => {
    const deleteCall = vi.fn(() => Promise.resolve({ ok: true as const, value: { removed: ['mine'] } }))
    const { ctx, refresh } = await bench({ deleteCall })
    const calls = dataCallsOf(ctx)
    expect(await calls.delete('mine')).toEqual({ ok: true, value: { removed: ['mine'] } })
    await calls.refresh()
    expect(deleteCall).toHaveBeenCalledWith('mine')
    expect(refresh).toHaveBeenCalledOnce()
  })

  it('declares a store the section reads through', async () => {
    const { slots } = await bench()
    const handle = entryOf(slots).store as Handle
    expect(handle.create().store.getSnapshot()).toEqual({
      confirming: undefined, deleting: undefined, refused: undefined, removed: undefined,
    })
  })

  it('declares a store whose writes move the confirmation and the deletion through their states', async () => {
    const { slots } = await bench()
    const instance = (entryOf(slots).store as Handle).create()
    instance.actions.confirm('mine')
    expect(instance.store.getSnapshot()).toMatchObject({ confirming: 'mine', removed: undefined })
    instance.actions.cancel()
    expect(instance.store.getSnapshot().confirming).toBeUndefined()
    instance.actions.confirm('mine')
    instance.actions.work('mine')
    expect(instance.store.getSnapshot()).toMatchObject({ confirming: undefined, deleting: 'mine' })
    instance.actions.done(2)
    expect(instance.store.getSnapshot()).toMatchObject({ deleting: undefined, removed: 2 })
    instance.actions.work('mine')
    instance.actions.refused('still open')
    expect(instance.store.getSnapshot()).toMatchObject({ deleting: undefined, refused: 'still open' })
  })

  it('withdraws the section and the namespace when its plugin is unloaded', async () => {
    const { slots, fiber, remote } = await bench()
    expect(slots.entries(SLOT).filter(one => one.component === DataSection)).toHaveLength(1)
    await fiber.dispose()
    expect(slots.entries(SLOT).filter(one => one.component === DataSection)).toHaveLength(0)
    expect(remote.mounted).toHaveLength(0)
  })
})
