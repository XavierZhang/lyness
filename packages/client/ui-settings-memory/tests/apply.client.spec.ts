/**
 * The section's wiring: where it registers, the store it declares, its own
 * locale namespace, and that nothing is read until the section opens.
 */

import { Context } from '@lyness/cordis'
import { describe, expect, it, vi } from 'vitest'
import { SlotRegistry } from '@lyness/lyn-client-ui-renderer/client'
import { LocaleRuntime } from '@lyness/lyn-client-locale/client'
import { TestRemote } from '@lyness/lyn-client-test-runtime'
import type { MemoriesView } from '@lyness/lyn-api-memory-controller/types'
import { apply, inject, memoryCallsOf, NS } from '@lyness/lyn-client-ui-settings-memory/client'
import { MemorySection } from '../src/client/MemorySection.tsx'
import type { createMemorySectionStore } from '../src/client/store.ts'

const SLOT = 'settings.section'

const VIEW: MemoriesView = {
  owned: true,
  entries: [{ id: 'one', text: 'Ada prefers metric units.', writtenAt: '2026-10-28T00:00:00.000Z' }],
}

/** A context with the slot registry, a locale, and the section mounted. */
async function bench(listCall: () => Promise<unknown> = () => Promise.resolve({ ok: true, value: VIEW })) {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  locale.setLocale('zh')
  ctx.provide('locale', locale)
  const events = new TestRemote(ctx, {
    memories: {
      list: listCall,
      forget: () => Promise.resolve({ ok: true, value: { owned: true, entries: [] } }),
    },
  })
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
type Handle = ReturnType<typeof createMemorySectionStore>

/** The slot entry this section registered. */
function entryOf(slots: SlotRegistry) {
  const entry = slots.entries(SLOT).find(one => one.component === MemorySection)
  if (entry === undefined) throw new Error('the memory section did not register')
  return entry
}

describe('ui-settings-memory apply', () => {
  it('registers into the personal plane, after the instructions', async () => {
    const { slots } = await bench()
    expect(entryOf(slots).options).toMatchObject({ id: 'memory', order: 20 })
  })

  it('names itself in the navigation with its own copy', async () => {
    const { slots, locale } = await bench()
    const label = entryOf(slots).options.label
    expect(typeof label === 'function' ? label() : label).toBe('记忆')
    expect(locale.bind(NS)('title')).toBe('关于你的记忆')
  })

  it('reads nothing until the section opens', async () => {
    const listCall = vi.fn(() => Promise.resolve({ ok: true as const, value: VIEW }))
    await bench(listCall)
    expect(listCall).not.toHaveBeenCalled()
  })

  it('reads and removes through the Remote namespace the deployment answers on', async () => {
    const listCall = vi.fn(() => Promise.resolve({ ok: true as const, value: VIEW }))
    const { ctx } = await bench(listCall)
    const calls = memoryCallsOf(ctx)
    expect(await calls.list()).toEqual({ ok: true, value: VIEW })
    expect(await calls.forget('one')).toEqual({ ok: true, value: { owned: true, entries: [] } })
    expect(listCall).toHaveBeenCalledOnce()
  })

  it('declares a store the section reads through', async () => {
    const { slots } = await bench()
    const handle = entryOf(slots).store as Handle
    expect(handle.create().store.getSnapshot()).toEqual({
      status: 'idle', entries: [], removing: undefined, refused: undefined,
    })
  })

  it('declares a store whose writes move the read and the removal through their states', async () => {
    const { slots } = await bench()
    const instance = (entryOf(slots).store as Handle).create()
    instance.actions.begin()
    expect(instance.store.getSnapshot().status).toBe('loading')
    instance.actions.succeed(VIEW)
    expect(instance.store.getSnapshot()).toMatchObject({ status: 'ready', entries: VIEW.entries })
    instance.actions.work('one')
    expect(instance.store.getSnapshot()).toMatchObject({ removing: 'one', refused: undefined })
    instance.actions.refused('gone')
    expect(instance.store.getSnapshot()).toMatchObject({ removing: undefined, refused: 'gone' })
    instance.actions.fail()
    expect(instance.store.getSnapshot().status).toBe('failed')
    instance.actions.reset()
    expect(instance.store.getSnapshot().status).toBe('idle')
  })

  it('says it owns nothing for a call that speaks for nobody', async () => {
    const { slots } = await bench()
    const instance = (entryOf(slots).store as Handle).create()
    instance.actions.succeed({ owned: false, entries: [] })
    expect(instance.store.getSnapshot().status).toBe('unowned')
  })

  it('stops offering the section when its plugin is unloaded', async () => {
    const { slots, fiber } = await bench()
    expect(slots.entries(SLOT).filter(one => one.component === MemorySection)).toHaveLength(1)
    await fiber.dispose()
    expect(slots.entries(SLOT).filter(one => one.component === MemorySection)).toHaveLength(0)
  })
})
