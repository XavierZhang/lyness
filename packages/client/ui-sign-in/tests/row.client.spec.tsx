// @vitest-environment jsdom

/**
 * What the row names: the person, the standing they act in, and the way out —
 * and nothing at all on a deployment with no accounts.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { ViewerStandingView, ViewerView } from '@lyness/lyn-api-identity-controller/types'
import type { ViewerSnapshot } from '@lyness/lyn-client-ui-viewer/client'
import { AccountRow, standingLabel } from '../src/client/AccountRow.tsx'
import type { AccountRowProps } from '../src/client/AccountRow.tsx'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

const BASE: ViewerView = {
  accounts: true,
  channels: [],
  signInPrefix: '/auth/sign-in',
  signOutPath: '/auth/sign-out',
}

/** The shipped Chinese copy, so the test reads what a user reads. */
const t = ((key: keyof typeof zh, values?: Record<string, string>) => {
  const text = zh[key]
  return values === undefined
    ? text
    : text.replace(/\{(\w+)\}/gu, (_, name: string) => values[name] ?? '')
}) as AccountRowProps['t']

/** One rendered row over a fixed snapshot. */
function renderRow(state: ViewerSnapshot) {
  const load = vi.fn(() => Promise.resolve())
  const useViewer = (<T,>(select: (value: ViewerSnapshot) => T) => select(state)) as AccountRowProps['useViewer']
  return { ...render(<AccountRow {...{ t, useViewer, load } as AccountRowProps} />), load }
}

/** A ready snapshot carrying one viewer. */
function ready(viewer: ViewerView): ViewerSnapshot {
  return { status: 'ready', viewer, administers: false }
}

describe('AccountRow', () => {
  it('asks who the viewer is when Settings opens, even if the screen never did', () => {
    const { load } = renderRow({ status: 'idle', viewer: undefined, administers: false })
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('shows nothing on a deployment with no accounts', () => {
    const { container } = renderRow(ready({ ...BASE, accounts: false }))
    expect(container.textContent).toBe('')
  })

  it('names the person and their standing, and offers the way out', () => {
    renderRow(ready({
      ...BASE,
      person: { id: 'ada', displayName: 'Ada' },
      standing: { id: 's', role: 'tenant-administrator', organization: 'acme' },
    }))
    expect(screen.getByText('Ada')).toBeDefined()
    expect(screen.getByText('acme 的管理员')).toBeDefined()
    expect(screen.getByText(zh.signOut).closest('a')?.getAttribute('href')).toBe('/auth/sign-out')
  })

  it('says a viewer is not signed in, and offers them no way out of nothing', () => {
    renderRow(ready(BASE))
    expect(screen.getByText(zh.anonymous)).toBeDefined()
    expect(screen.queryByText(zh.signOut)).toBeNull()
  })
})

describe('standingLabel', () => {
  /** One standing, as the directory reports it. */
  function standing(role: ViewerStandingView['role'], organization?: string): ViewerStandingView {
    return { id: 's', role, ...organization === undefined ? {} : { organization } }
  }

  it('names each role the way a person reads it', () => {
    expect(standingLabel(standing('platform-administrator'), t)).toBe(zh.rolePlatformAdministrator)
    expect(standingLabel(standing('tenant-administrator', 'acme'), t)).toBe('acme 的管理员')
    expect(standingLabel(standing('member', 'acme'), t)).toBe('acme 的成员')
    expect(standingLabel(undefined, t)).toBe(zh.rolePersonal)
  })

  it('names the role alone for a standing the directory holds without an organization', () => {
    expect(standingLabel(standing('member'), t)).toBe(zh.roleMemberPlain)
    expect(standingLabel(standing('tenant-administrator'), t)).toBe(zh.roleAdministratorPlain)
  })
})
