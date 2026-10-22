/**
 * The join between the calls and the baked store: what an outcome publishes
 * before a render, and what the inject factory hands the section.
 */

import { describe, expect, it, vi } from 'vitest'
import type { BotRowView } from '@lyness/lyn-api-bots-controller/types'
import { SectionBinding, sectionFace } from '../src/client/binding.ts'
import type { BotsActions } from '../src/client/binding.ts'
import type { BotsOperations } from '../src/client/operations.ts'

const BOT: BotRowView = {
  id: 'triage',
  displayName: 'Triage',
  organization: 'acme',
  persona: '',
  job: '',
  preset: 'standard',
  written: false,
  available: true,
}

/** The store writes, as the framework bakes them. */
function actions(): BotsActions & { readonly calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    begin: () => { calls.push('begin') },
    succeed: (read) => { calls.push(`succeed:${String(read.bots.length)}`) },
    fail: (status) => { calls.push(`fail:${status}`) },
    reset: () => { calls.push('reset') },
    work: () => { calls.push('work') },
    saved: (bot) => { calls.push(`saved:${bot.id}`) },
    removed: (id) => { calls.push(`removed:${id}`) },
    refused: (refusal) => { calls.push(`refused:${refusal.reason}`) },
  }
}

/** Every outcome, in one sequence. */
function publishAll(binding: SectionBinding): void {
  binding.begin()
  binding.succeed({ bots: [BOT], presets: [] })
  binding.fail('failed')
  binding.reset()
  binding.work()
  binding.saved(BOT)
  binding.removed('triage')
  binding.refused({ reason: 'bots/not-permitted', fields: [] })
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
      'begin', 'succeed:1', 'fail:failed', 'reset', 'work', 'saved:triage', 'removed:triage',
      'refused:bots/not-permitted',
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
    const operations: BotsOperations = {
      load: vi.fn(() => Promise.resolve()),
      retry: vi.fn(() => Promise.resolve()),
      save: vi.fn(() => Promise.resolve()),
      remove: vi.fn(() => Promise.resolve()),
    }
    const baked = actions()
    const talked: string[] = []
    const face = sectionFace(binding, operations, (id) => { talked.push(id) })(baked)
    expect(face.load).toBe(operations.load)
    expect(face.retry).toBe(operations.retry)
    expect(face.save).toBe(operations.save)
    expect(face.remove).toBe(operations.remove)
    face.talk('triage')
    expect(talked).toEqual(['triage'])
    binding.begin()
    expect(baked.calls).toEqual(['begin'])
  })
})
