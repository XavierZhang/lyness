// @vitest-environment jsdom

/**
 * What the console shows: the pages it was offered, grouped and navigable; one
 * page at a time; and, for a viewer who administers nothing, a line saying so
 * instead of a navigation whose every call would be refused.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { AdminFrame, activeSection, groupSections } from '../src/client/AdminFrame.tsx'
import type { AdminFrameProps, AdminSectionRow, AdminViewerRow } from '../src/client/AdminFrame.tsx'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

/** The shipped Chinese copy, so a case reads what an administrator reads. */
const t = ((key: keyof typeof zh, values?: Record<string, string>) => {
  const text = zh[key]
  return values === undefined
    ? text
    : text.replace(/\{(\w+)\}/gu, (_, name: string) => values[name] ?? '')
}) as AdminFrameProps['t']

const PAGES: readonly AdminSectionRow[] = [
  { id: 'models', order: 10, label: '模型' },
  { id: 'people', order: 35, label: '人员' },
  { id: 'history', order: 50, label: '变更历史' },
]

const OPERATOR: AdminViewerRow = {
  name: undefined, signOutPath: undefined, administers: true, accounts: false, signedIn: false, channels: [],
}

/** A deployment with accounts, nobody signed in, one channel a browser can begin. */
const SIGNED_OUT: AdminViewerRow = {
  name: undefined, signOutPath: undefined, administers: false, accounts: true, signedIn: false,
  channels: [{ href: '/auth/sign-in/oidc', displayName: '企业单点登录' }],
}

/** One rendered console over a fixed set of pages and one viewer. */
function renderFrame(
  rows: readonly AdminSectionRow[] = PAGES,
  viewer: AdminViewerRow = OPERATOR,
) {
  const select = vi.fn()
  let active: string | undefined
  const renderSlot = vi.fn(((key: string, _owner: unknown, opts?: { only?: string }) =>
    key === 'admin.section'
      ? <div data-testid={`page-${opts?.only ?? 'all'}`} />
      : <div data-testid="overlay" />) as AdminFrameProps['renderSlot'])
  const props = {
    t,
    renderSlot,
    useStore: (<T,>(pick: (state: { activeId: string | undefined }) => T) => pick({ activeId: active })),
    actions: { select: (id: string) => { active = id; select(id); view.rerender(<AdminFrame {...props} />) } },
    useSections: (<T,>(pick: (value: readonly AdminSectionRow[]) => T) => pick(rows)),
    useViewer: (<T,>(pick: (value: AdminViewerRow) => T) => pick(viewer)),
  } as AdminFrameProps
  const view = render(<AdminFrame {...props} />)
  return { ...view, select, renderSlot }
}

describe('grouping the pages', () => {
  it('places known pages in navigation order and keeps each group sorted', () => {
    expect(groupSections(PAGES)).toEqual([
      { key: 'organization', rows: [{ id: 'people', order: 35, label: '人员' }] },
      { key: 'capability', rows: [{ id: 'models', order: 10, label: '模型' }] },
      { key: 'platform', rows: [{ id: 'history', order: 50, label: '变更历史' }] },
    ])
  })

  it('keeps a page it has never heard of, in a trailing group, also sorted', () => {
    const rows = [
      { id: 'quotas', order: 5, label: 'Quotas' },
      { id: 'tenants', order: 1, label: 'Tenants' },
      { id: 'people', order: 35, label: '人员' },
      { id: 'bots', order: 40, label: '机器人' },
    ]
    expect(groupSections(rows).map(group => group.key)).toEqual(['organization', 'other'])
    // Each group keeps the order its pages declared, known and unknown alike.
    expect(groupSections(rows)[0]?.rows.map(row => row.id)).toEqual(['people', 'bots'])
    expect(groupSections(rows).at(-1)?.rows.map(row => row.id)).toEqual(['tenants', 'quotas'])
  })

  it('offers no empty group', () => {
    expect(groupSections([]).length).toBe(0)
    expect(groupSections([{ id: 'people', order: 0, label: '人员' }]).map(g => g.key)).toEqual(['organization'])
  })
})

describe('which page is open', () => {
  it('opens the first page offered until one is selected', () => {
    expect(activeSection(PAGES, undefined)?.id).toBe('models')
    expect(activeSection(PAGES, 'people')?.id).toBe('people')
  })

  it('falls back when the selected page stops being offered', () => {
    // A module unloaded under an open console: the selection no longer names
    // a page, and the console shows one that exists rather than nothing.
    expect(activeSection(PAGES, 'credits')?.id).toBe('models')
    expect(activeSection([], 'models')).toBeUndefined()
  })
})

describe('the console', () => {
  it('renders the nav, the header, and only the open page', () => {
    renderFrame()
    expect(screen.getByRole('navigation', { name: zh.console })).toBeTruthy()
    expect(screen.getByRole('heading', { name: '模型' })).toBeTruthy()
    expect(screen.getByTestId('page-models')).toBeTruthy()
    expect(screen.queryByTestId('page-people')).toBeNull()
    expect(screen.getByText(zh.group_organization)).toBeTruthy()
  })

  it('hands the open page a close that leaves the console where it is', () => {
    const { renderSlot } = renderFrame()
    const owner = renderSlot.mock.calls.find(call => call[0] === 'admin.section')?.[1] as { close: () => void }
    owner.close()
    // Still the console, still on the same page: there is no panel to close.
    expect(screen.getByTestId('page-models')).toBeTruthy()
  })

  it('switches the page on a nav click and marks it current', () => {
    const { select } = renderFrame()
    fireEvent.click(screen.getByRole('button', { name: '人员' }))
    expect(select).toHaveBeenCalledWith('people')
    expect(screen.getByRole('button', { name: '人员' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByTestId('page-people')).toBeTruthy()
  })

  it('names who is signed in, and offers them the way out and the way back', () => {
    renderFrame(PAGES, { ...OPERATOR, name: '张工', signOutPath: '/auth/sign-out', accounts: true, signedIn: true })
    expect(screen.getByText('当前登录：张工')).toBeTruthy()
    expect(screen.getByRole('link', { name: zh.signOut }).getAttribute('href')).toBe('/auth/sign-out')
    // Document-relative: at /admin, './' is the workbench.
    expect(screen.getByRole('link', { name: zh.workbench }).getAttribute('href')).toBe('./')
  })

  it('names nobody and offers no sign-out on a deployment with no accounts', () => {
    renderFrame()
    expect(screen.getByText(zh.nobody)).toBeTruthy()
    expect(screen.queryByRole('link', { name: zh.signOut })).toBeNull()
  })

  it('tells a viewer who administers nothing, instead of listing pages that refuse them', () => {
    renderFrame(PAGES, { ...OPERATOR, name: '王海', signOutPath: '/auth/sign-out', administers: false, accounts: true, signedIn: true })
    expect(screen.getByRole('heading', { name: zh.refused })).toBeTruthy()
    expect(screen.getByText(zh.refusedHint)).toBeTruthy()
    expect(screen.queryByRole('button', { name: '模型' })).toBeNull()
  })

  it('shows its own sign-in page, and nothing behind it, while nobody is signed in', () => {
    renderFrame(PAGES, SIGNED_OUT)
    expect(screen.getByRole('heading', { name: zh.signInTitle })).toBeTruthy()
    expect(screen.getByText(zh.signInHint)).toBeTruthy()
    expect(screen.getByRole('link', { name: '企业单点登录' }).getAttribute('href')).toBe('/auth/sign-in/oidc')
    // The pages behind it would refuse every call, so none of them renders.
    expect(screen.queryByRole('navigation')).toBeNull()
    expect(screen.queryByTestId('page-models')).toBeNull()
    expect(screen.getByRole('link', { name: zh.workbench }).getAttribute('href')).toBe('./')
  })

  it('says nobody can sign in when the deployment configured no channel', () => {
    renderFrame(PAGES, { ...SIGNED_OUT, channels: [] })
    expect(screen.getByText(zh.signInNoChannel)).toBeTruthy()
    expect(screen.queryByRole('link', { name: '企业单点登录' })).toBeNull()
  })

  it('says so when a deployment composed no administration page', () => {
    renderFrame([])
    expect(screen.getByRole('heading', { name: zh.empty })).toBeTruthy()
    expect(screen.getByText(zh.emptyHint)).toBeTruthy()
  })
})
