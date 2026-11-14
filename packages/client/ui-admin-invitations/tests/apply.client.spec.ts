/**
 * The page's wiring: where it registers, the store it declares, its own
 * locale namespace, and that nothing is read until the page opens.
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
import type { InvitationRowView } from '@deepseek-ai/dsh-api-invitations-controller/types'
import { apply, Config, DEFAULT_JOIN_PATH, inject, invitationCallsOf, NS } from '@deepseek-ai/dsh-client-ui-admin-invitations/client'
import { InvitationsPage } from '../src/client/InvitationsPage.tsx'
import type { createInvitationsPageStore } from '../src/client/store.ts'

const SLOT = 'admin.section'

const INVITATION: InvitationRowView = {
  id: 'inv-1',
  label: 'Bea',
  role: 'member',
  organization: 'acme',
  issuedAt: '2026-11-11T00:00:00.000Z',
  expiresAt: '2026-11-18T00:00:00.000Z',
  maxUses: 1,
  uses: 0,
  open: true,
}

/** A context with the slot registry, a locale, and the page mounted. */
async function bench(
  list: () => Promise<unknown> = () => Promise.resolve({ ok: true, value: [INVITATION] }),
  config?: unknown,
) {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  locale.setLocale('zh')
  ctx.provide('locale', locale)
  const events = new TestRemote(ctx, {
    invitations: {
      list,
      issue: () => Promise.resolve({ ok: true, value: { ...INVITATION, code: 'the-code' } }),
      revoke: () => Promise.resolve({ ok: true, value: undefined }),
    },
  })
  events.$host = { home: undefined, isLoopback: true }
  const slots = ctx.get('slots') as SlotRegistry
  const declared = slots.register(
    { name: 'root', children: { [SLOT]: { kind: 'list', scope: 'root' } } } as never,
    () => null,
  )
  // Mounted without the Config schema when a test hands nothing, so the
  // page's own fallback is what answers rather than the schema's default.
  const fiber = config === undefined
    ? ctx.plugin({ inject: [...inject], apply }, {})
    : ctx.plugin({ inject: [...inject], apply, Config }, config)
  await fiber.await()
  return { ctx, slots, locale, declared, fiber }
}

/** The store handle this page registered. */
type Handle = ReturnType<typeof createInvitationsPageStore>

/** The slot entry this page registered. */
function entryOf(slots: SlotRegistry) {
  const entry = slots.entries(SLOT).find(one => one.component === InvitationsPage)
  if (entry === undefined) throw new Error('the invitations page did not register')
  return entry
}

/**
 * The business face this page registered, as the framework would call it.
 * @param slots - the registry the page registered into.
 * @returns what the page hands its component.
 */
function faceOf(slots: SlotRegistry): Record<string, unknown> {
  const factory = entryOf(slots).inject
  if (factory === undefined) throw new Error('the invitations page registered no face')
  return factory({ begin: () => {}, succeed: () => {}, fail: () => {}, reset: () => {},
    work: () => {}, issued: () => {}, revoked: () => {}, refused: () => {} } as never)
}

describe('ui-admin-invitations apply', () => {
  it('registers after the people page', async () => {
    const { slots } = await bench()
    // An invitation is how somebody who is not in that roster yet gets into
    // it, so the roster is what an administrator reads first.
    expect(entryOf(slots).options).toMatchObject({ id: 'invitations', order: 36 })
  })

  it('names itself in the navigation with its own copy', async () => {
    const { slots, locale } = await bench()
    const label = entryOf(slots).options.label
    expect(typeof label === 'function' ? label() : label).toBe('邀请码')
    expect(locale.bind(NS)('title')).toBe('邀请码')
  })

  it('reads nothing until the page opens', async () => {
    const list = vi.fn(() => Promise.resolve({ ok: true as const, value: [INVITATION] }))
    await bench(list)
    expect(list).not.toHaveBeenCalled()
  })

  it('reads and changes through the Remote namespace the deployment answers on', async () => {
    const list = vi.fn(() => Promise.resolve({ ok: true as const, value: [INVITATION] }))
    const { ctx } = await bench(list)
    const calls = invitationCallsOf(ctx)
    expect(await calls.list()).toEqual({ ok: true, value: [INVITATION] })
    expect(await calls.issue({ label: 'Bea', role: 'member', organization: 'acme' }))
      .toEqual({ ok: true, value: { ...INVITATION, code: 'the-code' } })
    expect(await calls.revoke('inv-1')).toEqual({ ok: true, value: undefined })
    expect(list).toHaveBeenCalledOnce()
  })

  it('declares a store the page reads through', async () => {
    const { slots } = await bench()
    const handle = entryOf(slots).store as Handle
    expect(handle.create().store.getSnapshot()).toEqual({
      status: 'idle', invitations: [], working: false, outcome: undefined,
    })
  })

  it('declares a store whose writes move the read through its states', async () => {
    const { slots } = await bench()
    const instance = (entryOf(slots).store as Handle).create()
    instance.actions.begin()
    expect(instance.store.getSnapshot().status).toBe('loading')
    instance.actions.succeed([INVITATION])
    expect(instance.store.getSnapshot()).toMatchObject({ status: 'ready', invitations: [INVITATION] })
    instance.actions.fail('forbidden')
    expect(instance.store.getSnapshot().status).toBe('forbidden')
    instance.actions.reset()
    expect(instance.store.getSnapshot().status).toBe('idle')
  })

  it('keeps a new code in the outcome and out of the row it lists', async () => {
    const { slots } = await bench()
    const instance = (entryOf(slots).store as Handle).create()
    instance.actions.succeed([])
    instance.actions.work()
    instance.actions.issued({ ...INVITATION, code: 'the-code' })
    // The row is what the next read answers, and that read carries no code.
    expect(instance.store.getSnapshot()).toMatchObject({
      working: false,
      invitations: [INVITATION],
      outcome: { kind: 'issued', label: 'Bea', code: 'the-code' },
    })
    expect(instance.store.getSnapshot().invitations[0]?.code).toBeUndefined()
  })

  it('reports nothing to copy when an issue answered no code', async () => {
    const { slots } = await bench()
    const instance = (entryOf(slots).store as Handle).create()
    instance.actions.work()
    // No call answers this; publishing a code that is not there would show an
    // administrator an empty one to send.
    instance.actions.issued(INVITATION)
    expect(instance.store.getSnapshot()).toMatchObject({ working: false, outcome: undefined })
  })

  it('closes a withdrawn invitation in place, and keeps the fields a refusal named', async () => {
    const { slots } = await bench()
    const instance = (entryOf(slots).store as Handle).create()
    instance.actions.succeed([INVITATION, { ...INVITATION, id: 'inv-2' }])
    instance.actions.work()
    instance.actions.revoked('inv-1')
    expect(instance.store.getSnapshot().invitations.map(one => one.open)).toEqual([false, true])
    expect(instance.store.getSnapshot().outcome).toEqual({ kind: 'revoked' })

    instance.actions.work()
    expect(instance.store.getSnapshot().outcome).toBeUndefined()
    instance.actions.refused({ reason: 'needs an organization', fields: ['organization'] })
    expect(instance.store.getSnapshot()).toMatchObject({
      working: false, outcome: { kind: 'refused', reason: 'needs an organization', fields: ['organization'] },
    })
  })

  it('takes the redemption path from its composition, and its own default without one', async () => {
    const configured = await bench(undefined, { joinPath: '/welcome' })
    expect(faceOf(configured.slots)).toMatchObject({ joinPath: '/welcome' })

    const plain = await bench()
    // A composition that names no path, and no schema to default it: the
    // page answers with its own.
    expect(faceOf(plain.slots)).toMatchObject({ joinPath: DEFAULT_JOIN_PATH })
  })

  it('stops offering the page when its plugin is unloaded', async () => {
    const { slots, fiber } = await bench()
    expect(slots.entries(SLOT).filter(one => one.component === InvitationsPage)).toHaveLength(1)
    await fiber.dispose()
    expect(slots.entries(SLOT).filter(one => one.component === InvitationsPage)).toHaveLength(0)
  })
})
