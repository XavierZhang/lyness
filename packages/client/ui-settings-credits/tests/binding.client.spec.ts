/**
 * The join between the calls and the baked store: what an outcome publishes
 * before a render, and what the inject factory hands the section.
 */

import { describe, expect, it, vi } from 'vitest'
import type { AllowanceView, CreditAccountView } from '@lyness/lyn-api-credits-controller/types'
import { SectionBinding, sectionFace } from '../src/client/binding.ts'
import type { CreditsActions } from '../src/client/binding.ts'
import type { CreditsOperations } from '../src/client/operations.ts'

const ACCOUNT: CreditAccountView = {
  person: 'bea', available: 10, granted: 10, spent: 0, grants: [], debits: [], administrable: true,
}

const ALLOWANCE: AllowanceView = { person: 'bea', periods: ['daily', 'weekly', 'monthly'] }

/** The store writes, as the framework bakes them. */
function actions(): CreditsActions & { readonly calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    begin: () => { calls.push('begin') },
    succeed: (account) => { calls.push(`succeed:${account.person}`) },
    fail: (status) => { calls.push(`fail:${status}`) },
    reset: () => { calls.push('reset') },
    work: () => { calls.push('work') },
    granted: (outcome) => { calls.push(`granted:${outcome.person}`) },
    allowed: (allowance) => { calls.push(`allowed:${allowance.person}`) },
    refused: (reason) => { calls.push(`refused:${reason}`) },
  }
}

/** Every outcome, in one sequence. */
function publishAll(binding: SectionBinding): void {
  binding.begin()
  binding.succeed(ACCOUNT)
  binding.fail('failed')
  binding.reset()
  binding.work()
  binding.granted({ account: ACCOUNT, person: 'bea', amount: 1 })
  binding.allowed(ALLOWANCE)
  binding.refused('credits/rejected')
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
      'begin', 'succeed:bea', 'fail:failed', 'reset', 'work', 'granted:bea', 'allowed:bea', 'refused:credits/rejected',
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
    const operations: CreditsOperations = {
      load: vi.fn(() => Promise.resolve()),
      retry: vi.fn(() => Promise.resolve()),
      grant: vi.fn(() => Promise.resolve()),
      setAllowance: vi.fn(() => Promise.resolve()),
    }
    const baked = actions()
    const face = sectionFace(binding, operations)(baked)
    expect(face.load).toBe(operations.load)
    expect(face.retry).toBe(operations.retry)
    expect(face.grant).toBe(operations.grant)
    expect(face.setAllowance).toBe(operations.setAllowance)
    binding.begin()
    expect(baked.calls).toEqual(['begin'])
  })
})
