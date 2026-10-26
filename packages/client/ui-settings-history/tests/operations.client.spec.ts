/**
 * What the section's call does with what the deployment answers: one read
 * shared by every caller, and a deployment that keeps no trail told apart
 * from a caller who may not read it and from a read that broke.
 */

import { describe, expect, it, vi } from 'vitest'
import type { AuditEntryView } from '@lyness/lyn-api-admin-audit-controller/types'
import { createHistoryOperations, statusOf } from '../src/client/operations.ts'
import type { CallOutcome, HistoryCalls, HistorySink } from '../src/client/operations.ts'

const ENTRY: AuditEntryView = {
  id: '2026-10-26T00:00:00.000Z:one',
  at: '2026-10-26T00:00:00.000Z',
  by: 'ada',
  standing: 'ada:tenant-administrator',
  kind: 'bot',
  subject: 'triage',
  subjectName: 'Triage',
  action: 'added',
  organization: 'acme',
  changes: [{ field: 'displayName', after: 'Triage' }],
}

/** One refusal, as a Remote call answers it. */
function refused(code: string): CallOutcome<never> {
  return { ok: false, error: { code, message: code, details: {} } as never }
}

/** A sink that records what it was told. */
function recorder(): HistorySink & { seen: string[]; read: unknown[] } {
  const seen: string[] = []
  const read: unknown[] = []
  return {
    seen,
    read,
    begin: () => { seen.push('begin') },
    succeed: (entries) => { seen.push(`succeed:${String(entries.length)}`); read.push(entries) },
    fail: (status) => { seen.push(`fail:${status}`) },
    reset: () => { seen.push('reset') },
    appending: () => { seen.push('appending') },
    appended: (entries) => { seen.push(`appended:${String(entries.length)}`) },
  }
}

describe('reading the trail', () => {
  it('publishes what the deployment answered', async () => {
    const sink = recorder()
    const calls: HistoryCalls = { read: () => Promise.resolve({ ok: true, value: [ENTRY] }) }
    await createHistoryOperations(calls, sink).load()

    expect(sink.seen).toEqual(['begin', 'succeed:1'])
    expect(sink.read).toEqual([[ENTRY]])
  })

  it('names no organization, so the deployment resolves the caller\'s own', async () => {
    const read = vi.fn(() => Promise.resolve({ ok: true as const, value: [ENTRY] }))
    await createHistoryOperations({ read }, recorder()).load()
    expect(read).toHaveBeenCalledWith({})
  })

  it('shares one in-flight read between callers', async () => {
    const sink = recorder()
    const read = vi.fn(() => Promise.resolve({ ok: true as const, value: [ENTRY] }))
    const operations = createHistoryOperations({ read }, sink)

    await Promise.all([operations.load(), operations.load(), operations.load()])

    expect(read).toHaveBeenCalledOnce()
  })

  it('continues from one entry, and reads nothing else into the page', async () => {
    const sink = recorder()
    const read = vi.fn(() => Promise.resolve({ ok: true as const, value: [ENTRY] }))
    await createHistoryOperations({ read }, sink).loadMore('2026-10-26T01:00:00.000Z:two')

    expect(read).toHaveBeenCalledWith({ before: '2026-10-26T01:00:00.000Z:two' })
    expect(sink.seen).toEqual(['appending', 'appended:1'])
  })

  it('leaves the page as it is when a continuation does not answer', async () => {
    const refusedSink = recorder()
    await createHistoryOperations(
      { read: () => Promise.resolve(refused('audit/not-permitted')) },
      refusedSink,
    ).loadMore('x')
    // The entries already shown are still true, and a reader can ask again.
    expect(refusedSink.seen).toEqual(['appending', 'appended:0'])

    const brokenSink = recorder()
    await createHistoryOperations({ read: () => Promise.reject(new Error('offline')) }, brokenSink).loadMore('x')
    expect(brokenSink.seen).toEqual(['appending', 'appended:0'])
  })

  it('reads again on a retry, after dropping the previous outcome', async () => {
    const sink = recorder()
    const read = vi.fn(() => Promise.resolve({ ok: true as const, value: [ENTRY] }))
    const operations = createHistoryOperations({ read }, sink)

    await operations.load()
    await operations.retry()

    expect(read).toHaveBeenCalledTimes(2)
    expect(sink.seen).toEqual(['begin', 'succeed:1', 'reset', 'begin', 'succeed:1'])
  })
})

describe('why one read did not answer', () => {
  it('tells a deployment that keeps none apart from a caller who may not read it', () => {
    // Only a read that broke is worth a retry button.
    expect(statusOf({ code: 'gateway/internal' } as never)).toBe('unavailable')
    expect(statusOf({ code: 'gateway/forbidden' } as never)).toBe('forbidden')
    expect(statusOf({ code: 'audit/no-standing' } as never)).toBe('forbidden')
    expect(statusOf({ code: 'audit/not-permitted' } as never)).toBe('forbidden')
    expect(statusOf({ code: 'gateway/timeout' } as never)).toBe('failed')
  })

  it('publishes the failure the refusal names', async () => {
    const sink = recorder()
    await createHistoryOperations({ read: () => Promise.resolve(refused('audit/not-permitted')) }, sink).load()
    expect(sink.seen).toEqual(['begin', 'fail:forbidden'])
  })

  it('publishes a transport failure as one a reader can retry', async () => {
    const sink = recorder()
    await createHistoryOperations({ read: () => Promise.reject(new Error('offline')) }, sink).load()
    expect(sink.seen).toEqual(['begin', 'fail:failed'])
  })
})
