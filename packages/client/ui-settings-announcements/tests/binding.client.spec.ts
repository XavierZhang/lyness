/**
 * The join between the read and the baked store: what a read publishes before
 * a render, and what the inject factory hands the row.
 */

import { describe, expect, it, vi } from 'vitest'
import type { Announcement } from '@lyness/lyn-announcements/types'
import { RowBinding, rowFace } from '../src/client/binding.ts'
import type { AnnouncementActions } from '../src/client/binding.ts'
import type { AnnouncementsReader } from '../src/client/read.ts'

const RELEASE: Announcement = {
  id: 'v0-1-7',
  version: '0.1.7',
  publishedAt: '2026-10-15T08:00:00.000Z',
  title: '0.1.7',
  body: '- Administrators can grant credits',
}

/** The store writes, as the framework bakes them. */
function actions(): AnnouncementActions & { readonly calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    begin: () => { calls.push('begin') },
    succeed: (announcements) => { calls.push(`succeed:${String(announcements.length)}`) },
    fail: () => { calls.push('fail') },
    reset: () => { calls.push('reset') },
  }
}

describe('RowBinding', () => {
  it('publishes to nobody before the row has rendered', () => {
    const binding = new RowBinding()
    // A read can settle before the store instance exists; dropping its
    // outcome is what lets the plugin read without waiting for a render.
    expect(() => {
      binding.begin()
      binding.succeed([RELEASE])
      binding.fail()
      binding.reset()
    }).not.toThrow()
  })

  it('publishes every outcome once bound', () => {
    const binding = new RowBinding()
    const baked = actions()
    binding.bind(baked)
    binding.begin()
    binding.succeed([RELEASE])
    binding.fail()
    binding.reset()
    expect(baked.calls).toEqual(['begin', 'succeed:1', 'fail', 'reset'])
  })

  it('publishes to the store baked last', () => {
    const binding = new RowBinding()
    const first = actions()
    const second = actions()
    binding.bind(first)
    binding.bind(second)
    binding.begin()
    expect(first.calls).toEqual([])
    expect(second.calls).toEqual(['begin'])
  })
})

describe('rowFace', () => {
  it('binds the baked actions and hands the row the reader', () => {
    const binding = new RowBinding()
    const reader: AnnouncementsReader = { load: vi.fn(() => Promise.resolve()), retry: vi.fn(() => Promise.resolve()) }
    const baked = actions()
    const face = rowFace(binding, reader)(baked)
    expect(face.load).toBe(reader.load)
    expect(face.retry).toBe(reader.retry)
    binding.begin()
    expect(baked.calls).toEqual(['begin'])
  })
})
