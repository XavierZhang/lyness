/**
 * What the binding holds: outcomes published before a store is baked reach
 * nobody rather than failing, and every one afterwards reaches it.
 */

import { describe, expect, it, vi } from 'vitest'
import type { InstructionsView } from '@lyness/lyn-api-personal-instructions-controller/types'
import { SectionBinding, sectionFace } from '../src/client/binding.ts'
import type { InstructionsOperations } from '../src/client/operations.ts'

const VIEW: InstructionsView = { owned: true, text: 'Call me Sam.', maxChars: 4_000 }

/** Every store write the section performs, as a recorder. */
function actions() {
  return {
    begin: vi.fn(), succeed: vi.fn(), fail: vi.fn(), reset: vi.fn(),
    work: vi.fn(), saved: vi.fn(), refused: vi.fn(),
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
      binding.work()
      binding.saved(VIEW)
      binding.refused('too long')
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
    binding.work()
    binding.saved(VIEW)
    binding.refused('too long')
    expect(bound.begin).toHaveBeenCalledOnce()
    expect(bound.succeed).toHaveBeenCalledWith(VIEW)
    expect(bound.fail).toHaveBeenCalledOnce()
    expect(bound.reset).toHaveBeenCalledOnce()
    expect(bound.work).toHaveBeenCalledOnce()
    expect(bound.saved).toHaveBeenCalledWith(VIEW)
    expect(bound.refused).toHaveBeenCalledWith('too long')
  })

  it('hands the section the three verbs it drives, and binds on the way', () => {
    const binding = new SectionBinding()
    const operations: InstructionsOperations = {
      load: vi.fn(() => Promise.resolve()),
      retry: vi.fn(() => Promise.resolve()),
      save: vi.fn(() => Promise.resolve()),
    }
    const bound = actions()
    const face = sectionFace(binding, operations)(bound)
    expect(face.load).toBe(operations.load)
    expect(face.retry).toBe(operations.retry)
    expect(face.save).toBe(operations.save)
    binding.begin()
    expect(bound.begin).toHaveBeenCalledOnce()
  })
})
