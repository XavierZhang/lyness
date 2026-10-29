// @vitest-environment jsdom

/**
 * What the section shows: each state of the read, the draft told apart from
 * what is saved, and the two buttons a person has.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { InstructionsSection } from '../src/client/InstructionsSection.tsx'
import type { InstructionsSectionProps } from '../src/client/InstructionsSection.tsx'
import type { InstructionsSectionState } from '../src/client/store.ts'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

/** The shipped Chinese copy, so the test reads what a user reads. */
const t = ((key: keyof typeof zh, values?: Record<string, string>) => {
  const text = zh[key]
  return values === undefined
    ? text
    : text.replace(/\{(\w+)\}/gu, (_, name: string) => values[name] ?? '')
}) as InstructionsSectionProps['t']

/** A ready state over one saved text. */
function ready(over: Partial<InstructionsSectionState> = {}): InstructionsSectionState {
  return {
    status: 'ready',
    saved: 'Call me Sam.',
    writtenAt: '2026-10-28T00:00:00.000Z',
    maxChars: 4_000,
    working: false,
    outcome: undefined,
    ...over,
  }
}

/** One rendered section over a fixed state. */
function renderSection(state: InstructionsSectionState) {
  const load = vi.fn(() => Promise.resolve())
  const retry = vi.fn(() => Promise.resolve())
  const save = vi.fn(() => Promise.resolve())
  const useStore = (<T,>(select: (value: InstructionsSectionState) => T) => select(state)) as InstructionsSectionProps['useStore']
  const view = render(<InstructionsSection {...{ t, useStore, load, retry, save } as InstructionsSectionProps} />)
  return { ...view, load, retry, save }
}

/** The editor, by the accessible name the section gives it. */
function field(): HTMLTextAreaElement {
  return screen.getByLabelText(zh.title) as HTMLTextAreaElement
}

describe('InstructionsSection', () => {
  it('asks for what is saved when the section opens', () => {
    const { load } = renderSection(ready({ status: 'idle' }))
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('offers no editor until the read has answered', () => {
    renderSection(ready({ status: 'loading' }))
    expect(screen.getByText(zh.loading)).toBeDefined()
    expect(screen.queryByLabelText(zh.title)).toBeNull()
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

  it('shows what is saved, and says when it was', () => {
    renderSection(ready())
    expect(field().value).toBe('Call me Sam.')
    expect(screen.getByText(/上次保存于/u)).toBeDefined()
  })

  it('tells a draft apart from what is saved', () => {
    renderSection(ready())
    expect(screen.queryByText(zh.unsaved)).toBeNull()
    fireEvent.change(field(), { target: { value: 'Call me Alex.' } })
    expect(screen.getByText(zh.unsaved)).toBeDefined()
    expect(screen.queryByText(/上次保存于/u)).toBeNull()
  })

  it('sends the draft on save, and nothing while it is unchanged', () => {
    const { save } = renderSection(ready())
    const button = screen.getByText(zh.save).closest('button')
    expect(button?.disabled).toBe(true)
    fireEvent.change(field(), { target: { value: 'Call me Alex.' } })
    fireEvent.click(screen.getByText(zh.save))
    expect(save).toHaveBeenCalledWith('Call me Alex.')
  })

  it('clears by saving a blank text', () => {
    const { save } = renderSection(ready())
    fireEvent.click(screen.getByText(zh.clear))
    expect(save).toHaveBeenCalledWith('')
  })

  it('refuses to send more than this deployment accepts', () => {
    renderSection(ready({ maxChars: 8 }))
    fireEvent.change(field(), { target: { value: 'far longer than eight' } })
    expect(screen.getByText(zh.save).closest('button')?.disabled).toBe(true)
    expect(screen.getByText('21 / 8 字符')).toBeDefined()
  })

  it('reports what the last save answered', () => {
    renderSection(ready({ outcome: { kind: 'refused', reason: '太长了' } }))
    expect(screen.getByText('这次改动被拒绝：太长了')).toBeDefined()
    cleanup()
    renderSection(ready({ outcome: { kind: 'saved' } }))
    expect(screen.getByText(zh.savedNotice)).toBeDefined()
  })

  it('says a conversation already open keeps what it started with', () => {
    renderSection(ready())
    expect(screen.getByText(zh.appliesToNew)).toBeDefined()
  })
})
