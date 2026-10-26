/**
 * The join between the call and the baked store: what an outcome publishes
 * before a render, and what the inject factory hands the section.
 */

import { describe, expect, it, vi } from 'vitest'
import type { AuditEntryView } from '@lyness/lyn-api-admin-audit-controller/types'
import { SectionBinding, sectionFace } from '../src/client/binding.ts'
import type { HistoryActions } from '../src/client/binding.ts'
import type { HistoryOperations } from '../src/client/operations.ts'

const ENTRY: AuditEntryView = {
  id: '2026-10-26T00:00:00.000Z:one',
  at: '2026-10-26T00:00:00.000Z',
  by: 'ada',
  standing: 'ada:tenant-administrator',
  kind: 'bot',
  subject: 'triage',
  subjectName: 'Triage',
  action: 'added',
  changes: [],
}

/** The store writes, as the framework bakes them. */
function actions(): HistoryActions & { readonly calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    begin: () => { calls.push('begin') },
    succeed: (entries) => { calls.push(`succeed:${String(entries.length)}`) },
    fail: (status) => { calls.push(`fail:${status}`) },
    reset: () => { calls.push('reset') },
    appending: () => { calls.push('appending') },
    appended: (entries) => { calls.push(`appended:${String(entries.length)}`) },
  }
}

/** Every outcome, in one sequence. */
function publishAll(binding: SectionBinding): void {
  binding.begin()
  binding.succeed([ENTRY])
  binding.fail('failed')
  binding.reset()
  binding.appending()
  binding.appended([ENTRY])
}

describe('publishing before a render', () => {
  it('publishes to nobody rather than failing', () => {
    const binding = new SectionBinding()
    // The plugin can start a read at load; the store is baked at the first
    // render, which may never happen.
    expect(() => { publishAll(binding) }).not.toThrow()
  })
})

describe('publishing once the framework has baked a store', () => {
  it('forwards every outcome to it', () => {
    const binding = new SectionBinding()
    const bound = actions()
    binding.bind(bound)

    publishAll(binding)

    expect(bound.calls).toEqual(['begin', 'succeed:1', 'fail:failed', 'reset', 'appending', 'appended:1'])
  })
})

describe('the inject factory', () => {
  it('binds the baked actions and hands the section the two calls', () => {
    const binding = new SectionBinding()
    const bound = actions()
    const load = vi.fn(() => Promise.resolve())
    const retry = vi.fn(() => Promise.resolve())
    const loadMore = vi.fn(() => Promise.resolve())
    const operations: HistoryOperations = { load, retry, loadMore }

    const injected = sectionFace(binding, operations)(bound)

    expect(injected).toEqual({ load, retry, loadMore })
    binding.begin()
    expect(bound.calls).toEqual(['begin'])
  })
})
