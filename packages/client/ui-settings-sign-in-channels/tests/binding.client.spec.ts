/**
 * The join between the calls and the baked store: what an outcome publishes
 * before a render, and what the inject factory hands the section.
 */

import { describe, expect, it, vi } from 'vitest'
import type { ConfiguredChannelView } from '@deepseek-ai/dsh-api-sign-in-channel-controller/types'
import { SectionBinding, sectionFace } from '../src/client/binding.ts'
import type { ChannelsActions } from '../src/client/binding.ts'
import type { ChannelsOperations } from '../src/client/operations.ts'

const CHANNEL: ConfiguredChannelView = {
  id: 'one',
  kind: 'wecom',
  displayName: 'Head office',
  settings: {},
  configuredAt: '2026-10-17T00:00:00.000Z',
  configuredBy: 'ada',
  mounted: true,
}

/** The store writes, as the framework bakes them. */
function actions(): ChannelsActions & { readonly calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    begin: () => { calls.push('begin') },
    succeed: (read) => { calls.push(`succeed:${String(read.channels.length)}`) },
    fail: (status) => { calls.push(`fail:${status}`) },
    reset: () => { calls.push('reset') },
    work: () => { calls.push('work') },
    saved: (channel) => { calls.push(`saved:${channel.id}`) },
    removed: (id) => { calls.push(`removed:${id}`) },
    refused: (refusal) => { calls.push(`refused:${refusal.reason}`) },
  }
}

/** Every outcome, in one sequence. */
function publishAll(binding: SectionBinding): void {
  binding.begin()
  binding.succeed({ kinds: [], channels: [CHANNEL] })
  binding.fail('failed')
  binding.reset()
  binding.work()
  binding.saved(CHANNEL)
  binding.removed('one')
  binding.refused({ reason: 'sign-in-channels/not-permitted', fields: [] })
}

describe('SectionBinding', () => {
  it('publishes to nobody before the section has rendered', () => {
    const binding = new SectionBinding()
    // A read can settle before the store instance exists; dropping its
    // outcome is what lets the plugin read without waiting for a render.
    expect(() => { publishAll(binding) }).not.toThrow()
  })

  it('publishes every outcome once bound', () => {
    const binding = new SectionBinding()
    const baked = actions()
    binding.bind(baked)
    publishAll(binding)
    expect(baked.calls).toEqual([
      'begin', 'succeed:1', 'fail:failed', 'reset', 'work', 'saved:one', 'removed:one',
      'refused:sign-in-channels/not-permitted',
    ])
  })

  it('publishes to the store baked last', () => {
    const binding = new SectionBinding()
    const first = actions()
    const second = actions()
    binding.bind(first)
    binding.bind(second)
    binding.begin()
    expect(first.calls).toEqual([])
    expect(second.calls).toEqual(['begin'])
  })
})

describe('sectionFace', () => {
  it('binds the baked actions and hands the section every operation', () => {
    const binding = new SectionBinding()
    const operations: ChannelsOperations = {
      load: vi.fn(() => Promise.resolve()),
      retry: vi.fn(() => Promise.resolve()),
      save: vi.fn(() => Promise.resolve()),
      remove: vi.fn(() => Promise.resolve()),
    }
    const baked = actions()
    const face = sectionFace(binding, operations)(baked)
    expect(face.load).toBe(operations.load)
    expect(face.retry).toBe(operations.retry)
    expect(face.save).toBe(operations.save)
    expect(face.remove).toBe(operations.remove)
    binding.begin()
    expect(baked.calls).toEqual(['begin'])
  })
})
