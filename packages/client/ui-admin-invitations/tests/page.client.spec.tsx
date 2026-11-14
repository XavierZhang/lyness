// @vitest-environment jsdom

/**
 * What the page shows: the invitations this standing administers, the form
 * that issues one, the code shown once with the link that redeems it, the
 * read's own states, and a withdrawal that happens only after it is
 * acknowledged.
 */

import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { InvitationRowView } from '@lyness/lyn-api-invitations-controller/types'
import { InvitationsPage } from '../src/client/InvitationsPage.tsx'
import type { InvitationsPageProps } from '../src/client/InvitationsPage.tsx'
import type { InvitationsPageState } from '../src/client/store.ts'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

const BEA: InvitationRowView = {
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

const SPENT: InvitationRowView = (() => {
  // A platform standing names no organization, so the row carries no such
  // property at all rather than an empty one.
  const { organization: _acme, ...rest } = BEA
  return { ...rest, id: 'inv-2', label: 'The other operator', role: 'platform-administrator', maxUses: 3, uses: 3, open: false }
})()

/** The shipped Chinese copy, so the test reads what a user reads. */
const t = ((key: keyof typeof zh, values?: Record<string, string>) => {
  const text = zh[key]
  return values === undefined
    ? text
    : text.replace(/\{(\w+)\}/gu, (_, name: string) => values[name] ?? '')
}) as InvitationsPageProps['t']

/** One rendered page over a fixed state. */
function renderPage(state: InvitationsPageState, over: Partial<InvitationsPageProps> = {}) {
  const load = vi.fn(() => Promise.resolve())
  const retry = vi.fn(() => Promise.resolve())
  const issue = vi.fn(() => Promise.resolve())
  const revoke = vi.fn(() => Promise.resolve())
  const useStore = (<T,>(select: (value: InvitationsPageState) => T) => select(state)) as InvitationsPageProps['useStore']
  const props = { t, useStore, load, retry, issue, revoke, joinPath: '/join', ...over } as InvitationsPageProps
  return { ...render(<InvitationsPage {...props} />), load, retry, issue, revoke }
}

/** A ready state carrying these invitations. */
function ready(
  invitations: readonly InvitationRowView[],
  over: Partial<InvitationsPageState> = {},
): InvitationsPageState {
  return { status: 'ready', invitations, working: false, outcome: undefined, ...over }
}

const IDLE: InvitationsPageState = { status: 'idle', invitations: [], working: false, outcome: undefined }

/**
 * One of the form's inputs, by the label beside it.
 *
 * Each label also carries a hint, so the field is reached through the label
 * text rather than through the accessible name, which would be both.
 * @param label - the text in the field's own label.
 * @returns the input under it.
 */
function field(label: string): HTMLInputElement {
  const input = screen.getAllByText(label)
    .map(one => one.parentElement?.querySelector('input'))
    .find((one): one is HTMLInputElement => one !== null && one !== undefined)
  if (input === undefined) throw new Error(`no input labelled "${label}"`)
  return input
}

/** The row for one invitation. */
function rowOf(label: string) {
  const row = screen.getAllByRole('listitem').find(one => one.textContent?.includes(label) ?? false)
  if (row === undefined) throw new Error(`no row for "${label}"`)
  return within(row)
}

describe('what the page says before it can show anything', () => {
  it('reads when it opens', () => {
    const { load } = renderPage(IDLE)
    expect(load).toHaveBeenCalledOnce()
  })

  it('offers a retry for a read that broke, and none for the two answers that will not change', () => {
    const { retry } = renderPage({ ...IDLE, status: 'failed' })
    fireEvent.click(screen.getByRole('button', { name: zh.retry }))
    expect(retry).toHaveBeenCalledOnce()

    cleanup()
    renderPage({ ...IDLE, status: 'unavailable' })
    expect(screen.getByText(zh.unavailable)).toBeDefined()
    expect(screen.queryByRole('button', { name: zh.retry })).toBeNull()

    cleanup()
    renderPage({ ...IDLE, status: 'forbidden' })
    expect(screen.getByText(zh.forbidden)).toBeDefined()
    expect(screen.queryByRole('button', { name: zh.retry })).toBeNull()

    cleanup()
    renderPage({ ...IDLE, status: 'loading' })
    expect(screen.getByText(zh.loading)).toBeDefined()
  })

  it('says nothing has been invited yet rather than showing an empty list', () => {
    renderPage(ready([]))
    expect(screen.getByText(zh.none)).toBeDefined()
  })
})

describe('what one invitation says', () => {
  it('shows what it grants, where, how much of it is left, and when it lapses', () => {
    renderPage(ready([BEA]))
    const row = rowOf('Bea')
    expect(row.getByText(zh.roleMember)).toBeDefined()
    expect(row.getByText(zh.open)).toBeDefined()
    expect(row.getByText('acme')).toBeDefined()
    expect(row.getByText('已兑换 0 / 1')).toBeDefined()
    expect(row.getByText(`${new Date(BEA.expiresAt).toLocaleDateString()} 过期`)).toBeDefined()
  })

  it('names the standing an organization administrator is invited to', () => {
    renderPage(ready([{ ...BEA, label: 'Their lead', role: 'tenant-administrator' }]))
    expect(rowOf('Their lead').getByText(zh.roleTenant)).toBeDefined()
  })

  it('names the platform for one that is in no organization, and offers no withdrawal once it is closed', () => {
    renderPage(ready([SPENT]))
    const row = rowOf('The other operator')
    expect(row.getByText(zh.platformWide)).toBeDefined()
    expect(row.getByText(zh.rolePlatform)).toBeDefined()
    expect(row.getByText(zh.closed)).toBeDefined()
    // Nothing is left to withdraw: the deployment already refuses it.
    expect(row.queryByRole('button', { name: zh.revoke })).toBeNull()
  })
})

describe('issuing one', () => {
  it('sends what was filled in, with the lifetime the form offers', () => {
    const { issue } = renderPage(ready([]))
    fireEvent.change(field(zh.label), { target: { value: '  Bea  ' } })
    fireEvent.change(field(zh.organization), { target: { value: ' acme ' } })
    fireEvent.change(field(zh.uses), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: zh.issueSubmit }))

    expect(issue).toHaveBeenCalledWith({
      label: 'Bea',
      role: 'member',
      organization: 'acme',
      maxUses: 3,
      lifetimeMs: 7 * 86_400_000,
    })
  })

  it('does not send an empty label, and sends no organization for a platform standing', () => {
    const { issue } = renderPage(ready([]))
    fireEvent.click(screen.getByRole('button', { name: zh.issueSubmit }))
    expect(issue).not.toHaveBeenCalled()

    fireEvent.change(field(zh.label), { target: { value: 'The other operator' } })
    fireEvent.change(field(zh.organization), { target: { value: 'acme' } })
    fireEvent.click(screen.getByRole('tab', { name: zh.rolePlatform }))
    // A platform standing belongs to the platform rather than to any
    // organization, so the field is gone and nothing it held is sent.
    expect(screen.queryByText(zh.organizationHint)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: zh.issueSubmit }))
    expect(issue).toHaveBeenCalledWith({
      label: 'The other operator',
      role: 'platform-administrator',
      maxUses: 1,
      lifetimeMs: 7 * 86_400_000,
    })
  })

  it('sends the deployment default when the count is not a number', () => {
    const { issue } = renderPage(ready([]))
    fireEvent.change(field(zh.label), { target: { value: 'Bea' } })
    fireEvent.change(field(zh.uses), { target: { value: '' } })
    fireEvent.click(screen.getByRole('tab', { name: zh.lifeMonth }))
    fireEvent.click(screen.getByRole('button', { name: zh.issueSubmit }))
    // What the deployment allows by default is the deployment's answer, not
    // a number this form invents.
    expect(issue).toHaveBeenCalledWith({ label: 'Bea', role: 'member', lifetimeMs: 30 * 86_400_000 })
  })

  it('marks the field a refusal named, and reports one that named none', () => {
    renderPage(ready([], { outcome: { kind: 'refused', reason: '需要组织', fields: ['organization'] } }))
    expect(screen.getByText('被拒绝：需要组织')).toBeDefined()

    cleanup()
    renderPage(ready([], { outcome: { kind: 'refused', reason: '超出上界', fields: [] } }))
    expect(screen.getByText('被拒绝：超出上界')).toBeDefined()
  })

  it('says it is working, and reports a withdrawal that landed', () => {
    renderPage(ready([BEA], { working: true }))
    expect(screen.getByText(zh.working)).toBeDefined()

    cleanup()
    renderPage(ready([BEA], { outcome: { kind: 'revoked' } }))
    expect(screen.getByText(zh.revokedDone)).toBeDefined()
  })
})

describe('the code of a new invitation', () => {
  it('is shown once, with the link that redeems it on this deployment', () => {
    renderPage(ready([BEA], { outcome: { kind: 'issued', label: 'Bea', code: 'the-code' } }))
    expect(screen.getByText('给「Bea」的邀请码')).toBeDefined()
    expect(screen.getByText(zh.issuedHint)).toBeDefined()
    expect(screen.getByText('the-code')).toBeDefined()
    // The address the administrator is looking at, so what they send reaches
    // this deployment.
    expect(screen.getByText(`${window.location.origin}/join?invite=the-code`)).toBeDefined()
  })

  it('takes the redemption path its composition chose', () => {
    renderPage(
      ready([], { outcome: { kind: 'issued', label: 'Bea', code: 'a b' } }),
      { joinPath: '/welcome' },
    )
    // Encoded, because a code is sent as a URL and nothing says it is safe
    // in one.
    expect(screen.getByText(`${window.location.origin}/welcome?invite=a%20b`)).toBeDefined()
  })

  it('offers both of them to the clipboard, and says which one was taken', async () => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue()
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    onTestFinished(() => {
      if (original === undefined) Reflect.deleteProperty(navigator, 'clipboard')
      else Object.defineProperty(navigator, 'clipboard', original)
    })
    renderPage(ready([], { outcome: { kind: 'issued', label: 'Bea', code: 'the-code' } }))
    const copies = screen.getAllByRole('button', { name: zh.copy })
    expect(copies).toHaveLength(2)

    await act(async () => { fireEvent.click(copies[0] as HTMLElement) })
    expect(writeText).toHaveBeenCalledWith('the-code')
    // Said on the control that was pressed, and only there.
    expect(screen.getByRole('button', { name: zh.copied })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: zh.copy })).toHaveLength(1)
  })
})

describe('withdrawing one', () => {
  it('happens only after it is acknowledged', () => {
    const { revoke } = renderPage(ready([BEA]))
    fireEvent.click(rowOf('Bea').getByRole('button', { name: zh.revoke }))
    expect(screen.getByText('撤回「Bea」的邀请码？')).toBeDefined()

    const confirm = screen.getByRole('button', { name: zh.revokeConfirm })
    fireEvent.click(confirm)
    expect(revoke).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: zh.revokeConfirm }))
    expect(revoke).toHaveBeenCalledWith('inv-1')
  })

  it('leaves it alone when the confirmation is dismissed', () => {
    const { revoke } = renderPage(ready([BEA]))
    fireEvent.click(rowOf('Bea').getByRole('button', { name: zh.revoke }))
    fireEvent.click(screen.getByRole('button', { name: zh.revokeCancel }))
    expect(revoke).not.toHaveBeenCalled()
    expect(screen.queryByText('撤回「Bea」的邀请码？')).toBeNull()
  })
})
