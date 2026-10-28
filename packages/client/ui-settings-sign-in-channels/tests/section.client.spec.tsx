// @vitest-environment jsdom

/**
 * What the section shows: the configured channels and whether each is
 * serving, the read's own states, a form whose fields come from the kind, and
 * a removal that happens only after it is acknowledged.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { ChannelKindView, ConfiguredChannelView } from '@lyness/lyn-api-sign-in-channel-controller/types'
import { ChannelsSection } from '../src/client/ChannelsSection.tsx'
import type { ChannelsSectionProps } from '../src/client/ChannelsSection.tsx'
import type { ChannelsSectionState } from '../src/client/store.ts'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

const WECOM: ChannelKindView = {
  id: 'wecom',
  displayName: '企业微信',
  fields: [
    { name: 'corpId', label: 'corpid', required: true },
    { name: 'apiOrigin', label: 'API origin', required: false },
  ],
}

const FEISHU: ChannelKindView = {
  id: 'feishu',
  displayName: '飞书',
  fields: [{ name: 'appId', label: 'App ID', required: true }],
}

const CHANNEL: ConfiguredChannelView = {
  id: 'one',
  kind: 'wecom',
  displayName: 'Head office',
  settings: { corpId: 'ww-acme', apiOrigin: '' },
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
}) as ChannelsSectionProps['t']

/** One rendered section over a fixed state. */
function renderSection(state: ChannelsSectionState, over: Partial<ChannelsSectionProps> = {}) {
  const load = vi.fn(() => Promise.resolve())
  const retry = vi.fn(() => Promise.resolve())
  const save = vi.fn(() => Promise.resolve())
  const remove = vi.fn(() => Promise.resolve())
  const useStore = (<T,>(select: (value: ChannelsSectionState) => T) => select(state)) as ChannelsSectionProps['useStore']
  const props = { t, useStore, load, retry, save, remove, ...over } as ChannelsSectionProps
  return { ...render(<ChannelsSection {...props} />), load, retry, save, remove }
}

/** A ready state carrying these kinds and channels. */
function ready(
  kinds: readonly ChannelKindView[],
  channels: readonly ConfiguredChannelView[],
  over: Partial<ChannelsSectionState> = {},
): ChannelsSectionState {
  return { status: 'ready', kinds, channels, working: false, outcome: undefined, ...over }
}

const IDLE: ChannelsSectionState = {
  status: 'idle', kinds: [], channels: [], working: false, outcome: undefined,
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

  it('says a deployment with no channel has nobody signing in through one', () => {
    renderSection(ready([WECOM], []))
    expect(screen.getByText(zh.none)).toBeDefined()
  })
})

describe('what one configured channel shows', () => {
  it('names it, its kind, who it is for, and that it is serving', () => {
    renderSection(ready([WECOM], [CHANNEL]))
    const row = within(screen.getByRole('listitem'))
    expect(row.getByText('Head office')).toBeDefined()
    expect(row.getByText('企业微信')).toBeDefined()
    expect(row.getByText(zh.deploymentWide)).toBeDefined()
    expect(row.getByText(zh.serving)).toBeDefined()
    // The id is what an admission binding names the channel by, so it is on
    // the row rather than only in the store.
    expect(row.getByText('one')).toBeDefined()
  })

  it('says why a stored channel is not serving', () => {
    renderSection(ready([], [{ ...CHANNEL, kind: 'gone', mounted: false }]))
    const row = within(screen.getByRole('listitem'))
    expect(row.getByText(zh.notServing)).toBeDefined()
    expect(row.getByText(zh.notServingHint)).toBeDefined()
    // The kind is still named, even where this composition mounts no plugin
    // that could describe it.
    expect(row.getByText('gone')).toBeDefined()
  })

  it('names the organization a tenant channel belongs to', () => {
    renderSection(ready([WECOM], [{ ...CHANNEL, organization: 'acme' }]))
    expect(within(screen.getByRole('listitem')).getByText('acme')).toBeDefined()
  })
})

describe('the form an administrator configures through', () => {
  it('asks for exactly the settings the picked kind takes', () => {
    renderSection(ready([WECOM, FEISHU], []))
    expect(screen.getByText('corpid')).toBeDefined()
    expect(screen.getByText('API origin')).toBeDefined()
    expect(screen.queryByText('App ID')).toBeNull()

    fireEvent.click(screen.getByRole('tab', { name: '飞书' }))
    expect(screen.getByText('App ID')).toBeDefined()
    expect(screen.queryByText('corpid')).toBeNull()
  })

  it('says there is nothing to configure where no kind is mounted', () => {
    renderSection(ready([], []))
    expect(screen.getByText(zh.kindEmpty)).toBeDefined()
  })

  it('submits what was filled in, with the organization only when one is for', () => {
    const { save } = renderSection(ready([WECOM], []))
    fireEvent.change(field(zh.displayName), { target: { value: 'Head office' } })
    fireEvent.change(field('corpid'), { target: { value: 'ww-acme' } })
    fireEvent.change(field(zh.secret), { target: { value: 'the-secret' } })
    fireEvent.click(screen.getByRole('button', { name: zh.submitNew }))
    expect(save).toHaveBeenCalledWith({
      kind: 'wecom',
      displayName: 'Head office',
      settings: { corpId: 'ww-acme', apiOrigin: '' },
      secret: 'the-secret',
    })
  })

  it('submits an organization channel with the organization it is for', () => {
    const { save } = renderSection(ready([WECOM], []))
    fireEvent.change(field(zh.displayName), { target: { value: 'Acme' } })
    fireEvent.click(screen.getByRole('tab', { name: zh.scopeOrganization }))
    fireEvent.change(field(zh.organization), { target: { value: 'acme' } })
    fireEvent.change(field(zh.secret), { target: { value: 's' } })
    fireEvent.click(screen.getByRole('button', { name: zh.submitNew }))
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ organization: 'acme' }))
  })

  it('submits nothing for a channel with no name', () => {
    const { save } = renderSection(ready([WECOM], []))
    fireEvent.click(screen.getByRole('button', { name: zh.submitNew }))
    expect(save).not.toHaveBeenCalled()
  })

  it('edits one channel from its own values, and keeps the stored secret when none is typed', () => {
    const { save } = renderSection(ready([WECOM], [CHANNEL]))
    fireEvent.click(screen.getByRole('button', { name: zh.edit }))
    expect(field(zh.displayName).value).toBe('Head office')
    expect(field('corpid').value).toBe('ww-acme')
    fireEvent.change(field(zh.displayName), { target: { value: 'Shanghai office' } })
    fireEvent.click(screen.getByRole('button', { name: zh.submitEdit }))
    expect(save).toHaveBeenCalledWith({
      id: 'one',
      kind: 'wecom',
      displayName: 'Shanghai office',
      settings: { corpId: 'ww-acme', apiOrigin: '' },
    })
  })

  it('leaves edit mode when the same row is clicked again', () => {
    renderSection(ready([WECOM], [CHANNEL]))
    fireEvent.click(screen.getByRole('button', { name: zh.edit }))
    expect(screen.getByText('编辑「Head office」')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: zh.cancelEdit }))
    expect(screen.getByRole('button', { name: zh.submitNew })).toBeDefined()
    // The form is back to adding: what was typed for the edited channel is
    // not carried into the next one.
    expect(field(zh.displayName).value).toBe('')
  })

  it('edits an organization channel from its own organization', () => {
    const { save } = renderSection(ready([WECOM], [{ ...CHANNEL, organization: 'acme' }]))
    fireEvent.click(screen.getByRole('button', { name: zh.edit }))
    expect(field(zh.organization).value).toBe('acme')
    fireEvent.click(screen.getByRole('button', { name: zh.submitEdit }))
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ id: 'one', organization: 'acme' }))
  })

  it('edits a channel whose kind this composition no longer mounts', () => {
    const { save } = renderSection(ready([WECOM], [{ ...CHANNEL, kind: 'gone', mounted: false }]))
    fireEvent.click(screen.getByRole('button', { name: zh.edit }))
    // The kind is named and nothing is asked for: no mounted plugin says
    // which settings it takes, and inventing fields would invent a form.
    expect(screen.getAllByText('gone').length).toBeGreaterThan(1)
    expect(screen.queryByText('corpid')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: zh.submitEdit }))
    expect(save).not.toHaveBeenCalled()
  })

  it('leaves edit mode when the row being edited is removed', () => {
    const { remove } = renderSection(ready([WECOM], [CHANNEL]))
    fireEvent.click(screen.getByRole('button', { name: zh.edit }))
    expect(screen.getByRole('button', { name: zh.cancelEdit })).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: zh.remove }))
    fireEvent.click(screen.getByText(zh.removeAcknowledge))
    fireEvent.click(screen.getByRole('button', { name: zh.removeConfirm }))
    expect(remove).toHaveBeenCalledWith('one')
    expect(screen.queryByRole('button', { name: zh.cancelEdit })).toBeNull()
  })

  it('marks the fields an incomplete submission named', () => {
    renderSection(ready([WECOM], [], { outcome: { kind: 'refused', reason: 'needs corpId', fields: ['corpId'] } }))
    const label = screen.getByText('corpid')
    expect(label.parentElement?.className).not.toBe(screen.getByText(zh.secret).parentElement?.className)
  })

  it('says a change is in flight while one is', () => {
    renderSection(ready([WECOM], [CHANNEL], { working: true }))
    expect(screen.getByText(zh.working)).toBeDefined()
    expect(screen.getByRole('button', { name: zh.submitNew }).hasAttribute('disabled')).toBe(true)
  })

  it('reports what the last change answered', () => {
    renderSection(ready([WECOM], [CHANNEL], { outcome: { kind: 'saved', displayName: 'Head office' } }))
    expect(screen.getByText('「Head office」已配置。')).toBeDefined()

    cleanup()
    renderSection(ready([WECOM], [], { outcome: { kind: 'removed' } }))
    expect(screen.getByText(zh.removedDone)).toBeDefined()

    cleanup()
    renderSection(ready([WECOM], [], { outcome: { kind: 'refused', reason: 'needs corpId', fields: ['corpId'] } }))
    expect(screen.getByText('这次改动被拒绝：needs corpId')).toBeDefined()
  })
})

describe('removing a channel', () => {
  it('asks first, and removes nothing until the warning is acknowledged', () => {
    const { remove } = renderSection(ready([WECOM], [CHANNEL]))
    fireEvent.click(screen.getByRole('button', { name: zh.remove }))
    expect(screen.getByText(zh.removeBody)).toBeDefined()
    const confirm = screen.getByRole('button', { name: zh.removeConfirm })
    fireEvent.click(confirm)
    expect(remove).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText(zh.removeAcknowledge))
    fireEvent.click(screen.getByRole('button', { name: zh.removeConfirm }))
    expect(remove).toHaveBeenCalledWith('one')
  })

  it('removes nothing when the question is answered with keeping it', () => {
    const { remove } = renderSection(ready([WECOM], [CHANNEL]))
    fireEvent.click(screen.getByRole('button', { name: zh.remove }))
    fireEvent.click(screen.getByRole('button', { name: zh.removeCancel }))
    expect(remove).not.toHaveBeenCalled()
    expect(screen.queryByText(zh.removeBody)).toBeNull()
  })
})
