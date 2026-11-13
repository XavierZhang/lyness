// @vitest-environment jsdom
/**
 * What accepting an invitation publishes: one call at a time, one answer for
 * every refusal, and nothing at all on a visit that carries no code.
 */

import { Context } from '@lyness/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TestRemote } from '@lyness/lyn-client-test-runtime'
import { Acceptance, IDLE, rowOf } from '../src/client/acceptance.ts'

const live: Context[] = []

afterEach(async () => {
  for (const ctx of live.splice(0)) await ctx.fiber.dispose()
})

/** One context whose invitations namespace answers with this. */
function bench(accept: () => Promise<unknown>) {
  const ctx = new Context()
  live.push(ctx)
  const events = new TestRemote(ctx, { invitations: { accept } })
  events.$host = { home: undefined, isLoopback: true }
  return ctx
}

/** Every row one acceptance published, in order. */
function recorded(acceptance: Acceptance): { rows: string[] } {
  const rows: string[] = []
  acceptance.state.subscribe(() => { rows.push(acceptance.state.getSnapshot().status) })
  return { rows }
}

describe('what one answer renders as', () => {
  it('reads the granted standing, with and without an organization', () => {
    expect(rowOf({ accepted: true, role: 'tenant-administrator', organization: 'beta' }))
      .toEqual({ status: 'accepted', role: 'tenant-administrator', organization: 'beta' })
    expect(rowOf({ accepted: true, role: 'platform-administrator' }))
      .toEqual({ status: 'accepted', role: 'platform-administrator' })
  })

  it('reads every refusal as the same row', () => {
    // The deployment answers one thing for a wrong code, a spent one and one
    // granting what this person already holds, so there is one row to render.
    expect(rowOf({ accepted: false })).toEqual({ status: 'nothing' })
    // A standing-less answer that claims acceptance is still nothing to show.
    expect(rowOf({ accepted: true })).toEqual({ status: 'nothing' })
  })
})

describe('accepting a code', () => {
  it('starts idle and publishes what the deployment granted', async () => {
    const ctx = bench(() => Promise.resolve({
      ok: true, value: { accepted: true, role: 'member', organization: 'acme' },
    }))
    const acceptance = new Acceptance(ctx, 'the-code')
    expect(acceptance.state.getSnapshot()).toBe(IDLE)
    const seen = recorded(acceptance)
    await acceptance.accept()
    expect(seen.rows).toEqual(['working', 'accepted'])
    expect(acceptance.state.getSnapshot())
      .toEqual({ status: 'accepted', role: 'member', organization: 'acme' })
  })

  it('reports a call that did not land as worth another try', async () => {
    const ctx = bench(() => Promise.resolve({ ok: false, error: { code: 'gateway/internal', message: 'no' } }))
    const acceptance = new Acceptance(ctx, 'the-code')
    await acceptance.accept()
    expect(acceptance.state.getSnapshot()).toEqual({ status: 'failed' })
  })

  it('asks nothing on a visit that carries no code', async () => {
    const accept = vi.fn(() => Promise.resolve({ ok: true, value: { accepted: false } }))
    const acceptance = new Acceptance(bench(accept), undefined)
    await acceptance.accept()
    expect(accept).not.toHaveBeenCalled()
    expect(acceptance.state.getSnapshot()).toBe(IDLE)
  })

  it('accepts once while one is in flight, so a use is not spent twice', async () => {
    let settle = (): void => {}
    const accept = vi.fn(() => new Promise<unknown>((resolve) => {
      settle = () => { resolve({ ok: true, value: { accepted: false } }) }
    }))
    const acceptance = new Acceptance(bench(accept), 'the-code')
    const first = acceptance.accept()
    await acceptance.accept()
    expect(accept).toHaveBeenCalledTimes(1)
    settle()
    await first
    expect(acceptance.state.getSnapshot()).toEqual({ status: 'nothing' })
  })

  it('stops publishing to whoever unsubscribed', async () => {
    const ctx = bench(() => Promise.resolve({ ok: true, value: { accepted: false } }))
    const acceptance = new Acceptance(ctx, 'the-code')
    const listener = vi.fn()
    acceptance.state.subscribe(listener)()
    await acceptance.accept()
    expect(listener).not.toHaveBeenCalled()
  })
})
