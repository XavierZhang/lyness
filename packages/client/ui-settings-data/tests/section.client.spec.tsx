// @vitest-environment jsdom

/**
 * What the section shows: one row per conversation, the two controls a person
 * owns over each, the confirmation that sits on the row itself, and the
 * sentence about what a deletion does not take.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DataSection } from '../src/client/DataSection.tsx'
import type { DataSectionProps } from '../src/client/DataSection.tsx'
import type { ConversationRow } from '../src/client/rows.ts'
import type { DataSectionState } from '../src/client/store.ts'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

/** The shipped Chinese copy, so the test reads what a user reads. */
const t = ((key: keyof typeof zh, values?: Record<string, string>) => {
  const text = zh[key]
  return values === undefined
    ? text
    : text.replace(/\{(\w+)\}/gu, (_, name: string) => values[name] ?? '')
}) as DataSectionProps['t']

const ROWS: readonly ConversationRow[] = [
  { id: 'mine', title: 'The quarterly plan', updatedAt: 1_762_000_000_000 },
  { id: 'other', title: 'A note to myself', updatedAt: 1_761_000_000_000 },
]

/** A fresh state over the two conversations. */
function idle(over: Partial<DataSectionState> = {}): DataSectionState {
  return { confirming: undefined, deleting: undefined, refused: undefined, removed: undefined, ...over }
}

/** One rendered section over a fixed state. */
function renderSection(
  state: DataSectionState,
  options: { rows?: readonly ConversationRow[]; exportAvailable?: boolean } = {},
) {
  const confirm = vi.fn()
  const cancel = vi.fn()
  const remove = vi.fn(() => Promise.resolve())
  const exportConversation = vi.fn()
  const useStore = (<T,>(select: (value: DataSectionState) => T) => select(state)) as DataSectionProps['useStore']
  // The selector is applied the way the framework's own hook applies it.
  const useConversations = (<T,>(select: (value: readonly ConversationRow[]) => T) =>
    select(options.rows ?? ROWS)) as DataSectionProps['useConversations']
  const useExportAvailable = (<T,>(select: (value: boolean) => T) =>
    select(options.exportAvailable ?? true)) as DataSectionProps['useExportAvailable']
  const view = render(<DataSection {...{
    t, useStore, useConversations, useExportAvailable, confirm, cancel, remove, exportConversation,
  } as DataSectionProps} />)
  return { ...view, confirm, cancel, remove, exportConversation }
}

describe('DataSection', () => {
  it('lists one row per conversation, named as the rest of the client names it', () => {
    renderSection(idle())
    expect(screen.getByText('The quarterly plan')).toBeDefined()
    expect(screen.getByText('A note to myself')).toBeDefined()
  })

  it('says so when a person has no conversations', () => {
    renderSection(idle(), { rows: [] })
    expect(screen.getByText(zh.none)).toBeDefined()
  })

  it('starts one conversation\'s download from its own row', () => {
    const { exportConversation } = renderSection(idle())
    fireEvent.click(screen.getAllByText(zh.export)[0] as HTMLElement)
    expect(exportConversation).toHaveBeenCalledWith('mine')
  })

  it('offers no download where this deployment mounts none, and says why', () => {
    renderSection(idle(), { exportAvailable: false })
    expect(screen.queryByText(zh.export)).toBeNull()
    expect(screen.getByText(zh.noExport)).toBeDefined()
  })

  it('asks before deleting rather than deleting on the first click', () => {
    const { confirm, remove } = renderSection(idle())
    fireEvent.click(screen.getAllByText(zh.delete)[0] as HTMLElement)
    expect(confirm).toHaveBeenCalledWith('mine')
    expect(remove).not.toHaveBeenCalled()
  })

  it('deletes on the second click, on the row that was asked about', () => {
    const { remove } = renderSection(idle({ confirming: 'mine' }))
    expect(screen.getByText(zh.deleteWarning)).toBeDefined()
    fireEvent.click(screen.getByText(zh.deleteConfirm))
    expect(remove).toHaveBeenCalledWith('mine')
  })

  it('lets a reader change their mind', () => {
    const { cancel, remove } = renderSection(idle({ confirming: 'mine' }))
    fireEvent.click(screen.getByText(zh.deleteCancel))
    expect(cancel).toHaveBeenCalledOnce()
    expect(remove).not.toHaveBeenCalled()
  })

  it('asks about one row at a time', () => {
    renderSection(idle({ confirming: 'mine' }))
    // The other row still offers the ordinary control, so a confirmation is
    // never answered for a conversation the reader moved away from.
    expect(screen.getAllByText(zh.deleteConfirm)).toHaveLength(1)
    expect(screen.getAllByText(zh.delete)).toHaveLength(1)
  })

  it('reports the deletion in flight on its own row, and holds every other control', () => {
    renderSection(idle({ deleting: 'mine' }))
    expect(screen.getByText(zh.deleting)).toBeDefined()
    for (const control of screen.getAllByRole('button')) {
      expect((control as HTMLButtonElement).disabled).toBe(true)
    }
  })

  it('reports how many stored sessions went', () => {
    renderSection(idle({ removed: 3 }))
    expect(screen.getByText(zh.removed.replace('{count}', '3'))).toBeDefined()
  })

  it('reports a refusal with the reason the deployment gave', () => {
    renderSection(idle({ refused: '这段对话还开着' }))
    expect(screen.getByText(zh.refused.replace('{reason}', '这段对话还开着'))).toBeDefined()
  })

  it('always says what a deletion does not take', () => {
    // A person deciding to delete is entitled to know that an uploaded
    // file's bytes are shared and stay.
    renderSection(idle())
    expect(screen.getByText(zh.keeps)).toBeDefined()
  })
})
