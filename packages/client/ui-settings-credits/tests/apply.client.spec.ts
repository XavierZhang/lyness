/**
 * The credits section's wiring: where it registers, the store it declares, its
 * own locale namespace, and that nothing is read until the section opens.
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
import type { AllowanceView, BudgetView, CreditAccountView } from '@lyness/lyn-api-credits-controller/types'
import { apply, creditsCallsOf, inject, NS } from '@lyness/lyn-client-ui-settings-credits/client'
import { CreditsSection } from '../src/client/CreditsSection.tsx'
import type { createCreditsSectionStore } from '../src/client/store.ts'

const SLOT = 'settings.administration.section'

const ACCOUNT: CreditAccountView = {
  person: 'bea',
  available: 10,
  granted: 10,
  spent: 0,
  periodicAmount: 10,
  period: 'daily',
  periodStartedAt: '2026-10-16T00:00:00.000Z',
  spentThisPeriod: 0,
  grants: [],
  debits: [],
  administrable: true,
}

const BUDGET: BudgetView = {
  organization: 'acme',
  periodicAmount: 5000,
  period: 'monthly',
  spent: 0,
  remaining: 5000,
  periodStartedAt: '2026-10-01T00:00:00.000Z',
  nextPeriodAt: '2026-11-01T00:00:00.000Z',
  periods: ['daily', 'weekly', 'monthly'],
  settable: false,
}

const ALLOWANCE: AllowanceView = { person: 'bea', periods: ['daily', 'weekly', 'monthly'] }

/** A context with the slot registry, a locale, and the section mounted. */
async function bench(mine: () => Promise<unknown> = () => Promise.resolve({ ok: true, value: ACCOUNT })) {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  locale.setLocale('zh')
  ctx.provide('locale', locale)
  const events = new TestRemote(ctx, {
    credits: {
      mine,
      grant: () => Promise.resolve({ ok: true, value: ACCOUNT }),
      setAllowance: () => Promise.resolve({ ok: true, value: ALLOWANCE }),
      myBudget: () => Promise.resolve({ ok: true, value: undefined }),
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
type Handle = ReturnType<typeof createCreditsSectionStore>

/** The slot entry this section registered. */
function entryOf(slots: SlotRegistry) {
  const entry = slots.entries(SLOT).find(one => one.component === CreditsSection)
  if (entry === undefined) throw new Error('the credits section did not register')
  return entry
}

describe('ui-settings-credits apply', () => {
  it('registers after the models section', async () => {
    const { slots } = await bench()
    expect(entryOf(slots).options).toMatchObject({ id: 'credits', order: 20 })
  })

  it('names itself in the navigation with its own copy', async () => {
    const { slots, locale } = await bench()
    const label = entryOf(slots).options.label
    expect(typeof label === 'function' ? label() : label).toBe('积分')
    expect(locale.bind(NS)('title')).toBe('积分')
  })

  it('reads nothing until the section opens', async () => {
    const mine = vi.fn(() => Promise.resolve({ ok: true as const, value: ACCOUNT }))
    await bench(mine)
    expect(mine).not.toHaveBeenCalled()
  })

  it('reads through the Remote namespace the deployment answers on', async () => {
    const mine = vi.fn(() => Promise.resolve({ ok: true as const, value: ACCOUNT }))
    const { ctx } = await bench(mine)
    expect(await creditsCallsOf(ctx).mine()).toEqual({ ok: true, value: ACCOUNT })
    expect(mine).toHaveBeenCalledOnce()
  })

  it('changes through the same namespace', async () => {
    const { ctx } = await bench()
    const calls = creditsCallsOf(ctx)
    expect(await calls.grant({ person: 'bea', amount: 1 })).toEqual({ ok: true, value: ACCOUNT })
    expect(await calls.setAllowance({ person: 'bea' })).toEqual({ ok: true, value: ALLOWANCE })
    expect(await calls.myBudget()).toEqual({ ok: true, value: undefined })
  })

  it('declares a store the section reads through', async () => {
    const { slots } = await bench()
    const handle = entryOf(slots).store as Handle
    expect(handle.create().store.getSnapshot()).toEqual({
      status: 'idle',
      account: undefined,
      allowance: undefined,
      budget: undefined,
      working: false,
      outcome: undefined,
    })
  })

  it('declares a store whose writes move the read through its states', async () => {
    const { slots } = await bench()
    const instance = (entryOf(slots).store as Handle).create()
    instance.actions.begin()
    expect(instance.store.getSnapshot().status).toBe('loading')
    instance.actions.succeed(ACCOUNT)
    expect(instance.store.getSnapshot()).toMatchObject({ status: 'ready', account: ACCOUNT })
    instance.actions.fail('unavailable')
    expect(instance.store.getSnapshot().status).toBe('unavailable')
    // A standing that holds no organization answers nothing, which is not a
    // failure the read has to report.
    instance.actions.budgeted(BUDGET)
    expect(instance.store.getSnapshot().budget).toEqual(BUDGET)
    instance.actions.budgeted(undefined)
    expect(instance.store.getSnapshot().budget).toBeUndefined()
    instance.actions.reset()
    expect(instance.store.getSnapshot().status).toBe('idle')
  })

  it('replaces the shown account only when the grant was to this account', async () => {
    const { slots } = await bench()
    const instance = (entryOf(slots).store as Handle).create()
    instance.actions.succeed(ACCOUNT)
    const other = { ...ACCOUNT, person: 'cai', available: 9999 }
    instance.actions.work()
    instance.actions.granted({ account: other, person: 'cai', amount: 5 })
    expect(instance.store.getSnapshot()).toMatchObject({
      working: false,
      account: { person: 'bea', available: 10 },
      outcome: { kind: 'granted', person: 'cai', amount: 5 },
    })

    const topped = { ...ACCOUNT, available: 260 }
    instance.actions.granted({ account: topped, person: 'bea', amount: 250 })
    expect(instance.store.getSnapshot().account).toMatchObject({ person: 'bea', available: 260 })
  })

  it('keeps the saved allowance and the refusal a change answered', async () => {
    const { slots } = await bench()
    const instance = (entryOf(slots).store as Handle).create()
    instance.actions.work()
    instance.actions.allowed(ALLOWANCE)
    expect(instance.store.getSnapshot()).toMatchObject({ working: false, allowance: ALLOWANCE, outcome: { kind: 'allowance' } })
    instance.actions.work()
    expect(instance.store.getSnapshot().outcome).toBeUndefined()
    instance.actions.refused('credits/not-permitted')
    expect(instance.store.getSnapshot()).toMatchObject({
      working: false, outcome: { kind: 'refused', reason: 'credits/not-permitted' },
    })
  })

  it('stops offering the section when its plugin is unloaded', async () => {
    const { slots, fiber } = await bench()
    expect(slots.entries(SLOT).filter(one => one.component === CreditsSection)).toHaveLength(1)
    await fiber.dispose()
    expect(slots.entries(SLOT).filter(one => one.component === CreditsSection)).toHaveLength(0)
  })
})
