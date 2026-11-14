/**
 * What the shared viewer service answers: one read for every surface, the
 * plane that read decides, and what each of its three product shapes gets.
 */

import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { TestRemote } from '@deepseek-ai/dsh-client-test-runtime'
import type { ViewerView } from '@deepseek-ai/dsh-api-identity-controller/types'
import { apply, inject } from '@deepseek-ai/dsh-client-ui-viewer/client'
import { administers } from '../src/client/plane.ts'
import { UiViewer } from '../src/client/viewer.ts'

const SAAS_MEMBER: ViewerView = {
  accounts: true,
  person: { id: 'ada', displayName: 'Ada' },
  standing: { id: 's', role: 'member', organization: 'acme' },
  standings: [{ id: 's', role: 'member', organization: 'acme' }],
  channels: [],
  signInPrefix: '/auth/sign-in',
  signOutPath: '/auth/sign-out',
}

/** The same person with two standings and neither in force. */
const UNDECIDED: ViewerView = (() => {
  const { standing: _inForce, ...rest } = SAAS_MEMBER
  return {
    ...rest,
    standings: [
      { id: 'ada:acme', role: 'member', organization: 'acme' },
      { id: 'ada:beta', role: 'tenant-administrator', organization: 'beta' },
    ],
  }
})()

/** A context carrying the viewer service over a controllable read. */
async function bench(
  viewer: () => Promise<unknown>,
  act: (standing: string) => Promise<unknown> = () => Promise.resolve({ ok: true, value: SAAS_MEMBER }),
) {
  const ctx = new Context()
  const events = new TestRemote(ctx, { identity: { viewer, act } })
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

  it('publishes who the viewer is afterwards when a standing is put in force', async () => {
    const act = vi.fn((standing: string) => Promise.resolve({
      ok: true as const,
      value: { ...UNDECIDED, standing: UNDECIDED.standings.find(one => one.id === standing) },
    }))
    const { ctx } = await bench(() => Promise.resolve({ ok: true, value: UNDECIDED }), act)
    await ctx.uiViewer.load()
    // Nothing in force, so nothing administers yet.
    expect(ctx.uiViewer.state.getSnapshot().administers).toBe(false)

    expect(await ctx.uiViewer.act('ada:beta')).toBe(true)
    expect(act).toHaveBeenCalledWith('ada:beta')
    // The deployment's own answer, published once for every surface: the
    // tenant standing now administers.
    expect(ctx.uiViewer.state.getSnapshot()).toMatchObject({
      status: 'ready',
      administers: true,
      viewer: { standing: { id: 'ada:beta', role: 'tenant-administrator', organization: 'beta' } },
    })
  })

  it('leaves the previous answer standing when the change is refused', async () => {
    const { ctx } = await bench(
      () => Promise.resolve({ ok: true, value: UNDECIDED }),
      () => Promise.resolve({ ok: false }),
    )
    await ctx.uiViewer.load()
    const before = ctx.uiViewer.state.getSnapshot()

    expect(await ctx.uiViewer.act('ada:nowhere')).toBe(false)
    // A refused change produced no answer, so there is nothing to publish.
    expect(ctx.uiViewer.state.getSnapshot()).toBe(before)
  })

  it('is the service it says it is, and goes away with its fiber', async () => {
    const { ctx, fiber } = await bench(() => Promise.resolve({ ok: true, value: SAAS_MEMBER }))
    expect(ctx.uiViewer).toBeInstanceOf(UiViewer)
    await fiber.dispose()
    expect(ctx.get('uiViewer')).toBeUndefined()
  })
})
