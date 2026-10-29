/**
 * What the calls do: one in-flight read shared, a removal whose remaining
 * list comes from the answer, and a refusal reported with its reason.
 */

import { describe, expect, it, vi } from 'vitest'
import { RemoteError } from '@lyness/lyn-typert-protocol'
import type { RemoteFailure } from '@lyness/lyn-typert-protocol'
import type { MemoriesView } from '@lyness/lyn-api-memory-controller/types'
import { createMemoryOperations } from '../src/client/operations.ts'
import type { MemoryCalls, MemorySink } from '../src/client/operations.ts'

const VIEW: MemoriesView = {
  owned: true,
  entries: [{ id: 'one', text: 'Ada prefers metric units.', writtenAt: '2026-10-28T00:00:00.000Z' }],
}
const EMPTY: MemoriesView = { owned: true, entries: [] }

/** A failure as the Gateway reports one. */
const REFUSED: RemoteFailure = new RemoteError('gateway/internal', 'already gone', {})

/** A sink that records what it was told, in order. */
function recorder() {
  const seen: string[] = []
  const sink: MemorySink = {
    begin: () => { seen.push('begin') },
    succeed: (view) => { seen.push(`succeed:${String(view.entries.length)}`) },
    fail: () => { seen.push('fail') },
    reset: () => { seen.push('reset') },
    work: (id) => { seen.push(`work:${id}`) },
    refused: (reason) => { seen.push(`refused:${reason}`) },
  }
  return { seen, sink }
}

describe('the memory operations', () => {
  it('shares one read between callers that ask at once', async () => {
    const list = vi.fn(() => Promise.resolve({ ok: true as const, value: VIEW }))
    const { seen, sink } = recorder()
    const operations = createMemoryOperations({ list, forget: () => { throw new Error('unused') } }, sink)
    await Promise.all([operations.load(), operations.load()])
    expect(list).toHaveBeenCalledOnce()
    expect(seen).toEqual(['begin', 'succeed:1'])
  })

  it('shows the attempt rather than the failure it replaces', async () => {
    let answer: () => Promise<{ ok: boolean; value?: MemoriesView; error?: RemoteFailure }> =
      () => Promise.resolve({ ok: false, error: REFUSED })
    const { seen, sink } = recorder()
    const operations = createMemoryOperations(
      { list: () => answer(), forget: () => { throw new Error('unused') } } as MemoryCalls, sink)
    await operations.load()
    answer = () => Promise.resolve({ ok: true, value: VIEW })
    await operations.retry()
    expect(seen).toEqual(['begin', 'fail', 'reset', 'begin', 'succeed:1'])
  })

  it('reports a read that threw the same way as one that refused', async () => {
    const { seen, sink } = recorder()
    const operations = createMemoryOperations({
      list: () => Promise.reject(new Error('the carrier went away')),
      forget: () => { throw new Error('unused') },
    }, sink)
    await operations.load()
    expect(seen).toEqual(['begin', 'fail'])
  })

  it('publishes what remains rather than splicing the row out locally', async () => {
    const { seen, sink } = recorder()
    const operations = createMemoryOperations({
      list: () => { throw new Error('unused') },
      forget: () => Promise.resolve({ ok: true as const, value: EMPTY }),
    }, sink)
    await operations.forget('one')
    expect(seen).toEqual(['work:one', 'succeed:0'])
  })

  it('reports a refused removal with the reason the server gave', async () => {
    const { seen, sink } = recorder()
    const operations = createMemoryOperations({
      list: () => { throw new Error('unused') },
      forget: () => Promise.resolve({ ok: false as const, error: REFUSED }),
    }, sink)
    await operations.forget('one')
    expect(seen).toEqual(['work:one', 'refused:already gone'])
  })

  it('reports a removal that threw with what it threw', async () => {
    const { seen, sink } = recorder()
    const operations = createMemoryOperations({
      list: () => { throw new Error('unused') },
      forget: () => Promise.reject(new Error('the carrier went away')),
    }, sink)
    await operations.forget('one')
    expect(seen).toEqual(['work:one', 'refused:the carrier went away'])
  })
})
