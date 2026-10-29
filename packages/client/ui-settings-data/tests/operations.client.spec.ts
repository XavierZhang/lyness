/**
 * What a deletion does: report the stored sessions that went, let the Host's
 * own listing decide what is left, and report a refusal with the reason the
 * deployment gave.
 */

import { describe, expect, it, vi } from 'vitest'
import { createDataOperations } from '../src/client/operations.ts'
import type { DataCalls, DataSink } from '../src/client/operations.ts'

/** Every store write the section performs, as a recorder. */
function sink() {
  return {
    work: vi.fn<DataSink['work']>(),
    done: vi.fn<DataSink['done']>(),
    refused: vi.fn<DataSink['refused']>(),
  }
}

/** Calls that answer whatever a spec scripts. */
function calls(over: Partial<DataCalls> = {}): DataCalls {
  return {
    delete: () => Promise.resolve({ ok: true, value: { removed: ['child', 'mine'] } }),
    refresh: () => Promise.resolve(),
    ...over,
  }
}

describe('createDataOperations.remove', () => {
  it('reports the row as working, then how many stored sessions went', async () => {
    const published = sink()
    const refresh = vi.fn(() => Promise.resolve())
    await createDataOperations(calls({ refresh }), published).remove('mine')
    expect(published.work).toHaveBeenCalledWith('mine')
    expect(published.done).toHaveBeenCalledWith(2)
    // The row leaves because the Host stopped listing it, not because this
    // spliced it out.
    expect(refresh).toHaveBeenCalledOnce()
  })

  it('reports a refusal with the reason the deployment gave, and asks for no listing', async () => {
    const published = sink()
    const refresh = vi.fn(() => Promise.resolve())
    await createDataOperations(calls({
      refresh,
      delete: () => Promise.resolve({ ok: false, error: { code: 'session-data/open', message: 'still open' } as never }),
    }), published).remove('mine')
    expect(published.refused).toHaveBeenCalledWith('still open')
    expect(published.done).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('reports a thrown call the same way a refused one', async () => {
    const published = sink()
    await createDataOperations(calls({
      delete: () => Promise.reject(new Error('the connection dropped')),
    }), published).remove('mine')
    expect(published.refused).toHaveBeenCalledWith('the connection dropped')
    expect(published.done).not.toHaveBeenCalled()
  })

  it('still reports the deletion when the listing afterwards fails', async () => {
    // It happened; reporting it as refused would be the wrong answer, and the
    // next successful listing corrects the stale row.
    const published = sink()
    await createDataOperations(calls({
      refresh: () => Promise.reject(new Error('the catalog is unreachable')),
    }), published).remove('mine')
    expect(published.done).toHaveBeenCalledWith(2)
    expect(published.refused).not.toHaveBeenCalled()
  })
})
