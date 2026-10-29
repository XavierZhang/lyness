/**
 * What the binding holds: outcomes published before a store is baked reach
 * nobody rather than failing, and every one afterwards reaches it.
 */

import { describe, expect, it, vi } from 'vitest'
import type { MemoriesView } from '@lyness/lyn-api-memory-controller/types'
import { SectionBinding, sectionFace } from '../src/client/binding.ts'
import type { MemoryOperations } from '../src/client/operations.ts'

const VIEW: MemoriesView = {
  owned: true,
  entries: [{ id: 'one', text: 'Ada prefers metric units.', writtenAt: '2026-10-28T00:00:00.000Z' }],
}

/** Every store write the section performs, as a recorder. */
function actions() {
  return {
    begin: vi.fn(), succeed: vi.fn(), fail: vi.fn(), reset: vi.fn(),
    work: vi.fn(), refused: vi.fn(),
  }
}

describe('SectionBinding', () => {
  it('drops outcomes published before a store is baked', () => {
    const binding = new SectionBinding()
    // The plugin may start a read at load; the store is baked on first
    // render, which may never happen.
    expect(() => {
      binding.begin()
      binding.succeed(VIEW)
      binding.fail()
      binding.reset()
      binding.work('one')
      binding.refused('already gone')
    }).not.toThrow()
  })

  it('publishes every outcome to the store once there is one', () => {
    const binding = new SectionBinding()
    const bound = actions()
    binding.bind(bound)
    binding.begin()
    binding.succeed(VIEW)
    binding.fail()
    binding.reset()
    binding.work('one')
    binding.refused('already gone')
    expect(bound.begin).toHaveBeenCalledOnce()
    expect(bound.succeed).toHaveBeenCalledWith(VIEW)
    expect(bound.fail).toHaveBeenCalledOnce()
    expect(bound.reset).toHaveBeenCalledOnce()
    expect(bound.work).toHaveBeenCalledWith('one')
    expect(bound.refused).toHaveBeenCalledWith('already gone')
  })

  it('hands the section the three verbs it drives, and binds on the way', () => {
    const binding = new SectionBinding()
    const operations: MemoryOperations = {
      load: vi.fn(() => Promise.resolve()),
      retry: vi.fn(() => Promise.resolve()),
      forget: vi.fn(() => Promise.resolve()),
    }
    const bound = actions()
    const face = sectionFace(binding, operations)(bound)
    expect(face.load).toBe(operations.load)
    expect(face.retry).toBe(operations.retry)
    expect(face.forget).toBe(operations.forget)
    binding.begin()
    expect(bound.begin).toHaveBeenCalledOnce()
  })
})
