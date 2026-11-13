// @vitest-environment jsdom

/**
 * What the invitation page shows: the directories that redeem the code, the
 * acceptance somebody already signed in is offered, and the two visits that
 * have nothing to redeem.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { JoinPage, blockedBy } from '../src/client/JoinPage.tsx'
import type { JoinChannelRow, JoinPageProps, JoinVisitRow } from '../src/client/JoinPage.tsx'
import { IDLE } from '../src/client/acceptance.ts'
import type { AcceptanceRow } from '../src/client/acceptance.ts'
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

/** One rendered page over a fixed visit and acceptance. */
function renderPage(visit: JoinVisitRow, row: AcceptanceRow = IDLE, accept: () => Promise<void> = async () => {}) {
  const useVisit = (<T,>(select: (value: JoinVisitRow) => T) => select(visit)) as JoinPageProps['useVisit']
  const useAcceptance = (<T,>(select: (value: AcceptanceRow) => T) => select(row)) as JoinPageProps['useAcceptance']
  return render(<JoinPage {...{ t, useVisit, useAcceptance, accept } as JoinPageProps} />)
}

/** A visit by somebody the deployment already holds, who carries a code. */
const SIGNED_IN: JoinVisitRow = { invited: true, accounts: true, signedIn: true, channels: [] }

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

describe('what somebody already signed in is offered', () => {
  it('offers one button and nothing about the code, until they press it', () => {
    const pressed: string[] = []
    renderPage(SIGNED_IN, IDLE, async () => { pressed.push('accept') })
    expect(screen.getByText(zh.acceptTitle)).toBeDefined()
    expect(screen.getByText(zh.acceptHint)).toBeDefined()
    // Nothing here says what the invitation carries: the page has not read
    // it, and a forwarded link must not change an account by being opened.
    expect(screen.getByText(zh.acceptNote)).toBeDefined()
    expect(screen.queryAllByRole('link').map(one => one.getAttribute('href'))).toEqual(['./'])
    fireEvent.click(screen.getByRole('button', { name: zh.acceptSubmit }))
    expect(pressed).toEqual(['accept'])
  })

  it('holds the button while one acceptance is in flight', () => {
    renderPage(SIGNED_IN, { status: 'working' })
    expect(screen.getByRole('button', { name: zh.acceptWorking }).hasAttribute('disabled')).toBe(true)
  })

  it('names what they now hold, and the organization it is in', () => {
    renderPage(SIGNED_IN, { status: 'accepted', role: 'tenant-administrator', organization: 'beta' })
    expect(screen.getByText(zh.acceptedTitle)).toBeDefined()
    expect(screen.getByText(zh.acceptedHint.replace('{standing}', `beta · ${zh.roleTenant}`))).toBeDefined()
  })

  it('names an ordinary membership by its organization', () => {
    renderPage(SIGNED_IN, { status: 'accepted', role: 'member', organization: 'acme' })
    expect(screen.getByText(zh.acceptedHint.replace('{standing}', `acme · ${zh.roleMember}`))).toBeDefined()
  })

  it('names the deployment itself for a standing in no organization', () => {
    renderPage(SIGNED_IN, { status: 'accepted', role: 'platform-administrator' })
    expect(screen.getByText(zh.acceptedHint.replace('{standing}', `${zh.deploymentWide} · ${zh.rolePlatform}`)))
      .toBeDefined()
  })

  it('says a code granted them nothing, without saying which rule refused it', () => {
    renderPage(SIGNED_IN, { status: 'nothing' })
    expect(screen.getByText(zh.nothingTitle)).toBeDefined()
    // A spent code, a wrong one and one they already hold read the same.
    expect(screen.getByText(zh.nothingHint)).toBeDefined()
  })

  it('offers another try when the call itself did not land', () => {
    renderPage(SIGNED_IN, { status: 'failed' })
    expect(screen.getByText(zh.failedHint)).toBeDefined()
    expect(screen.getByRole('button', { name: zh.retry })).toBeDefined()
  })
})

describe('the visits with nothing to redeem', () => {
  it('tells a link that carries no code from a deployment that needs none', () => {
    renderPage({ invited: false, accounts: true, signedIn: false, channels: [] })
    expect(screen.getByText(zh.noCodeTitle)).toBeDefined()
    expect(screen.getByText(zh.noCodeHint)).toBeDefined()
    // One way out of each of them: the product itself.
    expect(screen.getByRole('link', { name: zh.workbench }).getAttribute('href')).toBe('./')

    cleanup()
    renderPage({ invited: true, accounts: false, signedIn: true, channels: [] })
    // No accounts outranks being signed in: a deployment with nobody to
    // admit has nothing for an acceptance to add to.
    expect(screen.getByText(zh.noAccountsTitle)).toBeDefined()
  })

  it('reads them in that order, so a link with no code is answered first', () => {
    expect(blockedBy({ invited: false, accounts: false, signedIn: true, channels: [] })).toBe('noCode')
    expect(blockedBy({ invited: true, accounts: false, signedIn: true, channels: [] })).toBe('noAccounts')
    expect(blockedBy(SIGNED_IN)).toBeUndefined()
    expect(blockedBy(invited([OIDC]))).toBeUndefined()
  })
})
