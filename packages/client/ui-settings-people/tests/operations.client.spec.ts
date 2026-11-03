/**
 * What the section's calls do with what the deployment answers: one read
 * shared by every caller, a deployment that maintains no directory told apart
 * from a caller who may not and from a read that broke, a refusal carrying
 * the fields a form marks, and an identity change followed by the read that
 * says who exists afterwards.
 */

import { describe, expect, it, vi } from 'vitest'
import type { PersonRowView } from '@deepseek-ai/dsh-api-people-controller/types'
import type { ConfiguredChannelView } from '@deepseek-ai/dsh-api-sign-in-channel-controller/types'
import { createPeopleOperations, statusOf } from '../src/client/operations.ts'
import type { CallOutcome, PeopleCalls, PeopleSink } from '../src/client/operations.ts'

const PERSON: PersonRowView = {
  id: 'bea',
  displayName: 'Bea',
  role: 'member',
  organization: 'acme',
  written: false,
  bindings: [],
}

const CHANNEL: ConfiguredChannelView = {
  id: 'one',
  kind: 'wecom',
  displayName: 'Head office',
  settings: { corpId: 'ww-acme' },
  configuredAt: '2026-10-17T00:00:00.000Z',
  configuredBy: 'ada',
  mounted: true,
}

/** One refusal, as a Remote call answers it. */
function refused(code: string, details: object = {}, message?: string): CallOutcome<never> {
  return {
    ok: false,
    error: { code, message: message ?? code, details } as never,
  }
}

/** A sink that records what it was told. */
function recorder(): PeopleSink & { seen: string[]; read: unknown[] } {
  const seen: string[] = []
  const read: unknown[] = []
  return {
    seen,
    read,
    begin: () => { seen.push('begin') },
    succeed: (value) => { seen.push('succeed'); read.push(value) },
    fail: (status) => { seen.push(`fail:${status}`) },
    reset: () => { seen.push('reset') },
    work: () => { seen.push('work') },
    saved: (person) => { seen.push(`saved:${person.id}`) },
    removed: (id) => { seen.push(`removed:${id}`) },
    admitted: (update) => { seen.push(`admitted:${update.outcome.kind}`); read.push(update.read) },
    refused: (refusal) => { seen.push(`refused:${refusal.reason}:${refusal.fields.join(',')}`) },
  }
}

/** Calls answering whatever one test needs. */
function calls(over: Partial<PeopleCalls> = {}): PeopleCalls {
  return {
    list: () => Promise.resolve({ ok: true, value: [PERSON] }),
    channels: () => Promise.resolve({ ok: true, value: [CHANNEL] }),
    save: () => Promise.resolve({ ok: true, value: PERSON }),
    remove: () => Promise.resolve({ ok: true, value: undefined }),
    bind: () => Promise.resolve({ ok: true, value: undefined }),
    unbind: () => Promise.resolve({ ok: true, value: undefined }),
    ...over,
  }
}

describe('the read', () => {
  it('answers the people and the channels a binding may name', async () => {
    const sink = recorder()
    await createPeopleOperations(calls(), sink).load()
    expect(sink.seen).toEqual(['begin', 'succeed'])
    expect(sink.read).toEqual([{ people: [PERSON], channels: [CHANNEL] }])
  })

  it('is shared: opening the section twice asks the deployment once', async () => {
    const list = vi.fn(() => Promise.resolve<CallOutcome<readonly PersonRowView[]>>({ ok: true, value: [PERSON] }))
    const operations = createPeopleOperations(calls({ list }), recorder())
    await Promise.all([operations.load(), operations.load()])
    expect(list).toHaveBeenCalledOnce()
  })

  it('tells a deployment with no directory apart from a caller who may not read it', async () => {
    const none = recorder()
    await createPeopleOperations(calls({ list: () => Promise.resolve(refused('gateway/internal')) }), none).load()
    expect(none.seen).toEqual(['begin', 'fail:unavailable'])

    const forbidden = recorder()
    await createPeopleOperations(
      calls({ list: () => Promise.resolve(refused('people/no-standing')) }),
      forbidden,
    ).load()
    expect(forbidden.seen).toEqual(['begin', 'fail:forbidden'])
  })

  it('reports a read that broke as retryable, whichever half broke', async () => {
    const people = recorder()
    await createPeopleOperations(calls({ list: () => Promise.resolve(refused('gateway/timeout')) }), people).load()
    expect(people.seen).toEqual(['begin', 'fail:failed'])

    const channels = recorder()
    await createPeopleOperations(
      calls({ channels: () => Promise.resolve(refused('gateway/timeout')) }),
      channels,
    ).load()
    expect(channels.seen).toEqual(['begin', 'fail:failed'])

    const thrown = recorder()
    await createPeopleOperations(calls({ list: () => Promise.reject(new Error('carrier')) }), thrown).load()
    expect(thrown.seen).toEqual(['begin', 'fail:failed'])
  })

  it('drops the previous failure before a retry', async () => {
    const sink = recorder()
    const operations = createPeopleOperations(calls({ list: () => Promise.resolve(refused('gateway/timeout')) }), sink)
    await operations.load()
    await operations.retry()
    expect(sink.seen).toEqual(['begin', 'fail:failed', 'reset', 'begin', 'fail:failed'])
  })
})

describe('a change', () => {
  it('publishes what the person now reads as', async () => {
    const sink = recorder()
    await createPeopleOperations(calls(), sink).save({ displayName: 'Bea', role: 'member' })
    expect(sink.seen).toEqual(['work', 'saved:bea'])
  })

  it('publishes the removal, and the refusal with the fields the server named', async () => {
    const removed = recorder()
    await createPeopleOperations(calls(), removed).remove('bea')
    expect(removed.seen).toEqual(['work', 'removed:bea'])

    const incomplete = recorder()
    await createPeopleOperations(
      calls({ save: () => Promise.resolve(refused('people/incomplete', { fields: ['organization'] }, 'needs one')) }),
      incomplete,
    ).save({ displayName: 'Bea', role: 'tenant-administrator' })
    expect(incomplete.seen).toEqual(['work', 'refused:needs one:organization'])

    // A refusal about something else marks no field, so a form does not
    // point at one the server never named.
    const written = recorder()
    await createPeopleOperations(
      calls({ remove: () => Promise.resolve(refused('people/written', {}, 'configuration owns it')) }),
      written,
    ).remove('ada')
    expect(written.seen).toEqual(['work', 'refused:configuration owns it:'])
  })

  it('reports what the carrier rejected with when it was not a refusal', async () => {
    const sink = recorder()
    await createPeopleOperations(calls({ save: () => Promise.reject(new Error('socket closed')) }), sink)
      .save({ displayName: 'Bea', role: 'member' })
    expect(sink.seen).toEqual(['work', 'refused:socket closed:'])
  })
})

describe('an identity change', () => {
  it('is followed by the read that says who exists afterwards', async () => {
    const sink = recorder()
    const bound: PersonRowView = {
      ...PERSON,
      bindings: [{ channel: 'one', issuer: 'ww-acme', subject: 'bea', written: false }],
    }
    const operations = createPeopleOperations(calls({ list: () => Promise.resolve({ ok: true, value: [bound] }) }), sink)
    await operations.bind({ channel: 'one', issuer: 'ww-acme', subject: 'bea', person: 'bea' })
    expect(sink.seen).toEqual(['work', 'admitted:bound'])
    expect(sink.read).toEqual([{ people: [bound], channels: [CHANNEL] }])

    await operations.unbind({ channel: 'one', issuer: 'ww-acme', subject: 'bea' })
    expect(sink.seen).toEqual(['work', 'admitted:bound', 'work', 'admitted:unbound'])
  })

  it('reports the refusal rather than reading again', async () => {
    const sink = recorder()
    const list = vi.fn(() => Promise.resolve<CallOutcome<readonly PersonRowView[]>>({ ok: true, value: [PERSON] }))
    await createPeopleOperations(
      calls({ list, bind: () => Promise.resolve(refused('people/already-bound', {}, 'already admitted')) }),
      sink,
    ).bind({ channel: 'one', issuer: 'ww-acme', subject: 'bea', person: 'bea' })
    expect(sink.seen).toEqual(['work', 'refused:already admitted:'])
    expect(list).not.toHaveBeenCalled()
  })

  it('keeps a change that landed when the read after it did not', async () => {
    const sink = recorder()
    // Reporting this as refused would tell an administrator to admit
    // somebody who is already admitted.
    await createPeopleOperations(
      calls({ list: () => Promise.resolve(refused('gateway/timeout')) }),
      sink,
    ).bind({ channel: 'one', issuer: 'ww-acme', subject: 'bea', person: 'bea' })
    expect(sink.seen).toEqual(['work', 'fail:failed'])
  })
})

describe('a change the carrier did not deliver', () => {
  it('reports what it rejected with, for an identity change as for a person', async () => {
    const admitting = recorder()
    await createPeopleOperations(calls({ bind: () => Promise.reject(new Error('socket closed')) }), admitting)
      .bind({ channel: 'one', issuer: 'ww-acme', subject: 'bea', person: 'bea' })
    expect(admitting.seen).toEqual(['work', 'refused:socket closed:'])

    const removing = recorder()
    await createPeopleOperations(calls({ remove: () => Promise.reject(new Error('socket closed')) }), removing)
      .remove('bea')
    expect(removing.seen).toEqual(['work', 'refused:socket closed:'])
  })
})

describe('what one answer says about itself', () => {
  it('names the three read states a section renders', () => {
    expect(statusOf({ code: 'gateway/internal' } as never)).toBe('unavailable')
    expect(statusOf({ code: 'gateway/forbidden' } as never)).toBe('forbidden')
    expect(statusOf({ code: 'people/no-standing' } as never)).toBe('forbidden')
    expect(statusOf({ code: 'gateway/timeout' } as never)).toBe('failed')
  })
})
