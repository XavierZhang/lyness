// @vitest-environment jsdom

/**
 * What the section shows: each state of the read, one row per remembered
 * fact, and the single thing a person can do to each.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemorySection } from '../src/client/MemorySection.tsx'
import type { MemorySectionProps } from '../src/client/MemorySection.tsx'
import type { MemorySectionState } from '../src/client/store.ts'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

/** The shipped Chinese copy, so the test reads what a user reads. */
const t = ((key: keyof typeof zh, values?: Record<string, string>) => {
  const text = zh[key]
  return values === undefined
    ? text
    : text.replace(/\{(\w+)\}/gu, (_, name: string) => values[name] ?? '')
}) as MemorySectionProps['t']

/** A ready state over two remembered facts. */
function ready(over: Partial<MemorySectionState> = {}): MemorySectionState {
  return {
    status: 'ready',
    entries: [
      { id: 'one', text: 'Ada prefers metric units.', writtenAt: '2026-10-28T00:00:00.000Z' },
      { id: 'two', text: 'The office is closed on Fridays.', writtenAt: '2026-10-29T00:00:00.000Z' },
    ],
    removing: undefined,
    refused: undefined,
    ...over,
  }
}

/** One rendered section over a fixed state. */
function renderSection(state: MemorySectionState) {
  const load = vi.fn(() => Promise.resolve())
  const retry = vi.fn(() => Promise.resolve())
  const forget = vi.fn(() => Promise.resolve())
  const useStore = (<T,>(select: (value: MemorySectionState) => T) => select(state)) as MemorySectionProps['useStore']
  const view = render(<MemorySection {...{ t, useStore, load, retry, forget } as MemorySectionProps} />)
  return { ...view, load, retry, forget }
}

describe('MemorySection', () => {
  it('asks what is remembered when the section opens', () => {
    const { load } = renderSection(ready({ status: 'idle' }))
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('shows no rows until the read has answered', () => {
    renderSection(ready({ status: 'loading' }))
    expect(screen.getByText(zh.loading)).toBeDefined()
    expect(screen.queryByText('Ada prefers metric units.')).toBeNull()
  })

  it('offers a retry when the read broke, and none when nobody owns the page', () => {
    const { retry } = renderSection(ready({ status: 'failed' }))
    fireEvent.click(screen.getByText(zh.retry))
    expect(retry).toHaveBeenCalledTimes(1)
    cleanup()
    renderSection(ready({ status: 'unowned' }))
    expect(screen.getByText(zh.unowned)).toBeDefined()
    expect(screen.queryByText(zh.retry)).toBeNull()
  })

  it('lists one row per fact, each saying when it was remembered', () => {
    renderSection(ready())
    expect(screen.getByText('Ada prefers metric units.')).toBeDefined()
    expect(screen.getByText('The office is closed on Fridays.')).toBeDefined()
    expect(screen.getAllByText(/^记于 /u)).toHaveLength(2)
  })

  it('says so when nothing is remembered yet', () => {
    renderSection(ready({ entries: [] }))
    expect(screen.getByText(zh.none)).toBeDefined()
    expect(screen.queryByText(zh.forget)).toBeNull()
  })

  it('removes the fact whose own row was used', () => {
    const { forget } = renderSection(ready())
    fireEvent.click(screen.getAllByText(zh.forget)[1]!)
    expect(forget).toHaveBeenCalledWith('two')
  })

  it('reports the removal on its own row and blocks a second one meanwhile', () => {
    renderSection(ready({ removing: 'one' }))
    expect(screen.getByText(zh.forgetting)).toBeDefined()
    for (const button of screen.getAllByRole('button')) expect(button).toHaveProperty('disabled', true)
  })

  it('reports a refused removal with the reason the server gave', () => {
    renderSection(ready({ refused: '已经没有了' }))
    expect(screen.getByText('这次删除被拒绝：已经没有了')).toBeDefined()
  })

  it('says whose facts this page does not list', () => {
    renderSection(ready())
    expect(screen.getByText(zh.sharedElsewhere)).toBeDefined()
  })
})
