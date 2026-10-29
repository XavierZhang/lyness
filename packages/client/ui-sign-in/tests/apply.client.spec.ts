/**
 * The surface's wiring: where each half registers, the face they are handed,
 * the one shared read behind both, and that nothing is read until something
 * asks.
 */

import { Context } from '@lyness/cordis'
import { describe, expect, it, vi } from 'vitest'
import { SlotRegistry } from '@lyness/lyn-client-ui-renderer/client'
import { LocaleRuntime } from '@lyness/lyn-client-locale/client'
import { TestRemote } from '@lyness/lyn-client-test-runtime'
import type { ViewerView } from '@lyness/lyn-api-identity-controller/types'
import * as viewerPlugin from '@lyness/lyn-client-ui-viewer/client'
import { apply, inject, NS } from '@lyness/lyn-client-ui-sign-in/client'
import { AccountRow } from '../src/client/AccountRow.tsx'
import { SignInScreen } from '../src/client/SignInScreen.tsx'

const VIEWER: ViewerView = {
  accounts: true,
  channels: [{ id: 'wecom', displayName: '企业微信', redirect: true }],
  signInPrefix: '/auth/sign-in',
  signOutPath: '/auth/sign-out',
}

/** The business face one registered surface was handed, as the ledger stores it. */
function faceOf(entry: { inject?: ((...args: never[]) => Record<string, unknown>) | undefined } | undefined) {
  const inject = entry?.inject
  if (inject === undefined) throw new Error('expected the surface to declare an inject face')
  return inject()
}

/** A context with the slot registry, a locale, the viewer service, and both surfaces. */
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
  await ctx.plugin({ inject: [...viewerPlugin.inject], apply: viewerPlugin.apply }).await()
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

  it('hands both surfaces the one snapshot the viewer service owns', async () => {
    const { ctx, slots } = await bench()
    const screen = slots.entries('shell.overlay').find(one => one.component === SignInScreen)
    const row = slots.entries('settings.general.item').find(one => one.component === AccountRow)
    const screenHooks = faceOf(screen).hooks as { viewer: unknown }
    const rowHooks = faceOf(row).hooks as { viewer: unknown }
    expect(screenHooks.viewer).toBe(ctx.uiViewer.state)
    expect(rowHooks.viewer).toBe(ctx.uiViewer.state)
  })

  it('reads nothing until a surface asks', async () => {
    const viewer = vi.fn(() => Promise.resolve({ ok: true as const, value: VIEWER }))
    await bench(viewer)
    expect(viewer).not.toHaveBeenCalled()
  })

  it('reads once for both surfaces when each asks', async () => {
    const viewer = vi.fn(() => Promise.resolve({ ok: true as const, value: VIEWER }))
    const { ctx, slots } = await bench(viewer)
    const screen = slots.entries('shell.overlay').find(one => one.component === SignInScreen)
    const row = slots.entries('settings.general.item').find(one => one.component === AccountRow)
    const screenLoad = faceOf(screen).load as () => Promise<void>
    const rowLoad = faceOf(row).load as () => Promise<void>
    await Promise.all([screenLoad(), rowLoad()])
    expect(viewer).toHaveBeenCalledOnce()
    expect(ctx.uiViewer.state.getSnapshot()).toMatchObject({ status: 'ready', viewer: VIEWER })
  })

  it('gives the screen, and only the screen, a way to ask again', async () => {
    const viewer = vi.fn(() => Promise.resolve({ ok: true as const, value: VIEWER }))
    const { slots } = await bench(viewer)
    const screen = slots.entries('shell.overlay').find(one => one.component === SignInScreen)
    const row = slots.entries('settings.general.item').find(one => one.component === AccountRow)
    expect(faceOf(row).retry).toBeUndefined()
    const screenFace = faceOf(screen)
    await (screenFace.load as () => Promise<void>)()
    await (screenFace.retry as () => Promise<void>)()
    expect(viewer).toHaveBeenCalledTimes(2)
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
