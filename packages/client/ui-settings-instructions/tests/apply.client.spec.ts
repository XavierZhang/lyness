/**
 * The section's wiring: where it registers, the store it declares, its own
 * locale namespace, and that nothing is read until the section opens.
 *
 * The calls' own behaviour is pinned in `operations.client.spec.ts`, against
 * the operations directly, so this spec never reaches into the framework's
 * type-erased inject factory.
 */

import { Context } from '@lyness/cordis'
import { describe, expect, it, vi } from 'vitest'
import { SlotRegistry } from '@lyness/lyn-client-ui-renderer/client'
import { LocaleRuntime } from '@lyness/lyn-client-locale/client'
import { TestRemote } from '@lyness/lyn-client-test-runtime'
import type { InstructionsView } from '@lyness/lyn-api-personal-instructions-controller/types'
import { apply, inject, instructionsCallsOf, NS } from '@lyness/lyn-client-ui-settings-instructions/client'
import { InstructionsSection } from '../src/client/InstructionsSection.tsx'
import type { createInstructionsSectionStore } from '../src/client/store.ts'

const SLOT = 'settings.section'

const VIEW: InstructionsView = {
  owned: true,
  text: 'Call me Sam.',
  writtenAt: '2026-10-28T00:00:00.000Z',
  maxChars: 4_000,
}

/** A context with the slot registry, a locale, and the section mounted. */
async function bench(describeCall: () => Promise<unknown> = () => Promise.resolve({ ok: true, value: VIEW })) {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  locale.setLocale('zh')
  ctx.provide('locale', locale)
  const events = new TestRemote(ctx, {
    personalInstructions: {
      describe: describeCall,
      save: () => Promise.resolve({ ok: true, value: VIEW }),
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
  return { ctx, slots, locale, declared, fiber, remote: events }
}

/** The store handle this section registered. */
type Handle = ReturnType<typeof createInstructionsSectionStore>

/** The slot entry this section registered. */
function entryOf(slots: SlotRegistry) {
  const entry = slots.entries(SLOT).find(one => one.component === InstructionsSection)
  if (entry === undefined) throw new Error('the instructions section did not register')
  return entry
}

describe('ui-settings-instructions apply', () => {
  it('mounts the namespace it calls rather than relying on another plugin to', async () => {
    const { remote } = await bench()
    expect(remote.mounted).toHaveLength(1)
  })

  it('registers into the personal plane, after General', async () => {
    const { slots } = await bench()
    expect(entryOf(slots).options).toMatchObject({ id: 'instructions', order: 10 })
  })

  it('names itself in the navigation with its own copy', async () => {
    const { slots, locale } = await bench()
    const label = entryOf(slots).options.label
    expect(typeof label === 'function' ? label() : label).toBe('指令')
    expect(locale.bind(NS)('title')).toBe('你的指令')
  })

  it('reads nothing until the section opens', async () => {
    const describeCall = vi.fn(() => Promise.resolve({ ok: true as const, value: VIEW }))
    await bench(describeCall)
    expect(describeCall).not.toHaveBeenCalled()
  })

  it('reads and writes through the Remote namespace the deployment answers on', async () => {
    const describeCall = vi.fn(() => Promise.resolve({ ok: true as const, value: VIEW }))
    const { ctx } = await bench(describeCall)
    const calls = instructionsCallsOf(ctx)
    expect(await calls.describe()).toEqual({ ok: true, value: VIEW })
    expect(await calls.save('Call me Sam.')).toEqual({ ok: true, value: VIEW })
    expect(describeCall).toHaveBeenCalledOnce()
  })

  it('declares a store the section reads through', async () => {
    const { slots } = await bench()
    const handle = entryOf(slots).store as Handle
    expect(handle.create().store.getSnapshot()).toEqual({
      status: 'idle', saved: '', writtenAt: undefined, maxChars: 0, working: false, outcome: undefined,
    })
  })

  it('declares a store whose writes move the read and the save through their states', async () => {
    const { slots } = await bench()
    const instance = (entryOf(slots).store as Handle).create()
    instance.actions.begin()
    expect(instance.store.getSnapshot().status).toBe('loading')
    instance.actions.succeed(VIEW)
    expect(instance.store.getSnapshot()).toMatchObject({
      status: 'ready', saved: 'Call me Sam.', writtenAt: VIEW.writtenAt, maxChars: 4_000,
    })
    instance.actions.work()
    expect(instance.store.getSnapshot()).toMatchObject({ working: true, outcome: undefined })
    instance.actions.saved({ ...VIEW, text: 'Call me Alex.' })
    expect(instance.store.getSnapshot()).toMatchObject({
      working: false, saved: 'Call me Alex.', outcome: { kind: 'saved' },
    })
    instance.actions.refused('too long')
    expect(instance.store.getSnapshot()).toMatchObject({
      working: false, outcome: { kind: 'refused', reason: 'too long' },
    })
    instance.actions.fail()
    expect(instance.store.getSnapshot().status).toBe('failed')
    instance.actions.reset()
    expect(instance.store.getSnapshot().status).toBe('idle')
  })

  it('says it owns nothing for a call that speaks for nobody', async () => {
    const { slots } = await bench()
    const instance = (entryOf(slots).store as Handle).create()
    instance.actions.succeed({ owned: false, text: '', maxChars: 4_000 })
    expect(instance.store.getSnapshot().status).toBe('unowned')
  })

  it('stops offering the section when its plugin is unloaded', async () => {
    const { slots, fiber } = await bench()
    expect(slots.entries(SLOT).filter(one => one.component === InstructionsSection)).toHaveLength(1)
    await fiber.dispose()
    expect(slots.entries(SLOT).filter(one => one.component === InstructionsSection)).toHaveLength(0)
  })
})
