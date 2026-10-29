/**
 * What the binding holds: outcomes published before a store is baked reach
 * nobody rather than failing, and the confirmation writes never reach a call.
 */

import { describe, expect, it, vi } from 'vitest'
import { SectionBinding, sectionFace } from '../src/client/binding.ts'

/** Every store write the section performs, as a recorder. */
function actions() {
  return { work: vi.fn(), done: vi.fn(), refused: vi.fn(), confirm: vi.fn(), cancel: vi.fn() }
}

/** The observable sources the framework turns into `useXxx` props. */
const sources = {
  conversations: { getSnapshot: () => [], subscribe: () => () => {} },
  exportAvailable: { getSnapshot: () => true, subscribe: () => () => {} },
}

describe('SectionBinding', () => {
  it('drops outcomes published before a store is baked', () => {
    const binding = new SectionBinding()
    // A deletion can settle before the first render, which may never happen.
    expect(() => {
      binding.work('mine')
      binding.done(2)
      binding.refused('still open')
    }).not.toThrow()
  })

  it('publishes every outcome to the store once there is one', () => {
    const binding = new SectionBinding()
    const baked = actions()
    binding.bind(baked)
    binding.work('mine')
    binding.done(2)
    binding.refused('still open')
    expect(baked.work).toHaveBeenCalledWith('mine')
    expect(baked.done).toHaveBeenCalledWith(2)
    expect(baked.refused).toHaveBeenCalledWith('still open')
  })
})

describe('sectionFace', () => {
  it('binds the baked actions and hands over the sources and the controls', () => {
    const binding = new SectionBinding()
    const remove = vi.fn(() => Promise.resolve())
    const exportConversation = vi.fn()
    const baked = actions()
    const face = sectionFace(binding, { remove }, sources, exportConversation)(baked)

    expect(face.hooks).toBe(sources)
    expect(face.remove).toBe(remove)
    face.exportConversation('mine')
    expect(exportConversation).toHaveBeenCalledWith('mine')

    // Asking and changing one's mind are store writes alone: no call is made
    // until the second click.
    face.confirm('mine')
    face.cancel()
    expect(baked.confirm).toHaveBeenCalledWith('mine')
    expect(baked.cancel).toHaveBeenCalledOnce()
    expect(remove).not.toHaveBeenCalled()

    // The binding now publishes to the store the framework baked.
    binding.done(1)
    expect(baked.done).toHaveBeenCalledWith(1)
  })
})
