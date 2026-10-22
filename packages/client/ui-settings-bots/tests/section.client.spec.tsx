// @vitest-environment jsdom

/**
 * What the section shows: which bots the organization runs and what each runs
 * with, a bot composition owns shown without an edit, one whose preset is
 * gone marked rather than hidden, the read's own states, and a removal that
 * happens only after it is acknowledged.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { BotRowView, PresetOptionView } from '@lyness/lyn-api-bots-controller/types'
import { BotsSection } from '../src/client/BotsSection.tsx'
import type { BotsSectionProps } from '../src/client/BotsSection.tsx'
import type { BotsSectionState } from '../src/client/store.ts'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

const TRIAGE: BotRowView = {
  id: 'triage-id',
  displayName: 'Triage',
  organization: 'acme',
  persona: 'You answer in short sentences.',
  job: 'Reads incoming reports and files them.',
  preset: 'standard',
  written: false,
  available: true,
}

const SCRIBE: BotRowView = {
  id: 'scribe',
  displayName: 'Scribe',
  organization: 'acme',
  persona: 'You write minutes.',
  job: 'Keeps the record of a discussion.',
  preset: 'standard',
  written: true,
  available: true,
}

const STANDARD: PresetOptionView = { id: 'standard', displayName: 'Standard' }
const PLAIN: PresetOptionView = { id: 'plain' }

/** The shipped Chinese copy, so the test reads what a user reads. */
const t = ((key: keyof typeof zh, values?: Record<string, string>) => {
  const text = zh[key]
  return values === undefined
    ? text
    : text.replace(/\{(\w+)\}/gu, (_, name: string) => values[name] ?? '')
}) as BotsSectionProps['t']

/** One rendered section over a fixed state. */
function renderSection(state: BotsSectionState, over: Partial<BotsSectionProps> = {}) {
  const load = vi.fn(() => Promise.resolve())
  const retry = vi.fn(() => Promise.resolve())
  const talk = vi.fn()
  const save = vi.fn(() => Promise.resolve())
  const remove = vi.fn(() => Promise.resolve())
  const useStore = (<T,>(select: (value: BotsSectionState) => T) => select(state)) as BotsSectionProps['useStore']
  const props = { t, useStore, load, retry, talk, save, remove, ...over } as BotsSectionProps
  return { ...render(<BotsSection {...props} />), load, retry, talk, save, remove }
}

/** A ready state carrying these bots and presets. */
function ready(
  bots: readonly BotRowView[],
  presets: readonly PresetOptionView[] = [STANDARD],
  over: Partial<BotsSectionState> = {},
): BotsSectionState {
  return { status: 'ready', bots, presets, working: false, outcome: undefined, ...over }
}

const IDLE: BotsSectionState = {
  status: 'idle', bots: [], presets: [], working: false, outcome: undefined,
}

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

/**
 * One of the form's prose boxes, by the label beside it.
 * @param label - the text in the field's own label.
 * @returns the textarea under it.
 */
function prose(label: string): HTMLTextAreaElement {
  const box = screen.getAllByText(label)
    .map(one => one.parentElement?.querySelector('textarea'))
    .find((one): one is HTMLTextAreaElement => one !== null && one !== undefined)
  if (box === undefined) throw new Error(`no textarea labelled "${label}"`)
  return box
}

/** The row for one bot. */
function rowOf(name: string) {
  const row = screen.getAllByRole('listitem').find(one => one.textContent?.includes(name) ?? false)
  if (row === undefined) throw new Error(`no row for "${name}"`)
  return within(row)
}

describe('what the section says before it can show anything', () => {
  it('reads when it opens', () => {
    const { load } = renderSection(IDLE)
    expect(load).toHaveBeenCalledOnce()
  })

  it('offers a retry for a read that broke, and none for the two answers that will not change', () => {
    const { retry } = renderSection({ ...IDLE, status: 'failed' })
    fireEvent.click(screen.getByRole('button', { name: zh.retry }))
    expect(retry).toHaveBeenCalledOnce()

    cleanup()
    renderSection({ ...IDLE, status: 'unavailable' })
    expect(screen.getByText(zh.unavailable)).toBeDefined()
    expect(screen.queryByRole('button', { name: zh.retry })).toBeNull()

    cleanup()
    renderSection({ ...IDLE, status: 'forbidden' })
    expect(screen.getByText(zh.forbidden)).toBeDefined()
    expect(screen.queryByRole('button', { name: zh.retry })).toBeNull()
  })

  it('says it is loading while the read is in flight', () => {
    renderSection({ ...IDLE, status: 'loading' })
    expect(screen.getByText(zh.loading)).toBeDefined()
  })

  it('says a deployment with no bot added has none', () => {
    renderSection(ready([]))
    expect(screen.getByText(zh.none)).toBeDefined()
  })
})

describe('what one bot shows', () => {
  it('names it, its organization, what it runs with, and what it is for', () => {
    renderSection(ready([TRIAGE]))
    const row = rowOf('Triage')
    expect(row.getByText('acme')).toBeDefined()
    expect(row.getByText(zh.runsWith)).toBeDefined()
    expect(row.getByText('standard')).toBeDefined()
    expect(row.getByText('Reads incoming reports and files them.')).toBeDefined()
    // The id is what its conversations are attributed to, so it is on the
    // row rather than only in the store.
    expect(row.getByText('triage-id')).toBeDefined()
  })

  it('leaves the job line out of a bot nobody described', () => {
    renderSection(ready([{ ...TRIAGE, job: '' }]))
    expect(rowOf('Triage').queryByText('Reads incoming reports and files them.')).toBeNull()
  })

  it('shows a bot composition owns without offering to change it, and still offers to talk to it', () => {
    const { talk } = renderSection(ready([SCRIBE]))
    const row = rowOf('Scribe')
    expect(row.getByText(zh.fromConfiguration)).toBeDefined()
    expect(row.getByText(zh.fromConfigurationHint)).toBeDefined()
    // The next boot reads the file again, so an edit here would be undone.
    expect(row.queryByRole('button', { name: zh.edit })).toBeNull()
    expect(row.queryByRole('button', { name: zh.remove })).toBeNull()
    // The operator's own bots are the ones most worth talking to; only
    // changing them is refused.
    fireEvent.click(row.getByRole('button', { name: zh.talk }))
    expect(talk).toHaveBeenCalledWith('scribe')
  })

  it('starts a conversation with one, and offers none with a bot that will not run', () => {
    const { talk } = renderSection(ready([TRIAGE]))
    fireEvent.click(rowOf('Triage').getByRole('button', { name: zh.talk }))
    expect(talk).toHaveBeenCalledWith('triage-id')

    cleanup()
    const stopped = renderSection(ready([{ ...TRIAGE, available: false }]))
    const button = rowOf('Triage').getByRole('button', { name: zh.talk })
    expect(button.hasAttribute('disabled')).toBe(true)
    fireEvent.click(button)
    expect(stopped.talk).not.toHaveBeenCalled()
  })

  it('marks one whose preset the deployment no longer offers rather than hiding it', () => {
    renderSection(ready([{ ...TRIAGE, available: false }]))
    const row = rowOf('Triage')
    expect(row.getByText(zh.unavailableBot)).toBeDefined()
    expect(row.getByText(`${zh.unavailableBotHint} ${zh.talkUnavailable}`)).toBeDefined()
    // The character an administrator wrote outlives the row that ran it, so
    // it stays editable.
    expect(row.getByRole('button', { name: zh.edit })).toBeDefined()
  })
})

describe('the form an administrator adds through', () => {
  it('submits the name, the organization, the character and the preset', () => {
    const { save } = renderSection(ready([]))
    fireEvent.change(field(zh.displayName), { target: { value: 'Triage' } })
    fireEvent.change(field(zh.organization), { target: { value: 'acme' } })
    fireEvent.change(prose(zh.personaLabel), { target: { value: 'You answer briefly.' } })
    fireEvent.change(prose(zh.job), { target: { value: 'Files reports.' } })
    fireEvent.click(screen.getByRole('button', { name: zh.submitNew }))
    expect(save).toHaveBeenCalledWith({
      displayName: 'Triage',
      organization: 'acme',
      persona: 'You answer briefly.',
      job: 'Files reports.',
      preset: 'standard',
    })
  })

  it('offers only the presets the deployment answered, falling back to the id as a label', () => {
    renderSection(ready([], [STANDARD, PLAIN]))
    expect(screen.getByRole('tab', { name: 'Standard' })).toBeDefined()
    expect(screen.getByRole('tab', { name: 'plain' })).toBeDefined()
  })

  it('submits the preset the administrator picked', () => {
    const { save } = renderSection(ready([], [STANDARD, PLAIN]))
    fireEvent.change(field(zh.displayName), { target: { value: 'Triage' } })
    fireEvent.change(field(zh.organization), { target: { value: 'acme' } })
    fireEvent.click(screen.getByRole('tab', { name: 'plain' }))
    fireEvent.click(screen.getByRole('button', { name: zh.submitNew }))
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ preset: 'plain' }))
  })

  it('submits nothing for a bot with no name', () => {
    const { save } = renderSection(ready([]))
    fireEvent.click(screen.getByRole('button', { name: zh.submitNew }))
    expect(save).not.toHaveBeenCalled()
  })

  it('says there is nothing to give a bot where the deployment offers no preset', () => {
    renderSection(ready([], []))
    expect(screen.getByText(zh.presetEmpty)).toBeDefined()
    expect(screen.queryByRole('button', { name: zh.submitNew })).toBeNull()
  })

  it('reports each outcome in its own words', () => {
    renderSection(ready([TRIAGE], [STANDARD], { outcome: { kind: 'saved', displayName: 'Triage' } }))
    expect(screen.getByText(zh.savedDone.replace('{name}', 'Triage'))).toBeDefined()

    cleanup()
    renderSection(ready([], [STANDARD], { outcome: { kind: 'removed' } }))
    expect(screen.getByText(zh.removedDone)).toBeDefined()

    cleanup()
    renderSection(ready([], [STANDARD], {
      outcome: { kind: 'refused', reason: 'needs an organization', fields: ['organization'] },
    }))
    expect(screen.getByText(zh.refused.replace('{reason}', 'needs an organization'))).toBeDefined()

    cleanup()
    renderSection(ready([TRIAGE], [STANDARD], { working: true }))
    expect(screen.getByText(zh.working)).toBeDefined()
  })
})

describe('editing a bot', () => {
  it('starts from its own values and leaves edit mode when asked', () => {
    renderSection(ready([TRIAGE]))
    fireEvent.click(rowOf('Triage').getByRole('button', { name: zh.edit }))
    expect(screen.getByText(zh.editHeading.replace('{name}', 'Triage'))).toBeDefined()
    expect(prose(zh.personaLabel).value).toBe('You answer in short sentences.')
    expect(field(zh.organization).value).toBe('acme')

    fireEvent.click(rowOf('Triage').getByRole('button', { name: zh.cancelEdit }))
    expect(screen.getByText(zh.addHeading)).toBeDefined()
  })

  it('submits the id, so a change does not add a second bot', () => {
    const { save } = renderSection(ready([TRIAGE]))
    fireEvent.click(rowOf('Triage').getByRole('button', { name: zh.edit }))
    fireEvent.change(field(zh.displayName), { target: { value: 'Intake' } })
    fireEvent.click(screen.getByRole('button', { name: zh.submitEdit }))
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ id: 'triage-id', displayName: 'Intake' }))
  })
})

describe('removing a bot', () => {
  it('happens only after it is acknowledged, and says what it costs', () => {
    const { remove } = renderSection(ready([TRIAGE]))
    fireEvent.click(rowOf('Triage').getByRole('button', { name: zh.remove }))
    expect(screen.getByText(zh.removeTitle.replace('{name}', 'Triage'))).toBeDefined()
    expect(screen.getByText(zh.removeBody)).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: zh.removeCancel }))
    expect(remove).not.toHaveBeenCalled()

    fireEvent.click(rowOf('Triage').getByRole('button', { name: zh.remove }))
    fireEvent.click(screen.getByLabelText(zh.removeAcknowledge))
    fireEvent.click(screen.getByRole('button', { name: zh.removeConfirm }))
    expect(remove).toHaveBeenCalledWith('triage-id')
  })

  it('leaves edit mode when the row being edited is the row removed', () => {
    const { remove } = renderSection(ready([TRIAGE]))
    fireEvent.click(rowOf('Triage').getByRole('button', { name: zh.edit }))
    expect(screen.getByText(zh.editHeading.replace('{name}', 'Triage'))).toBeDefined()

    fireEvent.click(rowOf('Triage').getByRole('button', { name: zh.remove }))
    fireEvent.click(screen.getByLabelText(zh.removeAcknowledge))
    fireEvent.click(screen.getByRole('button', { name: zh.removeConfirm }))
    expect(remove).toHaveBeenCalledWith('triage-id')
    // Staying in edit mode would show a form for a bot that no longer exists.
    expect(screen.getByText(zh.addHeading)).toBeDefined()
  })
})
