/**
 * What the section's three calls do: share one in-flight read, tell a
 * deployment that meters nothing apart from a read that broke, report a
 * refusal with the reason the server gave, and show a retry's attempt rather
 * than the failure it replaces.
 */

import { describe, expect, it, vi } from 'vitest'
import type { AllowanceView, BudgetView, CreditAccountView } from '@deepseek-ai/dsh-api-credits-controller/types'
import { createCreditsOperations } from '../src/client/operations.ts'
import type { CallOutcome, CreditsCalls, CreditsSink } from '../src/client/operations.ts'

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
  spent: 1000,
  remaining: 4000,
  periodStartedAt: '2026-10-01T00:00:00.000Z',
  nextPeriodAt: '2026-11-01T00:00:00.000Z',
  periods: ['daily', 'weekly', 'monthly'],
  settable: false,
}

const ALLOWANCE: AllowanceView = { person: 'bea', periods: ['daily', 'weekly', 'monthly'] }

/** A sink that records every call made on it, in order. */
function recorder(): { sink: CreditsSink; seen: string[] } {
  const seen: string[] = []
  return {
    seen,
    sink: {
      begin: () => { seen.push('begin') },
      succeed: (account) => { seen.push(`succeed:${account.person}`) },
      fail: (status) => { seen.push(`fail:${status}`) },
      reset: () => { seen.push('reset') },
      work: () => { seen.push('work') },
      granted: (outcome) => { seen.push(`granted:${outcome.person}:${String(outcome.amount)}`) },
      allowed: (allowance) => { seen.push(`allowed:${allowance.person}`) },
      refused: (reason) => { seen.push(`refused:${reason}`) },
      budgeted: (budget) => { seen.push(`budgeted:${budget?.organization ?? 'none'}`) },
    },
  }
}

/** Calls whose every answer the test chooses. */
function calls(over: Partial<CreditsCalls> = {}): CreditsCalls {
  return {
    mine: () => Promise.resolve<CallOutcome<CreditAccountView>>({ ok: true, value: ACCOUNT }),
    grant: () => Promise.resolve<CallOutcome<CreditAccountView>>({ ok: true, value: ACCOUNT }),
    setAllowance: () => Promise.resolve<CallOutcome<AllowanceView>>({ ok: true, value: ALLOWANCE }),
    myBudget: () => Promise.resolve<CallOutcome<BudgetView | undefined>>({ ok: true, value: BUDGET }),
    ...over,
  }
}

describe('the credits read', () => {
  it('publishes the account it read', async () => {
    const { sink, seen } = recorder()
    await createCreditsOperations(calls(), sink).load()
    // An administrator's read answers their own organization's ceiling beside
    // the account, in one read rather than two the section has to sequence.
    expect(seen).toEqual(['begin', 'succeed:bea', 'budgeted:acme'])
  })

  it('shares one in-flight read with every caller', async () => {
    const mine = vi.fn(() => Promise.resolve<CallOutcome<CreditAccountView>>({ ok: true, value: ACCOUNT }))
    const { sink } = recorder()
    const operations = createCreditsOperations(calls({ mine }), sink)
    await Promise.all([operations.load(), operations.load(), operations.retry()])
    expect(mine).toHaveBeenCalledTimes(1)
  })

  it('reads again once the shared read has settled', async () => {
    const mine = vi.fn(() => Promise.resolve<CallOutcome<CreditAccountView>>({ ok: true, value: ACCOUNT }))
    const { sink } = recorder()
    const operations = createCreditsOperations(calls({ mine }), sink)
    await operations.load()
    await operations.load()
    expect(mine).toHaveBeenCalledTimes(2)
  })

  it('reports a deployment that meters nothing as its own state', async () => {
    const { sink, seen } = recorder()
    const mine = (): Promise<CallOutcome<CreditAccountView>> =>
      Promise.resolve({ ok: false, error: { code: 'credits/unavailable' } })
    await createCreditsOperations(calls({ mine }), sink).load()
    expect(seen).toEqual(['begin', 'fail:unavailable'])
  })

  it('reports every other refusal as a failure a reader can retry', async () => {
    const { sink, seen } = recorder()
    const mine = (): Promise<CallOutcome<CreditAccountView>> =>
      Promise.resolve({ ok: false, error: { code: 'credits/anonymous' } })
    await createCreditsOperations(calls({ mine }), sink).load()
    expect(seen).toEqual(['begin', 'fail:failed'])
  })

  it('reports a refusal that carried no error at all', async () => {
    const { sink, seen } = recorder()
    const mine = (): Promise<CallOutcome<CreditAccountView>> => Promise.resolve({ ok: false })
    await createCreditsOperations(calls({ mine }), sink).load()
    expect(seen).toEqual(['begin', 'fail:failed'])
  })

  it('reports a thrown call the same way, because a reader can only retry', async () => {
    const { sink, seen } = recorder()
    const mine = (): Promise<CallOutcome<CreditAccountView>> => Promise.reject(new Error('offline'))
    await createCreditsOperations(calls({ mine }), sink).load()
    expect(seen).toEqual(['begin', 'fail:failed'])
  })

  it('drops the previous failure before retrying, so the attempt is what shows', async () => {
    const { sink, seen } = recorder()
    const operations = createCreditsOperations(calls(), sink)
    await operations.retry()
    expect(seen).toEqual(['reset', 'begin', 'succeed:bea', 'budgeted:acme'])
  })
})

describe('the credits changes', () => {
  it('publishes a grant that landed, with what was added and to whom', async () => {
    const { sink, seen } = recorder()
    await createCreditsOperations(calls(), sink).grant({ person: 'bea', amount: 250 })
    expect(seen).toEqual(['work', 'granted:bea:250'])
  })

  it('publishes a saved allowance as the server now reads it', async () => {
    const { sink, seen } = recorder()
    await createCreditsOperations(calls(), sink).setAllowance({ person: 'bea', periodicAmount: 5 })
    expect(seen).toEqual(['work', 'allowed:bea'])
  })

  it('reports a refused change with the message the server gave', async () => {
    const { sink, seen } = recorder()
    const grant = (): Promise<CallOutcome<CreditAccountView>> =>
      Promise.resolve({ ok: false, error: { code: 'credits/not-permitted', message: 'not your organization' } })
    await createCreditsOperations(calls({ grant }), sink).grant({ person: 'cai', amount: 1 })
    expect(seen).toEqual(['work', 'refused:not your organization'])
  })

  it('falls back to the code when a refusal carried no message', async () => {
    const { sink, seen } = recorder()
    const setAllowance = (): Promise<CallOutcome<AllowanceView>> =>
      Promise.resolve({ ok: false, error: { code: 'credits/rejected' } })
    await createCreditsOperations(calls({ setAllowance }), sink).setAllowance({ person: 'bea' })
    expect(seen).toEqual(['work', 'refused:credits/rejected'])
  })

  it('names a refusal that carried neither, so the form still says something', async () => {
    const { sink, seen } = recorder()
    const grant = (): Promise<CallOutcome<CreditAccountView>> => Promise.resolve({ ok: false })
    await createCreditsOperations(calls({ grant }), sink).grant({ person: 'bea', amount: 1 })
    expect(seen).toEqual(['work', 'refused:unknown'])
  })

  it('reports a thrown change by what it threw, error or not', async () => {
    const { sink, seen } = recorder()
    const thrownGrants = [
      (): Promise<CallOutcome<CreditAccountView>> => Promise.reject(new Error('offline')),
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      (): Promise<CallOutcome<CreditAccountView>> => Promise.reject('gone'),
    ]
    for (const grant of thrownGrants) {
      await createCreditsOperations(calls({ grant }), sink).grant({ person: 'bea', amount: 1 })
    }
    const thrownSaves = [
      (): Promise<CallOutcome<AllowanceView>> => Promise.reject(new Error('offline')),
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      (): Promise<CallOutcome<AllowanceView>> => Promise.reject('gone'),
    ]
    for (const setAllowance of thrownSaves) {
      await createCreditsOperations(calls({ setAllowance }), sink).setAllowance({ person: 'bea' })
    }
    expect(seen).toEqual([
      'work', 'refused:offline', 'work', 'refused:gone',
      'work', 'refused:offline', 'work', 'refused:gone',
    ])
  })
})

describe('the organization ceiling beside the account', () => {
  it('is not asked of a member, whose administrators own those numbers', async () => {
    const myBudget = vi.fn(() => Promise.resolve<CallOutcome<BudgetView | undefined>>({ ok: true, value: BUDGET }))
    const { sink, seen } = recorder()
    await createCreditsOperations(
      calls({ myBudget, mine: () => Promise.resolve({ ok: true, value: { ...ACCOUNT, administrable: false } }) }),
      sink,
    ).load()

    expect(myBudget).not.toHaveBeenCalled()
    expect(seen).toEqual(['begin', 'succeed:bea'])
  })

  it('leaves the account on screen when the ceiling could not be read', async () => {
    const refusedSink = recorder()
    await createCreditsOperations(
      calls({ myBudget: () => Promise.resolve({ ok: false, error: { code: 'credits/not-permitted' } }) }),
      refusedSink.sink,
    ).load()
    // The section is for the account; a ceiling that would not read leaves it
    // without one rather than turning the whole read into a failure.
    expect(refusedSink.seen).toEqual(['begin', 'succeed:bea', 'budgeted:none'])

    const brokenSink = recorder()
    await createCreditsOperations(
      calls({ myBudget: () => Promise.reject(new Error('offline')) }),
      brokenSink.sink,
    ).load()
    expect(brokenSink.seen).toEqual(['begin', 'succeed:bea', 'budgeted:none'])
  })
})
