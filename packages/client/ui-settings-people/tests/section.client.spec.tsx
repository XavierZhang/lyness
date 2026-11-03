// @vitest-environment jsdom

/**
 * What the section shows: who may use the deployment and what each may do,
 * the identities admitted as them, a person composition owns shown without an
 * edit, the read's own states, and a removal that happens only after it is
 * acknowledged.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { PersonRowView } from '@deepseek-ai/dsh-api-people-controller/types'
import type { ConfiguredChannelView } from '@deepseek-ai/dsh-api-sign-in-channel-controller/types'
import { PeopleSection } from '../src/client/PeopleSection.tsx'
import type { PeopleSectionProps } from '../src/client/PeopleSection.tsx'
import type { PeopleSectionState } from '../src/client/store.ts'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

const BEA: PersonRowView = {
  id: 'bea-id',
  displayName: 'Bea',
  role: 'member',
  organization: 'acme',
  written: false,
  bindings: [],
}

const ADA: PersonRowView = {
  id: 'ada',
  displayName: 'Ada',
  role: 'platform-administrator',
  written: true,
  bindings: [{ channel: 'one', issuer: 'ww-acme', subject: 'ada-sub', written: true }],
}

const CHANNEL: ConfiguredChannelView = {
  id: 'one',
  kind: 'wecom',
  displayName: 'Head office',
  settings: { corpId: 'ww-acme' },
  configuredAt: '2026-10-17T00:00:00.000Z',
  configuredBy: 'ada',
  mounted: true,
}

/** The shipped Chinese copy, so the test reads what a user reads. */
const t = ((key: keyof typeof zh, values?: Record<string, string>) => {
  const text = zh[key]
  return values === undefined
    ? text
    : text.replace(/\{(\w+)\}/gu, (_, name: string) => values[name] ?? '')
}) as PeopleSectionProps['t']

/** One rendered section over a fixed state. */
function renderSection(state: PeopleSectionState, over: Partial<PeopleSectionProps> = {}) {
  const load = vi.fn(() => Promise.resolve())
  const retry = vi.fn(() => Promise.resolve())
  const save = vi.fn(() => Promise.resolve())
  const remove = vi.fn(() => Promise.resolve())
  const bind = vi.fn(() => Promise.resolve())
  const unbind = vi.fn(() => Promise.resolve())
  const useStore = (<T,>(select: (value: PeopleSectionState) => T) => select(state)) as PeopleSectionProps['useStore']
  const props = { t, useStore, load, retry, save, remove, bind, unbind, ...over } as PeopleSectionProps
  return { ...render(<PeopleSection {...props} />), load, retry, save, remove, bind, unbind }
}

/** A ready state carrying these people and channels. */
function ready(
  people: readonly PersonRowView[],
  channels: readonly ConfiguredChannelView[] = [CHANNEL],
  over: Partial<PeopleSectionState> = {},
): PeopleSectionState {
  return { status: 'ready', people, channels, working: false, outcome: undefined, ...over }
}

const IDLE: PeopleSectionState = {
  status: 'idle', people: [], channels: [], working: false, outcome: undefined,
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

/** The row for one person. */
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

  it('says a deployment with nobody added has nobody added', () => {
    renderSection(ready([]))
    expect(screen.getByText(zh.none)).toBeDefined()
  })
})

describe('what one person shows', () => {
  it('names them, what they may do, and the organization their standing is in', () => {
    renderSection(ready([BEA]))
    const row = rowOf('Bea')
    expect(row.getByText(zh.roleMember)).toBeDefined()
    expect(row.getByText('acme')).toBeDefined()
    // The id is what their conversations are attributed to, so it is on the
    // row rather than only in the store.
    expect(row.getByText('bea-id')).toBeDefined()
    expect(row.getByText(zh.admittedNone)).toBeDefined()
  })

  it('shows a person composition owns without offering to change them', () => {
    renderSection(ready([ADA]))
    const row = rowOf('Ada')
    expect(row.getAllByText(zh.fromConfiguration).length).toBeGreaterThan(0)
    expect(row.getByText(zh.fromConfigurationHint)).toBeDefined()
    // The next boot reads the file again, so an edit here would be undone.
    expect(row.queryByRole('button', { name: zh.edit })).toBeNull()
    expect(row.queryByRole('button', { name: zh.remove })).toBeNull()
    expect(row.queryByRole('button', { name: zh.withdraw })).toBeNull()
  })

  it('names an organization administrator by their own standing', () => {
    renderSection(ready([{ ...BEA, role: 'tenant-administrator' }]))
    expect(rowOf('Bea').getByText(zh.roleTenant)).toBeDefined()
  })

  it('withdraws one admitted identity, naming the three parts it is found by', () => {
    const admitted: PersonRowView = {
      ...BEA,
      bindings: [{ channel: 'one', issuer: 'ww-acme', subject: 'bea-sub', written: false }],
    }
    const { unbind } = renderSection(ready([admitted]))
    const row = rowOf('Bea')
    expect(row.getByText('ww-acme / bea-sub')).toBeDefined()
    fireEvent.click(row.getByRole('button', { name: zh.withdraw }))
    expect(unbind).toHaveBeenCalledWith({ channel: 'one', issuer: 'ww-acme', subject: 'bea-sub' })
  })
})

describe('the form an administrator adds through', () => {
  it('submits the name and the standing, with the organization the standing is in', () => {
    const { save } = renderSection(ready([]))
    fireEvent.change(field(zh.displayName), { target: { value: 'Bea' } })
    fireEvent.change(field(zh.organization), { target: { value: 'acme' } })
    fireEvent.click(screen.getByRole('button', { name: zh.submitNew }))
    expect(save).toHaveBeenCalledWith({ displayName: 'Bea', role: 'member', organization: 'acme' })
  })

  it('sends no organization for a platform administrator, whose standing is the platform\'s', () => {
    const { save } = renderSection(ready([]))
    fireEvent.change(field(zh.displayName), { target: { value: 'Deputy' } })
    fireEvent.change(field(zh.organization), { target: { value: 'acme' } })
    fireEvent.click(screen.getByRole('tab', { name: zh.rolePlatform }))
    expect(screen.queryByText(zh.organizationHint)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: zh.submitNew }))
    expect(save).toHaveBeenCalledWith({ displayName: 'Deputy', role: 'platform-administrator' })
  })

  it('submits nothing for a person with no name', () => {
    const { save } = renderSection(ready([]))
    fireEvent.click(screen.getByRole('button', { name: zh.submitNew }))
    expect(save).not.toHaveBeenCalled()
  })

  it('marks the field a refusal named', () => {
    renderSection(ready([], [CHANNEL], {
      outcome: { kind: 'refused', reason: 'needs an organization', fields: ['organization'] },
    }))
    expect(screen.getByText(zh.refused.replace('{reason}', 'needs an organization'))).toBeDefined()
  })

  it('reports each outcome in its own words', () => {
    renderSection(ready([BEA], [CHANNEL], { outcome: { kind: 'saved', displayName: 'Bea' } }))
    expect(screen.getByText(zh.savedDone.replace('{name}', 'Bea'))).toBeDefined()

    cleanup()
    renderSection(ready([], [CHANNEL], { outcome: { kind: 'removed' } }))
    expect(screen.getByText(zh.removedDone)).toBeDefined()

    cleanup()
    renderSection(ready([BEA], [CHANNEL], { outcome: { kind: 'bound', subject: 'bea-sub' } }))
    expect(screen.getByText(zh.boundDone.replace('{subject}', 'bea-sub'))).toBeDefined()

    cleanup()
    renderSection(ready([BEA], [CHANNEL], { outcome: { kind: 'unbound' } }))
    expect(screen.getByText(zh.unboundDone)).toBeDefined()

    cleanup()
    renderSection(ready([BEA], [CHANNEL], { working: true }))
    expect(screen.getByText(zh.working)).toBeDefined()
  })
})

describe('admitting a directory identity', () => {
  it('is offered for the person being edited, and submits all three parts', () => {
    const { bind } = renderSection(ready([BEA]))
    expect(screen.queryByText(zh.admitHeading)).toBeNull()

    fireEvent.click(rowOf('Bea').getByRole('button', { name: zh.edit }))
    expect(screen.getByText(zh.admitHeading)).toBeDefined()
    fireEvent.change(field(zh.admitIssuer), { target: { value: 'ww-acme' } })
    fireEvent.change(field(zh.admitSubject), { target: { value: 'bea-sub' } })
    fireEvent.click(screen.getByRole('button', { name: zh.admitSubmit }))
    expect(bind).toHaveBeenCalledWith({
      channel: 'one', issuer: 'ww-acme', subject: 'bea-sub', person: 'bea-id',
    })
  })

  it('submits nothing until the identity is complete', () => {
    const { bind } = renderSection(ready([BEA]))
    fireEvent.click(rowOf('Bea').getByRole('button', { name: zh.edit }))
    fireEvent.click(screen.getByRole('button', { name: zh.admitSubmit }))
    expect(bind).not.toHaveBeenCalled()

    fireEvent.change(field(zh.admitIssuer), { target: { value: 'ww-acme' } })
    fireEvent.click(screen.getByRole('button', { name: zh.admitSubmit }))
    expect(bind).not.toHaveBeenCalled()
  })

  it('says there is nothing to admit through where no channel is configured', () => {
    renderSection(ready([BEA], []))
    fireEvent.click(rowOf('Bea').getByRole('button', { name: zh.edit }))
    expect(screen.getByText(zh.admitChannelEmpty)).toBeDefined()
  })
})

describe('removing a person', () => {
  it('happens only after it is acknowledged, and says what it costs them', () => {
    const { remove } = renderSection(ready([BEA]))
    fireEvent.click(rowOf('Bea').getByRole('button', { name: zh.remove }))
    expect(screen.getByText(zh.removeTitle.replace('{name}', 'Bea'))).toBeDefined()
    expect(screen.getByText(zh.removeBody)).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: zh.removeCancel }))
    expect(remove).not.toHaveBeenCalled()

    fireEvent.click(rowOf('Bea').getByRole('button', { name: zh.remove }))
    fireEvent.click(screen.getByLabelText(zh.removeAcknowledge))
    fireEvent.click(screen.getByRole('button', { name: zh.removeConfirm }))
    expect(remove).toHaveBeenCalledWith('bea-id')
  })

  it('leaves edit mode when the row being edited is the row removed', () => {
    const { remove } = renderSection(ready([BEA]))
    fireEvent.click(rowOf('Bea').getByRole('button', { name: zh.edit }))
    expect(screen.getByText(zh.editHeading.replace('{name}', 'Bea'))).toBeDefined()

    fireEvent.click(rowOf('Bea').getByRole('button', { name: zh.remove }))
    fireEvent.click(screen.getByLabelText(zh.removeAcknowledge))
    fireEvent.click(screen.getByRole('button', { name: zh.removeConfirm }))
    expect(remove).toHaveBeenCalledWith('bea-id')
    // Staying in edit mode would show a form for somebody who no longer
    // exists, and an admit form that could name them.
    expect(screen.getByText(zh.addHeading)).toBeDefined()
  })
})

describe('editing a person', () => {
  it('starts from their own values and leaves edit mode when asked', () => {
    renderSection(ready([BEA]))
    fireEvent.click(rowOf('Bea').getByRole('button', { name: zh.edit }))
    expect(screen.getByText(zh.editHeading.replace('{name}', 'Bea'))).toBeDefined()
    expect(field(zh.displayName).value).toBe('Bea')
    expect(field(zh.organization).value).toBe('acme')

    fireEvent.click(rowOf('Bea').getByRole('button', { name: zh.cancelEdit }))
    expect(screen.getByText(zh.addHeading)).toBeDefined()
  })

  it('submits the change under their own id', () => {
    const { save } = renderSection(ready([BEA]))
    fireEvent.click(rowOf('Bea').getByRole('button', { name: zh.edit }))
    fireEvent.change(field(zh.displayName), { target: { value: 'Beatrice' } })
    fireEvent.click(screen.getByRole('button', { name: zh.submitEdit }))
    expect(save).toHaveBeenCalledWith({
      id: 'bea-id', displayName: 'Beatrice', role: 'member', organization: 'acme',
    })
  })
})
