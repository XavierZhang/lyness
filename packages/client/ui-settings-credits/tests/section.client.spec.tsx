// @vitest-environment jsdom

/**
 * What the section shows: the three figures, the ledger it is made of, the
 * read's own states, and the administrator forms — which appear only when the
 * account says the caller may use them.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { BudgetView, CreditAccountView } from '@lyness/lyn-api-credits-controller/types'
import { CreditsSection } from '../src/client/CreditsSection.tsx'
import type { CreditsSectionProps } from '../src/client/CreditsSection.tsx'
import type { CreditsSectionState } from '../src/client/store.ts'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

const ACCOUNT: CreditAccountView = {
  person: 'bea',
  available: 180,
  granted: 300,
  spent: 120,
  periodicAmount: 100,
  period: 'daily',
  periodStartedAt: '2026-10-16T00:00:00.000Z',
  spentThisPeriod: 120,
  nextGrantAt: '2026-10-17T00:00:00.000Z',
  grants: [
    { id: 'g1', amount: 100, grantedAt: '2026-10-15T08:00:00.000Z', reason: 'periodic' },
    { id: 'g2', amount: 200, grantedAt: '2026-10-16T08:00:00.000Z', reason: 'administrator', grantedBy: 'ada', expiresAt: '2026-11-16T08:00:00.000Z' },
  ],
  debits: [{ id: 'd1', amount: 120, at: '2026-10-16T09:00:00.000Z', session: 's-1' }],
  administrable: false,
}

/** The shipped Chinese copy, so the test reads what a user reads. */
const t = ((key: keyof typeof zh, values?: Record<string, string>) => {
  const text = zh[key]
  return values === undefined
    ? text
    : text.replace(/\{(\w+)\}/gu, (_, name: string) => values[name] ?? '')
}) as CreditsSectionProps['t']

/** One rendered section over a fixed state. */
function renderSection(state: CreditsSectionState, over: Partial<CreditsSectionProps> = {}) {
  const load = vi.fn(() => Promise.resolve())
  const retry = vi.fn(() => Promise.resolve())
  const grant = vi.fn(() => Promise.resolve())
  const setAllowance = vi.fn(() => Promise.resolve())
  const useStore = (<T,>(select: (value: CreditsSectionState) => T) => select(state)) as CreditsSectionProps['useStore']
  const props = { t, useStore, load, retry, grant, setAllowance, ...over } as CreditsSectionProps
  return { ...render(<CreditsSection {...props} />), load, retry, grant, setAllowance }
}

/** A ready state carrying one account, and whatever one test varies. */
function ready(account: CreditAccountView, over: Partial<CreditsSectionState> = {}): CreditsSectionState {
  return {
    status: 'ready',
    account,
    allowance: undefined,
    budget: undefined,
    working: false,
    outcome: undefined,
    ...over,
  }
}

const IDLE: CreditsSectionState = {
  status: 'idle',
  account: undefined,
  allowance: undefined,
  budget: undefined,
  working: false,
  outcome: undefined,
}

/** One organization's ceiling, with whatever one test varies. */
function budgetOf(over: Partial<BudgetView> = {}): BudgetView {
  return {
    organization: 'acme',
    periodicAmount: 5000,
    period: 'monthly',
    spent: 1000,
    remaining: 4000,
    periodStartedAt: '2026-10-01T00:00:00.000Z',
    nextPeriodAt: '2026-11-01T00:00:00.000Z',
    periods: ['daily', 'weekly', 'monthly'],
    settable: false,
    ...over,
  }
}

/** The form under one heading, which is how each form's own fields are reached. */
function formOf(heading: string): HTMLFormElement {
  const form = screen.getByText(heading).closest('form')
  if (form === null) throw new Error(`no form under "${heading}"`)
  return form
}

/**
 * Type into one of a form's inputs, in document order.
 * @param form - the form to fill.
 * @param index - which of its inputs.
 * @param value - what to type.
 */
function fill(form: HTMLFormElement, index: number, value: string): void {
  const input = form.querySelectorAll('input')[index]
  if (input === undefined) throw new Error(`the form has no input ${String(index)}`)
  fireEvent.change(input, { target: { value } })
}

describe('CreditsSection', () => {
  it('reads the account when it opens, without being asked to', () => {
    const { load } = renderSection(IDLE)
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('shows the limit, what the period cost, the balance, and when it resets', () => {
    renderSection(ready(ACCOUNT))
    // A member administers nobody and still reads their own limit: without it
    // a quiet day and a lowered allowance look the same.
    expect(screen.getByText('每天 100')).toBeDefined()
    expect(screen.getByText(zh.limit)).toBeDefined()
    expect(screen.getByText(zh.limitSpent)).toBeDefined()
    expect(screen.getByText('180')).toBeDefined()
    expect(screen.getByText('300')).toBeDefined()
    expect(screen.getAllByText('120')).toHaveLength(2)
    expect(screen.getByText(zh.available)).toBeDefined()
    expect(screen.getByText(/重置/u)).toBeDefined()
  })

  it('says so when no recurring credits are set for this person', () => {
    const { nextGrantAt: _none, ...unmetered } = ACCOUNT
    renderSection(ready({ ...unmetered, periodicAmount: 0, spentThisPeriod: 0 }))

    expect(screen.getByText('—')).toBeDefined()
    expect(screen.getByText(zh.limitNone)).toBeDefined()
  })

  it('names a weekly and a monthly period as words rather than as wire tokens', () => {
    renderSection(ready({ ...ACCOUNT, period: 'weekly' }))
    expect(screen.getByText('每周 100')).toBeDefined()
    cleanup()

    renderSection(ready({ ...ACCOUNT, period: 'monthly' }))
    expect(screen.getByText('每月 100')).toBeDefined()
  })

  it('names each grant by why it was granted, and each debit by its session', () => {
    renderSection(ready(ACCOUNT))
    expect(screen.getByText('+100')).toBeDefined()
    expect(screen.getByText(zh.reasonPeriodic)).toBeDefined()
    expect(screen.getByText('由 ada 发放')).toBeDefined()
    expect(screen.getByText('-120')).toBeDefined()
    expect(screen.getByText('会话 s-1')).toBeDefined()
    expect(screen.getByText(/失效/u)).toBeDefined()
  })

  it('names a purchase, and an administrator grant whose granter went unrecorded', () => {
    const { nextGrantAt: _dropped, ...undated } = ACCOUNT
    renderSection(ready({
      ...undated,
      debits: [],
      grants: [
        { id: 'g3', amount: 50, grantedAt: '2026-10-16T08:00:00.000Z', reason: 'purchase' },
        { id: 'g4', amount: 60, grantedAt: '2026-10-16T08:00:00.000Z', reason: 'administrator' },
      ],
    }))
    expect(screen.getByText(zh.reasonPurchase)).toBeDefined()
    expect(screen.getByText(zh.reasonGranted)).toBeDefined()
    expect(screen.queryByText(/下次额度/u)).toBeNull()
    expect(screen.queryByText(zh.debitsHeading)).toBeNull()
  })

  it('shows spending on an account that has only spent', () => {
    renderSection(ready({ ...ACCOUNT, grants: [] }))
    expect(screen.getByText(zh.debitsHeading)).toBeDefined()
    expect(screen.queryByText(zh.grantsHeading)).toBeNull()
  })

  it('grants credits that do not lapse when the form named no date', () => {
    const { grant } = renderSection(ready({ ...ACCOUNT, administrable: true }))
    const form = formOf(zh.grantHeading)
    fill(form, 0, 'bea')
    fill(form, 1, '20')
    fireEvent.submit(form)
    expect(grant).toHaveBeenCalledWith({ person: 'bea', amount: 20 })
  })

  it('says so when nothing has been granted or spent', () => {
    renderSection(ready({ ...ACCOUNT, grants: [], debits: [] }))
    expect(screen.getByText(zh.ledgerEmpty)).toBeDefined()
  })

  it('tells a deployment that meters nothing apart from a read that broke', () => {
    renderSection({ ...IDLE, status: 'unavailable' })
    expect(screen.getByText(zh.unavailable)).toBeDefined()
    expect(screen.queryByText(zh.retry)).toBeNull()
  })

  it('offers a retry after a failed read', () => {
    const { retry } = renderSection({ ...IDLE, status: 'failed' })
    fireEvent.click(screen.getByText(zh.retry))
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it('offers no administration to an account that may not administer', () => {
    renderSection(ready(ACCOUNT))
    expect(screen.queryByText(zh.grantHeading)).toBeNull()
  })

  it('offers both forms to an account that may administer', () => {
    renderSection(ready({ ...ACCOUNT, administrable: true }))
    expect(screen.getByText(zh.grantHeading)).toBeDefined()
    expect(screen.getByText(zh.allowanceHeading)).toBeDefined()
  })

  it('grants what the form was filled with, with the expiry as a UTC instant', () => {
    const { grant } = renderSection(ready({ ...ACCOUNT, administrable: true }))
    const form = formOf(zh.grantHeading)
    fill(form, 0, ' bea ')
    fill(form, 1, '250')
    fill(form, 2, '2026-12-01')
    fireEvent.submit(form)
    expect(grant).toHaveBeenCalledWith({
      person: 'bea',
      amount: 250,
      expiresAt: '2026-12-01T00:00:00.000Z',
    })
  })

  it('refuses to send a grant the server would refuse anyway', () => {
    const { grant } = renderSection(ready({ ...ACCOUNT, administrable: true }))
    fireEvent.submit(formOf(zh.grantHeading))
    expect(grant).not.toHaveBeenCalled()
  })

  it('saves an allowance for one person, and for a whole organization', () => {
    const { setAllowance } = renderSection(ready({ ...ACCOUNT, administrable: true }))
    const form = formOf(zh.allowanceHeading)
    fill(form, 0, 'bea')
    fill(form, 1, '500')
    fireEvent.submit(form)
    expect(setAllowance).toHaveBeenCalledWith({ person: 'bea', periodicAmount: 500, period: 'monthly' })

    fireEvent.click(screen.getByText(zh.allowanceScopeOrganization))
    fireEvent.click(screen.getByText(zh.periodWeekly))
    fireEvent.submit(formOf(zh.allowanceHeading))
    expect(setAllowance).toHaveBeenLastCalledWith({ organization: 'bea', periodicAmount: 500, period: 'weekly' })
  })

  it('omits an allowance amount the form was not given', () => {
    const { setAllowance } = renderSection(ready({ ...ACCOUNT, administrable: true }))
    const form = formOf(zh.allowanceHeading)
    fill(form, 0, 'bea')
    fireEvent.submit(form)
    expect(setAllowance).toHaveBeenCalledWith({ person: 'bea', period: 'monthly' })
  })

  it('sends nothing for an allowance that names nobody', () => {
    const { setAllowance } = renderSection(ready({ ...ACCOUNT, administrable: true }))
    fireEvent.submit(formOf(zh.allowanceHeading))
    expect(setAllowance).not.toHaveBeenCalled()
  })

  it('reports what the last change answered', () => {
    const base = ready({ ...ACCOUNT, administrable: true })
    renderSection({ ...base, outcome: { kind: 'granted', person: 'bea', amount: 250 } })
    expect(screen.getByText('已向 bea 发放 250。')).toBeDefined()
    cleanup()
    renderSection({ ...base, outcome: { kind: 'allowance' } })
    expect(screen.getByText(zh.allowanceDone)).toBeDefined()
    cleanup()
    renderSection({ ...base, outcome: { kind: 'refused', reason: 'credits/not-permitted' } })
    expect(screen.getByText('这次改动被拒绝：credits/not-permitted')).toBeDefined()
    cleanup()
    renderSection({ ...base, working: true })
    expect(screen.getByText(zh.working)).toBeDefined()
  })

  it('names who set an allowance once one has been read', () => {
    renderSection({
      ...ready({ ...ACCOUNT, administrable: true }),
      allowance: {
        person: 'bea',
        periods: ['daily', 'weekly', 'monthly'],
        own: { periodicAmount: 500, period: 'weekly', setAt: '2026-10-16T08:00:00.000Z', setBy: 'ada' },
      },
    })
    expect(screen.getByText('由 ada 设定')).toBeDefined()
  })

  it('says an allowance is inherited until somebody overrides it', () => {
    renderSection(ready({ ...ACCOUNT, administrable: true }))
    expect(screen.getByText(zh.allowanceInherited)).toBeDefined()
  })

  it('shows the loading notice while a read is in flight', () => {
    renderSection({ ...IDLE, status: 'loading' })
    expect(screen.getByText(zh.loading)).toBeDefined()
  })
})

describe('what one organization bought', () => {
  it('shows the ceiling, what it spent, and what is left', () => {
    renderSection(ready({ ...ACCOUNT, administrable: true }, { budget: budgetOf() }))

    expect(screen.getByText(zh.budget)).toBeDefined()
    expect(screen.getByText('5000')).toBeDefined()
    expect(screen.getByText('4000')).toBeDefined()
    // Read-only whatever the standing: the ceiling is the platform's.
    expect(screen.getByText(zh.budgetPlatformOnly)).toBeDefined()
  })

  it('says an organization nobody set a ceiling for has none', () => {
    const { organization, periods, settable } = budgetOf()
    renderSection(ready({ ...ACCOUNT, administrable: true }, { budget: { organization, periods, settable } }))

    // No ceiling rather than a ceiling of zero.
    expect(screen.getByText(zh.budgetNone)).toBeDefined()
  })

  it('leaves the turn-over line off a ceiling that reports no next period', () => {
    const { nextPeriodAt: _turns, ...open } = budgetOf()
    renderSection(ready({ ...ACCOUNT, administrable: true }, { budget: open }))

    expect(screen.getByText('5000')).toBeDefined()
    expect(screen.queryByText(zh.budgetTurns.replace('{at}', ''))).toBeNull()
  })

  it('shows no block at all to a reader whose standing answered none', () => {
    renderSection(ready(ACCOUNT))

    expect(screen.queryByText(zh.budget)).toBeNull()
  })
})
