// @vitest-environment jsdom

/**
 * What the row shows: the latest title, the reader's three states, and the
 * fields an announcement carries only when the deployment published them.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { Announcement } from '@lyness/lyn-announcements/types'
import { AnnouncementsRow } from '../src/client/AnnouncementsRow.tsx'
import type { AnnouncementsRowProps } from '../src/client/AnnouncementsRow.tsx'
import type { AnnouncementsRowState } from '../src/client/settings-store.ts'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

const RELEASE: Announcement = {
  id: 'v0-1-7',
  version: '0.1.7',
  publishedAt: '2026-10-15T08:00:00.000Z',
  title: '0.1.7 发布',
  body: '管理员可以授予积分',
  url: 'https://example.com/releases/0.1.7',
}

const NOTICE: Announcement = {
  id: 'maintenance',
  publishedAt: '2026-10-20T16:00:00.000Z',
  title: '例行维护',
  body: '约 30 分钟。',
}

/** The shipped Chinese copy, so the test reads what a user reads. */
const t = ((key: keyof typeof zh, values?: Record<string, string>) => {
  const text = zh[key]
  return values === undefined
    ? text
    : text.replace(/\{(\w+)\}/gu, (_, name: string) => values[name] ?? '')
}) as AnnouncementsRowProps['t']

function renderRow(state: AnnouncementsRowState, over: Partial<AnnouncementsRowProps> = {}) {
  const load = vi.fn(() => Promise.resolve())
  const retry = vi.fn(() => Promise.resolve())
  const useStore = (<T,>(select: (value: AnnouncementsRowState) => T) => select(state)) as AnnouncementsRowProps['useStore']
  const props = { t, useStore, load, retry, ...over } as AnnouncementsRowProps
  return { ...render(<AnnouncementsRow {...props} />), load, retry }
}

describe('AnnouncementsRow', () => {
  it('names the row and nothing else before a read', () => {
    renderRow({ status: 'idle', announcements: [] })
    expect(screen.getByText(zh.row)).toBeDefined()
    expect(screen.queryByText(zh.loading)).toBeNull()
  })

  it('names the newest announcement once there is one', () => {
    renderRow({ status: 'ready', announcements: [NOTICE, RELEASE] })
    expect(screen.getByText(`最新：${NOTICE.title}`)).toBeDefined()
  })

  it('starts the read when the reader opens, not before', () => {
    const { load } = renderRow({ status: 'idle', announcements: [] })
    expect(load).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: zh.open }))
    expect(load).toHaveBeenCalledOnce()
  })

  it('says it is reading while the read is in flight', () => {
    renderRow({ status: 'loading', announcements: [] })
    fireEvent.click(screen.getByRole('button', { name: zh.open }))
    expect(screen.getByText(zh.loading)).toBeDefined()
  })

  it('offers a retry and nothing else after a failure', () => {
    const { retry } = renderRow({ status: 'failed', announcements: [] })
    fireEvent.click(screen.getByRole('button', { name: zh.open }))
    expect(screen.getByText(zh.failed)).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: zh.retry }))
    expect(retry).toHaveBeenCalledOnce()
  })

  it('says so when the deployment has published nothing', () => {
    renderRow({ status: 'ready', announcements: [] })
    fireEvent.click(screen.getByRole('button', { name: zh.open }))
    expect(screen.getByText(zh.empty)).toBeDefined()
  })

  it('shows the release an announcement names, and its full notes', () => {
    renderRow({ status: 'ready', announcements: [RELEASE] })
    fireEvent.click(screen.getByRole('button', { name: zh.open }))
    expect(screen.getByText('版本 0.1.7')).toBeDefined()
    expect(screen.getByRole('link', { name: zh.readMore }).getAttribute('href')).toBe(RELEASE.url)
  })

  it('omits the release and the link for an announcement carrying neither', () => {
    renderRow({ status: 'ready', announcements: [NOTICE] })
    fireEvent.click(screen.getByRole('button', { name: zh.open }))
    expect(screen.getByText(NOTICE.title)).toBeDefined()
    expect(screen.queryByText(/^版本 /u)).toBeNull()
    expect(screen.queryByRole('link', { name: zh.readMore })).toBeNull()
  })

  it('closes the reader without touching the read', () => {
    const { load } = renderRow({ status: 'ready', announcements: [RELEASE] })
    fireEvent.click(screen.getByRole('button', { name: zh.open }))
    fireEvent.click(screen.getByRole('button', { name: zh.close }))
    expect(screen.queryByText(zh.empty)).toBeNull()
    expect(load).toHaveBeenCalledOnce()
  })
})
