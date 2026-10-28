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
import type { ChannelKindView, ConfiguredChannelView } from '@deepseek-ai/dsh-api-sign-in-channel-controller/types'
import { apply, channelsCallsOf, inject, NS } from '@deepseek-ai/dsh-client-ui-settings-sign-in-channels/client'
import { ChannelsSection } from '../src/client/ChannelsSection.tsx'
import type { createChannelsSectionStore } from '../src/client/store.ts'

const SLOT = 'settings.section'

const KIND: ChannelKindView = {
  id: 'wecom',
  displayName: '企业微信',
  fields: [{ name: 'corpId', label: 'corpid', required: true }],
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
async function bench(list: () => Promise<unknown> = () => Promise.resolve({ ok: true, value: [CHANNEL] })) {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  locale.setLocale('zh')
  ctx.provide('locale', locale)
  const events = new TestRemote(ctx, {
    signInChannels: {
      kinds: () => Promise.resolve({ ok: true, value: [KIND] }),
      list,
      save: () => Promise.resolve({ ok: true, value: CHANNEL }),
      remove: () => Promise.resolve({ ok: true, value: undefined }),
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
type Handle = ReturnType<typeof createChannelsSectionStore>

/** The slot entry this section registered. */
function entryOf(slots: SlotRegistry) {
  const entry = slots.entries(SLOT).find(one => one.component === ChannelsSection)
  if (entry === undefined) throw new Error('the sign-in channels section did not register')
  return entry
}

describe('ui-settings-sign-in-channels apply', () => {
  it('registers after the credits section', async () => {
    const { slots } = await bench()
    expect(entryOf(slots).options).toMatchObject({ id: 'sign-in-channels', order: 30 })
  })

  it('names itself in the navigation with its own copy', async () => {
    const { slots, locale } = await bench()
    const label = entryOf(slots).options.label
    expect(typeof label === 'function' ? label() : label).toBe('登录')
    expect(locale.bind(NS)('title')).toBe('登录渠道')
  })

  it('reads nothing until the section opens', async () => {
    const list = vi.fn(() => Promise.resolve({ ok: true as const, value: [CHANNEL] }))
    await bench(list)
    expect(list).not.toHaveBeenCalled()
  })

  it('reads and changes through the Remote namespace the deployment answers on', async () => {
    const list = vi.fn(() => Promise.resolve({ ok: true as const, value: [CHANNEL] }))
    const { ctx } = await bench(list)
    const calls = channelsCallsOf(ctx)
    expect(await calls.kinds()).toEqual({ ok: true, value: [KIND] })
    expect(await calls.list()).toEqual({ ok: true, value: [CHANNEL] })
    expect(await calls.save({ kind: 'wecom', displayName: 'Head office', settings: {} })).toEqual({ ok: true, value: CHANNEL })
    expect(await calls.remove('one')).toEqual({ ok: true, value: undefined })
    expect(list).toHaveBeenCalledOnce()
  })

  it('declares a store the section reads through', async () => {
    const { slots } = await bench()
    const handle = entryOf(slots).store as Handle
    expect(handle.create().store.getSnapshot()).toEqual({
      status: 'idle', kinds: [], channels: [], working: false, outcome: undefined,
    })
  })

  it('declares a store whose writes move the read through its states', async () => {
    const { slots } = await bench()
    const instance = (entryOf(slots).store as Handle).create()
    instance.actions.begin()
    expect(instance.store.getSnapshot().status).toBe('loading')
    instance.actions.succeed({ kinds: [KIND], channels: [CHANNEL] })
    expect(instance.store.getSnapshot()).toMatchObject({ status: 'ready', kinds: [KIND], channels: [CHANNEL] })
    instance.actions.fail('forbidden')
    expect(instance.store.getSnapshot().status).toBe('forbidden')
    instance.actions.reset()
    expect(instance.store.getSnapshot().status).toBe('idle')
  })

  it('replaces a renamed channel in place rather than listing it twice', async () => {
    const { slots } = await bench()
    const instance = (entryOf(slots).store as Handle).create()
    instance.actions.succeed({ kinds: [KIND], channels: [CHANNEL] })
    instance.actions.work()
    instance.actions.saved({ ...CHANNEL, displayName: 'Shanghai office' })
    expect(instance.store.getSnapshot().channels).toEqual([{ ...CHANNEL, displayName: 'Shanghai office' }])

    instance.actions.saved({ ...CHANNEL, id: 'two', displayName: 'Branch' })
    expect(instance.store.getSnapshot().channels).toHaveLength(2)

    instance.actions.saved({ ...CHANNEL, id: 'two', displayName: 'Shenzhen branch' })
    expect(instance.store.getSnapshot().channels.map(one => one.displayName))
      .toEqual(['Shanghai office', 'Shenzhen branch'])
  })

  it('drops a removed channel, and keeps the fields a refusal named', async () => {
    const { slots } = await bench()
    const instance = (entryOf(slots).store as Handle).create()
    instance.actions.succeed({ kinds: [KIND], channels: [CHANNEL] })
    instance.actions.work()
    instance.actions.removed('one')
    expect(instance.store.getSnapshot()).toMatchObject({ working: false, channels: [], outcome: { kind: 'removed' } })

    instance.actions.work()
    expect(instance.store.getSnapshot().outcome).toBeUndefined()
    instance.actions.refused({ reason: 'needs corpId', fields: ['corpId'] })
    expect(instance.store.getSnapshot()).toMatchObject({
      working: false, outcome: { kind: 'refused', reason: 'needs corpId', fields: ['corpId'] },
    })
  })

  it('stops offering the section when its plugin is unloaded', async () => {
    const { slots, fiber } = await bench()
    expect(slots.entries(SLOT).filter(one => one.component === ChannelsSection)).toHaveLength(1)
    await fiber.dispose()
    expect(slots.entries(SLOT).filter(one => one.component === ChannelsSection)).toHaveLength(0)
  })
})
