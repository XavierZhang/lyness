// @vitest-environment jsdom

/**
 * What the invitation page shows: the directories that redeem the code, and
 * the three visits that have nothing to redeem.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { JoinPage, blockedBy } from '../src/client/JoinPage.tsx'
import type { JoinChannelRow, JoinPageProps, JoinVisitRow } from '../src/client/JoinPage.tsx'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

const OIDC: JoinChannelRow = { href: '/auth/sign-in/oidc?invite=the-code', displayName: 'Single sign-on' }

/** The shipped Chinese copy, so the test reads what a visitor reads. */
const t = ((key: keyof typeof zh, values?: Record<string, string>) => {
  const text = zh[key]
  return values === undefined
    ? text
    : text.replace(/\{(\w+)\}/gu, (_, name: string) => values[name] ?? '')
}) as JoinPageProps['t']

/** One rendered page over a fixed visit. */
function renderPage(visit: JoinVisitRow) {
  const useVisit = (<T,>(select: (value: JoinVisitRow) => T) => select(visit)) as JoinPageProps['useVisit']
  return render(<JoinPage {...{ t, useVisit } as JoinPageProps} />)
}

/** An invited visit on a deployment with accounts, nobody signed in. */
function invited(channels: readonly JoinChannelRow[]): JoinVisitRow {
  return { invited: true, accounts: true, signedIn: false, channels }
}

describe('what the page offers somebody holding a code', () => {
  it('offers one link per directory, with the code already on it', () => {
    renderPage(invited([OIDC, { href: '/auth/sign-in/wecom?invite=the-code', displayName: 'Head office' }]))
    expect(screen.getByText(zh.title)).toBeDefined()
    const links = screen.getAllByRole('link')
    expect(links.map(one => one.getAttribute('href')))
      .toEqual(['/auth/sign-in/oidc?invite=the-code', '/auth/sign-in/wecom?invite=the-code'])
    expect(links[0]?.textContent).toBe('用「Single sign-on」继续')
  })

  it('says so when the deployment configured no directory, and offers no link', () => {
    renderPage(invited([]))
    expect(screen.getByText(zh.noChannel)).toBeDefined()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('says what a code is bounded by, without claiming this one is good', () => {
    renderPage(invited([OIDC]))
    // Nothing here answers "is this code valid": that answer, on a page
    // anybody can open, would tell whoever asked which codes exist.
    expect(screen.getByText(zh.note)).toBeDefined()
    expect(screen.queryByText(zh.noCodeTitle)).toBeNull()
  })
})

describe('the visits with nothing to redeem', () => {
  it('tells a link that carries no code from a deployment that needs none, and from somebody already here', () => {
    renderPage({ invited: false, accounts: true, signedIn: false, channels: [] })
    expect(screen.getByText(zh.noCodeTitle)).toBeDefined()
    expect(screen.getByText(zh.noCodeHint)).toBeDefined()
    // One way out of each of them: the product itself.
    expect(screen.getByRole('link', { name: zh.workbench }).getAttribute('href')).toBe('./')

    cleanup()
    renderPage({ invited: true, accounts: false, signedIn: false, channels: [] })
    expect(screen.getByText(zh.noAccountsTitle)).toBeDefined()

    cleanup()
    renderPage({ invited: true, accounts: true, signedIn: true, channels: [] })
    expect(screen.getByText(zh.signedInTitle)).toBeDefined()
  })

  it('reads them in that order, so a link with no code is answered first', () => {
    expect(blockedBy({ invited: false, accounts: false, signedIn: true, channels: [] })).toBe('noCode')
    expect(blockedBy({ invited: true, accounts: false, signedIn: true, channels: [] })).toBe('noAccounts')
    expect(blockedBy({ invited: true, accounts: true, signedIn: true, channels: [] })).toBe('signedIn')
    expect(blockedBy(invited([OIDC]))).toBeUndefined()
  })
})
