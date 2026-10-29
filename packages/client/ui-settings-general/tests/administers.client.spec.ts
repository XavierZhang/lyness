/**
 * What the shell offers when a composition has no directory, and how often it
 * asks the one it does have.
 */
import { describe, expect, it, vi } from 'vitest'
import { administersSource } from '../src/client/administers.ts'

/** A viewer service double: the two members the shell reads. */
function service(administers: boolean) {
  const listeners = new Set<() => void>()
  const load = vi.fn(() => Promise.resolve())
  const unsubscribe = vi.fn()
  const viewer = {
    load,
    state: {
      getSnapshot: () => ({ status: 'ready' as const, viewer: undefined, administers }),
      subscribe: (listener: () => void) => {
        listeners.add(listener)
        return unsubscribe
      },
    },
  }
  return { viewer, load, listeners, unsubscribe }
}

describe('administersSource', () => {
  it('offers every plane when the composition mounted no viewer service', () => {
    const source = administersSource(undefined)
    expect(source.getSnapshot()).toBe(true)
    // Nothing can change the answer, so the disposer has nothing to undo.
    const off = source.subscribe(() => {})
    off()
  })

  it('reports what the service answered', () => {
    expect(administersSource(service(true).viewer).getSnapshot()).toBe(true)
    expect(administersSource(service(false).viewer).getSnapshot()).toBe(false)
  })

  it('drives the read once however often the shell subscribes', () => {
    const { viewer, load, listeners, unsubscribe } = service(true)
    const source = administersSource(viewer)
    expect(load).not.toHaveBeenCalled()
    const off = source.subscribe(() => {})
    expect(load).toHaveBeenCalledOnce()
    source.subscribe(() => {})
    expect(load).toHaveBeenCalledOnce()
    expect(listeners.size).toBe(2)
    off()
    expect(unsubscribe).toHaveBeenCalledOnce()
  })
})
