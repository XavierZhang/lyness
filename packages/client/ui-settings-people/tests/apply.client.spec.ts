/**
 * The section's wiring: where it registers, the store it declares, its own
 * locale namespace, and that nothing is read until the section opens.
 *
 * The calls' own behaviour is pinned in `operations.client.spec.ts`, against
 * the operations directly, so this spec never reaches into the framework's
 * type-erased inject factory.
 */

import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { TestRemote } from '@deepseek-ai/dsh-client-test-runtime'
import type { PersonRowView } from '@deepseek-ai/dsh-api-people-controller/types'
import type { ConfiguredChannelView } from '@deepseek-ai/dsh-api-sign-in-channel-controller/types'
import { apply, inject, NS, peopleCallsOf } from '@deepseek-ai/dsh-client-ui-settings-people/client'
import { PeopleSection } from '../src/client/PeopleSection.tsx'
import type { createPeopleSectionStore } from '../src/client/store.ts'

const SLOT = 'settings.section'

const PERSON: PersonRowView = {
  id: 'bea',
  displayName: 'Bea',
  role: 'member',
  organization: 'acme',
  written: false,
  bindings: [],
}

const CHANNEL: ConfiguredChannelView = {
  id: 'one',
  kind: 'wecom',
  displayName: 'Head office',
  settings: { corpId: 'ww-acme' },
  configuredAt: '2026-10-17T00:00:00.000Z',
  configuredBy: 'ada',
  mounted: true,
}

/** A context with the slot registry, a locale, and the section mounted. */
async function bench(list: () => Promise<unknown> = () => Promise.resolve({ ok: true, value: [PERSON] })) {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  locale.setLocale('zh')
  ctx.provide('locale', locale)
  const events = new TestRemote(ctx, {
    people: {
      list,
      save: () => Promise.resolve({ ok: true, value: PERSON }),
      remove: () => Promise.resolve({ ok: true, value: undefined }),
      bind: () => Promise.resolve({ ok: true, value: undefined }),
      unbind: () => Promise.resolve({ ok: true, value: undefined }),
    },
    signInChannels: {
      list: () => Promise.resolve({ ok: true, value: [CHANNEL] }),
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
type Handle = ReturnType<typeof createPeopleSectionStore>

/** The slot entry this section registered. */
function entryOf(slots: SlotRegistry) {
  const entry = slots.entries(SLOT).find(one => one.component === PeopleSection)
  if (entry === undefined) throw new Error('the people section did not register')
  return entry
}

describe('ui-settings-people apply', () => {
  it('registers after the sign-in channels section', async () => {
    const { slots } = await bench()
    // Admitting somebody names the channel that authenticates them, so the
    // channel is configured first.
    expect(entryOf(slots).options).toMatchObject({ id: 'people', order: 35 })
  })

  it('names itself in the navigation with its own copy', async () => {
    const { slots, locale } = await bench()
    const label = entryOf(slots).options.label
    expect(typeof label === 'function' ? label() : label).toBe('人员')
    expect(locale.bind(NS)('title')).toBe('人员')
  })

  it('reads nothing until the section opens', async () => {
    const list = vi.fn(() => Promise.resolve({ ok: true as const, value: [PERSON] }))
    await bench(list)
    expect(list).not.toHaveBeenCalled()
  })

  it('reads and changes through the Remote namespaces the deployment answers on', async () => {
    const list = vi.fn(() => Promise.resolve({ ok: true as const, value: [PERSON] }))
    const { ctx } = await bench(list)
    const calls = peopleCallsOf(ctx)
    expect(await calls.list()).toEqual({ ok: true, value: [PERSON] })
    expect(await calls.channels()).toEqual({ ok: true, value: [CHANNEL] })
    expect(await calls.save({ displayName: 'Bea', role: 'member' })).toEqual({ ok: true, value: PERSON })
    expect(await calls.remove('bea')).toEqual({ ok: true, value: undefined })
    expect(await calls.bind({ channel: 'one', issuer: 'ww-acme', subject: 'bea', person: 'bea' }))
      .toEqual({ ok: true, value: undefined })
    expect(await calls.unbind({ channel: 'one', issuer: 'ww-acme', subject: 'bea' }))
      .toEqual({ ok: true, value: undefined })
    expect(list).toHaveBeenCalledOnce()
  })

  it('declares a store the section reads through', async () => {
    const { slots } = await bench()
    const handle = entryOf(slots).store as Handle
    expect(handle.create().store.getSnapshot()).toEqual({
      status: 'idle', people: [], channels: [], working: false, outcome: undefined,
    })
  })

  it('declares a store whose writes move the read through its states', async () => {
    const { slots } = await bench()
    const instance = (entryOf(slots).store as Handle).create()
    instance.actions.begin()
    expect(instance.store.getSnapshot().status).toBe('loading')
    instance.actions.succeed({ people: [PERSON], channels: [CHANNEL] })
    expect(instance.store.getSnapshot()).toMatchObject({ status: 'ready', people: [PERSON], channels: [CHANNEL] })
    instance.actions.fail('forbidden')
    expect(instance.store.getSnapshot().status).toBe('forbidden')
    instance.actions.reset()
    expect(instance.store.getSnapshot().status).toBe('idle')
  })

  it('replaces a renamed person in place rather than listing them twice', async () => {
    const { slots } = await bench()
    const instance = (entryOf(slots).store as Handle).create()
    instance.actions.succeed({ people: [PERSON], channels: [CHANNEL] })
    instance.actions.work()
    instance.actions.saved({ ...PERSON, displayName: 'Beatrice' })
    expect(instance.store.getSnapshot().people).toEqual([{ ...PERSON, displayName: 'Beatrice' }])

    instance.actions.saved({ ...PERSON, id: 'cai', displayName: 'Cai' })
    expect(instance.store.getSnapshot().people).toHaveLength(2)

    instance.actions.saved({ ...PERSON, id: 'cai', displayName: 'Cai Ming' })
    expect(instance.store.getSnapshot().people.map(one => one.displayName)).toEqual(['Beatrice', 'Cai Ming'])
  })

  it('drops a removed person, and keeps the fields a refusal named', async () => {
    const { slots } = await bench()
    const instance = (entryOf(slots).store as Handle).create()
    instance.actions.succeed({ people: [PERSON], channels: [CHANNEL] })
    instance.actions.work()
    instance.actions.removed('bea')
    expect(instance.store.getSnapshot()).toMatchObject({ working: false, people: [], outcome: { kind: 'removed' } })

    instance.actions.work()
    expect(instance.store.getSnapshot().outcome).toBeUndefined()
    instance.actions.refused({ reason: 'needs an organization', fields: ['organization'] })
    expect(instance.store.getSnapshot()).toMatchObject({
      working: false, outcome: { kind: 'refused', reason: 'needs an organization', fields: ['organization'] },
    })
  })

  it('takes the people the server read back after an identity change', async () => {
    const { slots } = await bench()
    const instance = (entryOf(slots).store as Handle).create()
    instance.actions.succeed({ people: [PERSON], channels: [] })
    instance.actions.work()
    const bound: PersonRowView = {
      ...PERSON,
      bindings: [{ channel: 'one', issuer: 'ww-acme', subject: 'bea', written: false }],
    }
    instance.actions.admitted({
      read: { people: [bound], channels: [CHANNEL] },
      outcome: { kind: 'bound', subject: 'bea' },
    })
    expect(instance.store.getSnapshot()).toMatchObject({
      working: false,
      people: [bound],
      channels: [CHANNEL],
      outcome: { kind: 'bound', subject: 'bea' },
    })
  })

  it('stops offering the section when its plugin is unloaded', async () => {
    const { slots, fiber } = await bench()
    expect(slots.entries(SLOT).filter(one => one.component === PeopleSection)).toHaveLength(1)
    await fiber.dispose()
    expect(slots.entries(SLOT).filter(one => one.component === PeopleSection)).toHaveLength(0)
  })
})
