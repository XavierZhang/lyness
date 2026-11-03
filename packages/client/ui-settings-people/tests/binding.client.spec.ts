/**
 * The join between the calls and the baked store: what an outcome publishes
 * before a render, and what the inject factory hands the section.
 */

import { describe, expect, it, vi } from 'vitest'
import type { PersonRowView } from '@deepseek-ai/dsh-api-people-controller/types'
import { SectionBinding, sectionFace } from '../src/client/binding.ts'
import type { PeopleActions } from '../src/client/binding.ts'
import type { PeopleOperations } from '../src/client/operations.ts'

const PERSON: PersonRowView = {
  id: 'bea',
  displayName: 'Bea',
  role: 'member',
  organization: 'acme',
  written: false,
  bindings: [],
}

/** The store writes, as the framework bakes them. */
function actions(): PeopleActions & { readonly calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    begin: () => { calls.push('begin') },
    succeed: (read) => { calls.push(`succeed:${String(read.people.length)}`) },
    fail: (status) => { calls.push(`fail:${status}`) },
    reset: () => { calls.push('reset') },
    work: () => { calls.push('work') },
    saved: (person) => { calls.push(`saved:${person.id}`) },
    removed: (id) => { calls.push(`removed:${id}`) },
    admitted: (update) => { calls.push(`admitted:${update.outcome.kind}:${String(update.read.people.length)}`) },
    refused: (refusal) => { calls.push(`refused:${refusal.reason}`) },
  }
}

/** Every outcome, in one sequence. */
function publishAll(binding: SectionBinding): void {
  binding.begin()
  binding.succeed({ people: [PERSON], channels: [] })
  binding.fail('failed')
  binding.reset()
  binding.work()
  binding.saved(PERSON)
  binding.removed('bea')
  binding.admitted({ read: { people: [PERSON], channels: [] }, outcome: { kind: 'bound', subject: 'bea' } })
  binding.refused({ reason: 'people/not-permitted', fields: [] })
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
      'begin', 'succeed:1', 'fail:failed', 'reset', 'work', 'saved:bea', 'removed:bea',
      'admitted:bound:1', 'refused:people/not-permitted',
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
    const operations: PeopleOperations = {
      load: vi.fn(() => Promise.resolve()),
      retry: vi.fn(() => Promise.resolve()),
      save: vi.fn(() => Promise.resolve()),
      remove: vi.fn(() => Promise.resolve()),
      bind: vi.fn(() => Promise.resolve()),
      unbind: vi.fn(() => Promise.resolve()),
    }
    const baked = actions()
    const face = sectionFace(binding, operations)(baked)
    expect(face.load).toBe(operations.load)
    expect(face.retry).toBe(operations.retry)
    expect(face.save).toBe(operations.save)
    expect(face.remove).toBe(operations.remove)
    expect(face.bind).toBe(operations.bind)
    expect(face.unbind).toBe(operations.unbind)
    binding.begin()
    expect(baked.calls).toEqual(['begin'])
  })
})
