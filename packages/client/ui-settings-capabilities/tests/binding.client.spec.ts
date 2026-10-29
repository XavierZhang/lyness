/**
 * What the binding holds: outcomes published before a store is baked reach
 * nobody rather than failing, and every one afterwards reaches it.
 */

import { describe, expect, it, vi } from 'vitest'
import { SectionBinding, sectionFace } from '../src/client/binding.ts'
import type { CapabilitiesOperations } from '../src/client/operations.ts'
import type { CapabilitiesRead } from '../src/client/store.ts'

const READ: CapabilitiesRead = {
  capabilities: { tools: [], connections: [] },
  models: undefined,
}

/** Every store write the section performs, as a recorder. */
function actions() {
  return {
    begin: vi.fn(), succeed: vi.fn(), fail: vi.fn(), reset: vi.fn(),
  }
}

describe('SectionBinding', () => {
  it('drops outcomes published before a store is baked', () => {
    const binding = new SectionBinding()
    // The plugin may start a read at load; the store is baked on first
    // render, which may never happen.
    expect(() => {
      binding.begin()
      binding.succeed(READ)
      binding.fail()
      binding.reset()
    }).not.toThrow()
  })

  it('publishes every outcome to the store once there is one', () => {
    const binding = new SectionBinding()
    const bound = actions()
    binding.bind(bound)
    binding.begin()
    binding.succeed(READ)
    binding.fail()
    binding.reset()
    expect(bound.begin).toHaveBeenCalledOnce()
    expect(bound.succeed).toHaveBeenCalledWith(READ)
    expect(bound.fail).toHaveBeenCalledOnce()
    expect(bound.reset).toHaveBeenCalledOnce()
  })

  it('hands the section the two verbs it drives, and binds on the way', () => {
    const binding = new SectionBinding()
    const operations: CapabilitiesOperations = {
      load: vi.fn(() => Promise.resolve()),
      retry: vi.fn(() => Promise.resolve()),
    }
    const bound = actions()
    const face = sectionFace(binding, operations)(bound)
    expect(face.load).toBe(operations.load)
    expect(face.retry).toBe(operations.retry)
    binding.begin()
    expect(bound.begin).toHaveBeenCalledOnce()
  })
})
