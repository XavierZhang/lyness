/**
 * The read behind the announcements row: one shared attempt, the two ways a
 * read can fail reported alike, and a retry that shows the attempt.
 */

import { describe, expect, it, vi } from 'vitest'
import type { Announcement } from '@lyness/lyn-announcements/types'
import { createAnnouncementsReader } from '../src/client/read.ts'
import type { ReadOutcome, ReaderSink } from '../src/client/read.ts'

const RELEASE: Announcement = {
  id: 'v0-1-7',
  version: '0.1.7',
  publishedAt: '2026-10-15T08:00:00.000Z',
  title: '0.1.7',
  body: '- Administrators can grant credits',
}

/** One deferred promise, so a test can observe a read while it is in flight. */
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

/** A sink recording the calls in order, as the store's actions would receive them. */
function recorder(): ReaderSink & { readonly calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    begin: () => { calls.push('begin') },
    succeed: (announcements) => { calls.push(`succeed:${String(announcements.length)}`) },
    fail: () => { calls.push('fail') },
    reset: () => { calls.push('reset') },
  }
}

describe('createAnnouncementsReader', () => {
  it('publishes the list a read returned', async () => {
    const sink = recorder()
    const reader = createAnnouncementsReader(() => Promise.resolve({ ok: true, value: [RELEASE] }), sink)
    await reader.load()
    expect(sink.calls).toEqual(['begin', 'succeed:1'])
  })

  it('shares one read between two callers', async () => {
    const gate = deferred<ReadOutcome>()
    const read = vi.fn(() => gate.promise)
    const sink = recorder()
    const reader = createAnnouncementsReader(read, sink)
    const first = reader.load()
    const second = reader.load()
    gate.resolve({ ok: true, value: [] })
    await Promise.all([first, second])
    expect(read).toHaveBeenCalledOnce()
    expect(sink.calls).toEqual(['begin', 'succeed:0'])
  })

  it('reads again once the shared read has settled', async () => {
    const read = vi.fn(() => Promise.resolve<ReadOutcome>({ ok: true, value: [] }))
    const reader = createAnnouncementsReader(read, recorder())
    await reader.load()
    await reader.load()
    expect(read).toHaveBeenCalledTimes(2)
  })

  it('reports a refused call as a failure', async () => {
    const sink = recorder()
    const reader = createAnnouncementsReader(() => Promise.resolve({ ok: false }), sink)
    await reader.load()
    expect(sink.calls).toEqual(['begin', 'fail'])
  })

  it('reports a thrown call the same way', async () => {
    const sink = recorder()
    const reader = createAnnouncementsReader(() => Promise.reject(new Error('socket closed')), sink)
    await reader.load()
    expect(sink.calls).toEqual(['begin', 'fail'])
  })

  it('drops the previous outcome before retrying', async () => {
    const sink = recorder()
    let attempt = 0
    const reader = createAnnouncementsReader(() => {
      attempt += 1
      return attempt === 1
        ? Promise.reject(new Error('socket closed'))
        : Promise.resolve<ReadOutcome>({ ok: true, value: [RELEASE] })
    }, sink)
    await reader.load()
    await reader.retry()
    expect(sink.calls).toEqual(['begin', 'fail', 'reset', 'begin', 'succeed:1'])
  })

  it('joins the read already running rather than starting a second one', async () => {
    const gate = deferred<ReadOutcome>()
    const read = vi.fn(() => gate.promise)
    const sink = recorder()
    const reader = createAnnouncementsReader(read, sink)
    const loading = reader.load()
    const retrying = reader.retry()
    gate.resolve({ ok: true, value: [] })
    await Promise.all([loading, retrying])
    expect(read).toHaveBeenCalledOnce()
    // No reset: a retry that joins an attempt must not erase the attempt it joined.
    expect(sink.calls).toEqual(['begin', 'succeed:0'])
  })
})
