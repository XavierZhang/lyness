// @vitest-environment jsdom

/**
 * What the section shows: the recorded changes newest first with both sides
 * of every field, a kind this build does not know shown as the server named
 * it, a cut value marked, and the read's own states.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { AuditEntryView } from '@lyness/lyn-api-admin-audit-controller/types'
import { actionLabel, HistorySection, kindLabel } from '../src/client/HistorySection.tsx'
import type { HistorySectionProps } from '../src/client/HistorySection.tsx'
import type { HistorySectionState } from '../src/client/store.ts'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

const CHANGED: AuditEntryView = {
  id: '2026-10-26T02:00:00.000Z:two',
  at: '2026-10-26T02:00:00.000Z',
  by: 'ada',
  standing: 'ada:tenant-administrator',
  kind: 'bot',
  subject: 'triage',
  subjectName: 'Triage',
  action: 'changed',
  organization: 'acme',
  changes: [{ field: 'persona', before: 'Be brief.', after: 'Be thorough.' }],
}

const ADDED: AuditEntryView = {
  id: '2026-10-26T01:00:00.000Z:one',
  at: '2026-10-26T01:00:00.000Z',
  by: 'ada',
  standing: 'ada:tenant-administrator',
  kind: 'person',
  subject: 'bea',
  subjectName: 'Bea',
  action: 'added',
  organization: 'acme',
  changes: [{ field: 'role', after: 'member' }],
}

/** The shipped Chinese copy, so the test reads what a user reads. */
const t = ((key: keyof typeof zh, values?: Record<string, string>) => {
  const text = zh[key]
  return values === undefined
    ? text
    : text.replace(/\{(\w+)\}/gu, (_, name: string) => values[name] ?? '')
}) as HistorySectionProps['t']

/** One rendered section over a fixed state. */
function renderSection(state: HistorySectionState) {
  const load = vi.fn(() => Promise.resolve())
  const retry = vi.fn(() => Promise.resolve())
  const loadMore = vi.fn(() => Promise.resolve())
  const exportTrail = vi.fn(() => Promise.resolve())
  const useStore = (<T,>(select: (value: HistorySectionState) => T) => select(state)) as HistorySectionProps['useStore']
  const props = { t, useStore, load, retry, loadMore, exportTrail } as HistorySectionProps
  return { ...render(<HistorySection {...props} />), load, retry, loadMore, exportTrail }
}

/** A ready state carrying these entries. */
function ready(entries: readonly AuditEntryView[], over: Partial<HistorySectionState> = {}): HistorySectionState {
  return {
    status: 'ready',
    entries,
    more: false,
    loadingMore: false,
    exporting: false,
    exported: undefined,
    exportFailed: false,
    ...over,
  }
}

/** A state before the read has answered, with whatever one test varies. */
function pending(status: HistorySectionState['status']): HistorySectionState {
  return {
    status,
    entries: [],
    more: false,
    loadingMore: false,
    exporting: false,
    exported: undefined,
    exportFailed: false,
  }
}

describe('what the section shows', () => {
  it('reads the trail when it opens', () => {
    const { load } = renderSection(pending('idle'))
    expect(load).toHaveBeenCalledOnce()
  })

  it('shows each change with both sides of every field', () => {
    renderSection(ready([CHANGED, ADDED]))

    expect(screen.getByText('Triage')).toBeDefined()
    expect(screen.getByText('persona')).toBeDefined()
    expect(screen.getByText('Be brief.')).toBeDefined()
    expect(screen.getByText('Be thorough.')).toBeDefined()
    // An addition has only the new value, so no "was" is claimed for it.
    expect(screen.getByText('member')).toBeDefined()
    expect(screen.getAllByText(zh.fieldWas)).toHaveLength(1)
  })

  it('names an empty value rather than showing nothing where a value belongs', () => {
    renderSection(ready([{
      ...CHANGED,
      changes: [
        { field: 'job', before: 'Files reports.', after: '' },
        { field: 'persona', before: '', after: 'Be brief.' },
        // A removal keeps the value that is gone and claims nothing on the
        // other side.
        { field: 'preset', before: 'standard' },
      ],
    }]))
    expect(screen.getAllByText(zh.fieldEmpty)).toHaveLength(2)
    expect(screen.getAllByText(zh.fieldWas)).toHaveLength(3)
    expect(screen.getAllByText(zh.fieldNow)).toHaveLength(2)
  })

  it('marks a value the deployment cut, and says why once', () => {
    renderSection(ready([{
      ...CHANGED,
      changes: [{ field: 'persona', after: 'Be tho', truncated: true }],
    }]))
    expect(screen.getByText(zh.truncated)).toBeDefined()
    expect(screen.getByText(zh.truncatedHint)).toBeDefined()
  })

  it('says a credential was replaced without showing either side', () => {
    renderSection(ready([{ ...CHANGED, changes: [{ field: 'secret', redacted: true }] }]))
    expect(screen.getByText(zh.redacted)).toBeDefined()
    expect(screen.getByText(zh.redactedHint)).toBeDefined()
    expect(screen.queryByText(zh.fieldWas)).toBeNull()
    expect(screen.queryByText(zh.fieldNow)).toBeNull()
  })

  it('says so when a change recorded no field', () => {
    renderSection(ready([{ ...CHANGED, changes: [] }]))
    expect(screen.getByText(zh.noFields)).toBeDefined()
  })

  it('says so when nothing has been changed yet', () => {
    renderSection(ready([]))
    expect(screen.getByText(zh.none)).toBeDefined()
  })

  it('continues from the oldest entry shown, and says so when there is no more', () => {
    const paging = renderSection(ready([CHANGED, ADDED], { more: true }))
    fireEvent.click(screen.getByRole('button', { name: zh.loadMore }))
    // The cursor is the oldest entry on the page: an offset would move under
    // a reader while administrators work.
    expect(paging.loadMore).toHaveBeenCalledWith(ADDED.id)
    cleanup()

    renderSection(ready([CHANGED], { more: true, loadingMore: true }))
    expect(screen.getByRole('button', { name: zh.loadingMore })).toHaveProperty('disabled', true)
    cleanup()

    renderSection(ready([CHANGED]))
    expect(screen.getByText(zh.allShown)).toBeDefined()
    expect(screen.queryByRole('button', { name: zh.loadMore })).toBeNull()
  })

  it('hands the whole trail over as a file, and says what the file holds', () => {
    const exporting = renderSection(ready([CHANGED]))
    fireEvent.click(screen.getByRole('button', { name: zh.export }))
    expect(exporting.exportTrail).toHaveBeenCalledOnce()
    cleanup()

    renderSection(ready([CHANGED], { exporting: true }))
    expect(screen.getByRole('button', { name: zh.exporting })).toHaveProperty('disabled', true)
    cleanup()

    renderSection(ready([CHANGED], { exported: { count: 12, complete: true } }))
    expect(screen.getByText(zh.exportDone.replace('{count}', '12'))).toBeDefined()
    cleanup()

    // A file that is not the whole history says so rather than looking whole.
    renderSection(ready([CHANGED], { exported: { count: 10_000, complete: false } }))
    expect(screen.getByText(zh.exportPartial.replace('{count}', '10000'))).toBeDefined()
    cleanup()

    renderSection(ready([CHANGED], { exportFailed: true }))
    expect(screen.getByText(zh.exportFailed)).toBeDefined()
  })

  it('reads again when the reader refreshes', () => {
    const { retry } = renderSection(ready([CHANGED]))
    fireEvent.click(screen.getByRole('button', { name: zh.refresh }))
    expect(retry).toHaveBeenCalledOnce()
  })
})

describe('what the section says while the read is unfinished', () => {
  it('offers a retry only for a read that broke', () => {
    const failed = renderSection(pending('failed'))
    expect(screen.getByText(zh.failed)).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: zh.retry }))
    expect(failed.retry).toHaveBeenCalledOnce()
    cleanup()

    // A deployment that keeps no trail will not grow one, and a caller
    // without the standing will not gain it by asking again.
    renderSection(pending('unavailable'))
    expect(screen.getByText(zh.unavailable)).toBeDefined()
    expect(screen.queryByRole('button', { name: zh.retry })).toBeNull()
    cleanup()

    renderSection(pending('forbidden'))
    expect(screen.getByText(zh.forbidden)).toBeDefined()
    expect(screen.queryByRole('button', { name: zh.retry })).toBeNull()
    cleanup()

    renderSection(pending('loading'))
    expect(screen.getByText(zh.loading)).toBeDefined()
  })
})

describe('naming a record and what happened to it', () => {
  it('names the kinds it knows and shows another as the server named it', () => {
    expect(kindLabel('person', t)).toBe(zh.kindPerson)
    expect(kindLabel('binding', t)).toBe(zh.kindBinding)
    expect(kindLabel('bot', t)).toBe(zh.kindBot)
    expect(kindLabel('team', t)).toBe(zh.kindTeam)
    expect(kindLabel('sign-in-channel', t)).toBe(zh.kindSignInChannel)
    expect(kindLabel('credit-allowance', t)).toBe(zh.kindCreditAllowance)
    // The set is open, so a later owner of administrable records reads as
    // itself here rather than as a blank.
    expect(kindLabel('workspace', t)).toBe('workspace')
  })

  it('names each of the three actions', () => {
    expect(actionLabel('added', t)).toBe(zh.actionAdded)
    expect(actionLabel('changed', t)).toBe(zh.actionChanged)
    expect(actionLabel('removed', t)).toBe(zh.actionRemoved)
  })

  it('leaves the organization off an entry that belongs to none', () => {
    const { organization: _belongsToNone, ...platformWide } = ADDED
    renderSection(ready([platformWide]))
    expect(screen.queryByText(`${zh.organization}: acme`)).toBeNull()
  })
})
