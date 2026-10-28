/**
 * The surface's wiring: where each half registers, the stores they declare,
 * the shared read behind both, and that nothing is read until something asks.
 */

import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { TestRemote } from '@deepseek-ai/dsh-client-test-runtime'
import type { ViewerView } from '@deepseek-ai/dsh-api-identity-controller/types'
import { apply, inject, NS, viewerReadOf } from '@deepseek-ai/dsh-client-ui-sign-in/client'
import { AccountRow } from '../src/client/AccountRow.tsx'
import { SignInScreen } from '../src/client/SignInScreen.tsx'
import type { createViewerStore } from '../src/client/store.ts'

const VIEWER: ViewerView = {
  accounts: true,
  channels: [{ id: 'wecom', displayName: '企业微信', redirect: true }],
  signInPrefix: '/auth/sign-in',
  signOutPath: '/auth/sign-out',
}

/** The store handle one registered surface declared. */
type Handle = ReturnType<typeof createViewerStore>

/** A context with the slot registry, a locale, and both surfaces mounted. */
async function bench(viewer: () => Promise<unknown> = () => Promise.resolve({ ok: true, value: VIEWER })) {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  locale.setLocale('zh')
  ctx.provide('locale', locale)
  const events = new TestRemote(ctx, { identity: { viewer } })
  events.$host = { home: undefined, isLoopback: true }
  const slots = ctx.get('slots') as SlotRegistry
  const declared = slots.register(
    {
      name: 'root',
      children: {
        'shell.overlay': { kind: 'list', scope: 'root' },
        'settings.general.item': { kind: 'list', scope: 'root' },
      },
    } as never,
    () => null,
  )
  const fiber = ctx.plugin({ inject: [...inject], apply })
  await fiber.await()
  return { ctx, slots, locale, declared, fiber }
}

describe('ui-sign-in apply', () => {
  it('covers the product from the frame-wide layer', async () => {
    const { slots } = await bench()
    const entry = slots.entries('shell.overlay').find(one => one.component === SignInScreen)
    expect(entry?.options).toMatchObject({ id: 'sign-in' })
  })

  it('names who is signed in from General Settings', async () => {
    const { slots } = await bench()
    const entry = slots.entries('settings.general.item').find(one => one.component === AccountRow)
    expect(entry?.options).toMatchObject({ id: 'sign-in', order: 20 })
  })

  it('registers its own copy under its own namespace', async () => {
    const { locale } = await bench()
    expect(locale.bind(NS)('title')).toBe('登录')
  })

  it('declares a store for each surface to read through', async () => {
    const { slots } = await bench()
    for (const [slot, component] of [['shell.overlay', SignInScreen], ['settings.general.item', AccountRow]] as const) {
      const entry = slots.entries(slot).find(one => one.component === component)
      const handle = entry?.store as Handle
      expect(handle.create().store.getSnapshot()).toEqual({ status: 'idle', viewer: undefined })
    }
  })

  it('declares a store whose writes move the read through its states', async () => {
    const { slots } = await bench()
    const entry = slots.entries('shell.overlay').find(one => one.component === SignInScreen)
    const instance = (entry?.store as Handle).create()
    instance.actions.begin()
    expect(instance.store.getSnapshot().status).toBe('loading')
    instance.actions.succeed(VIEWER)
    expect(instance.store.getSnapshot()).toEqual({ status: 'ready', viewer: VIEWER })
    instance.actions.fail()
    // The viewer it already read stays: a surface that blanked on a failed
    // refresh would cover a signed-in person's product with a sign-in screen.
    expect(instance.store.getSnapshot()).toMatchObject({ status: 'failed', viewer: VIEWER })
    instance.actions.reset()
    expect(instance.store.getSnapshot().status).toBe('idle')
  })

  it('reads nothing until a surface asks', async () => {
    const viewer = vi.fn(() => Promise.resolve({ ok: true as const, value: VIEWER }))
    await bench(viewer)
    expect(viewer).not.toHaveBeenCalled()
  })

  it('reads through the Remote namespace the deployment answers on', async () => {
    const viewer = vi.fn(() => Promise.resolve({ ok: true as const, value: VIEWER }))
    const { ctx } = await bench(viewer)
    expect(await viewerReadOf(ctx)()).toEqual({ ok: true, value: VIEWER })
    expect(viewer).toHaveBeenCalledOnce()
  })

  it('stops offering both surfaces when its plugin is unloaded', async () => {
    const { slots, fiber } = await bench()
    expect(slots.entries('shell.overlay').filter(one => one.component === SignInScreen)).toHaveLength(1)
    expect(slots.entries('settings.general.item').filter(one => one.component === AccountRow)).toHaveLength(1)
    await fiber.dispose()
    expect(slots.entries('shell.overlay').filter(one => one.component === SignInScreen)).toHaveLength(0)
    expect(slots.entries('settings.general.item').filter(one => one.component === AccountRow)).toHaveLength(0)
  })
})
