/**
 * What the shared viewer service answers: one read for every surface, the
 * plane that read decides, and what each of its three product shapes gets.
 */

import { Context } from '@lyness/cordis'
import { describe, expect, it, vi } from 'vitest'
import { TestRemote } from '@lyness/lyn-client-test-runtime'
import type { ViewerView } from '@lyness/lyn-api-identity-controller/types'
import { apply, inject } from '@lyness/lyn-client-ui-viewer/client'
import { administers } from '../src/client/plane.ts'
import { UiViewer } from '../src/client/viewer.ts'

const SAAS_MEMBER: ViewerView = {
  accounts: true,
  person: { id: 'ada', displayName: 'Ada' },
  standing: { id: 's', role: 'member', organization: 'acme' },
  channels: [],
  signInPrefix: '/auth/sign-in',
  signOutPath: '/auth/sign-out',
}

/** A context carrying the viewer service over a controllable read. */
async function bench(viewer: () => Promise<unknown>) {
  const ctx = new Context()
  const events = new TestRemote(ctx, { identity: { viewer } })
  events.$host = { home: undefined, isLoopback: true }
  const fiber = ctx.plugin({ inject: [...inject], apply })
  await fiber.await()
  return { ctx, fiber }
}

describe('administers', () => {
  it('offers the administration plane to the single-operator shape', () => {
    expect(administers({ ...SAAS_MEMBER, accounts: false })).toBe(true)
  })

  it('offers it to a standing above member', () => {
    expect(administers({ ...SAAS_MEMBER, standing: { id: 's', role: 'tenant-administrator', organization: 'acme' } })).toBe(true)
    expect(administers({ ...SAAS_MEMBER, standing: { id: 's', role: 'platform-administrator' } })).toBe(true)
  })

  it('withholds it from a member and from a personal context', () => {
    expect(administers(SAAS_MEMBER)).toBe(false)
    const personal: ViewerView = { ...SAAS_MEMBER }
    delete (personal as { standing?: unknown }).standing
    expect(administers(personal)).toBe(false)
  })

  it('withholds it while no read has answered', () => {
    expect(administers(undefined)).toBe(false)
  })
})

describe('UiViewer', () => {
  it('starts idle and reads nothing until something asks', async () => {
    const viewer = vi.fn(() => Promise.resolve({ ok: true as const, value: SAAS_MEMBER }))
    const { ctx } = await bench(viewer)
    expect(ctx.uiViewer.state.getSnapshot()).toEqual({ status: 'idle', viewer: undefined, administers: false })
    expect(viewer).not.toHaveBeenCalled()
  })

  it('answers one read to every caller that asks at once', async () => {
    const viewer = vi.fn(() => Promise.resolve({ ok: true as const, value: SAAS_MEMBER }))
    const { ctx } = await bench(viewer)
    await Promise.all([ctx.uiViewer.load(), ctx.uiViewer.load(), ctx.uiViewer.load()])
    expect(viewer).toHaveBeenCalledOnce()
    expect(ctx.uiViewer.state.getSnapshot()).toEqual({ status: 'ready', viewer: SAAS_MEMBER, administers: false })
  })

  it('publishes the plane the answer decides', async () => {
    const standing = { id: 's', role: 'tenant-administrator' as const, organization: 'acme' }
    const { ctx } = await bench(() => Promise.resolve({ ok: true, value: { ...SAAS_MEMBER, standing } }))
    await ctx.uiViewer.load()
    expect(ctx.uiViewer.state.getSnapshot().administers).toBe(true)
  })

  it('reports the attempt while it runs', async () => {
    let settle = (): void => {}
    const pending = new Promise<void>((resolve) => { settle = resolve })
    const { ctx } = await bench(async () => {
      await pending
      return { ok: true as const, value: SAAS_MEMBER }
    })
    const running = ctx.uiViewer.load()
    expect(ctx.uiViewer.state.getSnapshot().status).toBe('loading')
    settle()
    await running
    expect(ctx.uiViewer.state.getSnapshot().status).toBe('ready')
  })

  it('withholds the plane again when a read fails', async () => {
    let answer: () => Promise<{ ok: boolean; value?: ViewerView }> = () =>
      Promise.resolve({ ok: true, value: { ...SAAS_MEMBER, accounts: false } })
    const { ctx } = await bench(() => answer())
    await ctx.uiViewer.load()
    expect(ctx.uiViewer.state.getSnapshot().administers).toBe(true)
    answer = () => Promise.reject(new Error('the carrier went away'))
    await ctx.uiViewer.retry()
    expect(ctx.uiViewer.state.getSnapshot()).toEqual({ status: 'failed', viewer: undefined, administers: false })
  })

  it('shows the attempt rather than the failure it replaces', async () => {
    const seen: string[] = []
    let answer: () => Promise<{ ok: boolean; value?: ViewerView }> = () => Promise.resolve({ ok: false })
    const { ctx } = await bench(() => answer())
    ctx.uiViewer.state.subscribe(() => { seen.push(ctx.uiViewer.state.getSnapshot().status) })
    await ctx.uiViewer.load()
    answer = () => Promise.resolve({ ok: true, value: SAAS_MEMBER })
    await ctx.uiViewer.retry()
    expect(seen).toEqual(['loading', 'failed', 'idle', 'loading', 'ready'])
  })

  it('is the service it says it is, and goes away with its fiber', async () => {
    const { ctx, fiber } = await bench(() => Promise.resolve({ ok: true, value: SAAS_MEMBER }))
    expect(ctx.uiViewer).toBeInstanceOf(UiViewer)
    await fiber.dispose()
    expect(ctx.get('uiViewer')).toBeUndefined()
  })
})
