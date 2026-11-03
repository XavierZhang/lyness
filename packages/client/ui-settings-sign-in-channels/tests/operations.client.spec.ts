/**
 * What the section's calls do with what the deployment answers: one read
 * shared by every caller, a deployment that configures none told apart from a
 * caller who may not and from a read that broke, and a refusal carrying the
 * fields a form marks.
 */

import { describe, expect, it, vi } from 'vitest'
import type { ChannelKindView, ConfiguredChannelView } from '@deepseek-ai/dsh-api-sign-in-channel-controller/types'
import { createChannelsOperations, statusOf } from '../src/client/operations.ts'
import type { CallOutcome, ChannelsCalls, ChannelsSink } from '../src/client/operations.ts'

const KIND: ChannelKindView = {
  id: 'wecom',
  displayName: '企业微信',
  fields: [{ name: 'corpId', label: 'corpid', required: true }],
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
function recorder(): ChannelsSink & { seen: string[]; read: unknown[] } {
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
    saved: (channel) => { seen.push(`saved:${channel.id}`) },
    removed: (id) => { seen.push(`removed:${id}`) },
    refused: (refusal) => { seen.push(`refused:${refusal.reason}:${refusal.fields.join(',')}`) },
  }
}

/** Calls answering whatever one test needs. */
function calls(over: Partial<ChannelsCalls> = {}): ChannelsCalls {
  return {
    kinds: () => Promise.resolve({ ok: true, value: [KIND] }),
    list: () => Promise.resolve({ ok: true, value: [CHANNEL] }),
    save: () => Promise.resolve({ ok: true, value: CHANNEL }),
    remove: () => Promise.resolve({ ok: true, value: undefined }),
    ...over,
  }
}

describe('reading what can be configured', () => {
  it('answers with the kinds and the records together', async () => {
    const sink = recorder()
    await createChannelsOperations(calls(), sink).load()
    expect(sink.seen).toEqual(['begin', 'succeed'])
    expect(sink.read).toEqual([{ kinds: [KIND], channels: [CHANNEL] }])
  })

  it('asks once however many callers are waiting', async () => {
    const list = vi.fn(() => Promise.resolve({ ok: true as const, value: [CHANNEL] }))
    const operations = createChannelsOperations(calls({ list }), recorder())
    await Promise.all([operations.load(), operations.load(), operations.load()])
    expect(list).toHaveBeenCalledOnce()
  })

  it('shows the attempt rather than the failure it replaces', async () => {
    const sink = recorder()
    const operations = createChannelsOperations(calls({ list: () => Promise.reject(new Error('offline')) }), sink)
    await operations.load()
    await operations.retry()
    expect(sink.seen).toEqual(['begin', 'fail:failed', 'reset', 'begin', 'fail:failed'])
  })

  it('tells a deployment that configures none apart from a caller who may not', async () => {
    const unavailable = recorder()
    await createChannelsOperations(calls({ list: () => Promise.resolve(refused('gateway/internal')) }), unavailable).load()
    expect(unavailable.seen).toContain('fail:unavailable')

    const forbidden = recorder()
    await createChannelsOperations(calls({ kinds: () => Promise.resolve(refused('gateway/forbidden')) }), forbidden).load()
    expect(forbidden.seen).toContain('fail:forbidden')

    expect(statusOf({ code: 'sign-in-channels/no-standing' } as never)).toBe('forbidden')
    expect(statusOf({ code: 'gateway/protocol' } as never)).toBe('failed')
  })
})

describe('changing what is configured', () => {
  it('reports a saved channel as it now reads', async () => {
    const sink = recorder()
    await createChannelsOperations(calls(), sink).save({ kind: 'wecom', displayName: 'Head office', settings: {} })
    expect(sink.seen).toEqual(['work', 'saved:one'])
  })

  it('reports a removal by the channel that is gone', async () => {
    const sink = recorder()
    await createChannelsOperations(calls(), sink).remove('one')
    expect(sink.seen).toEqual(['work', 'removed:one'])
  })

  it('carries the fields an incomplete submission named', async () => {
    const sink = recorder()
    const save = () => Promise.resolve(refused('sign-in-channels/incomplete', { fields: ['corpId', 'agentId'] }, 'needs corpId, agentId'))
    await createChannelsOperations(calls({ save }), sink).save({ kind: 'wecom', displayName: '', settings: {} })
    expect(sink.seen).toEqual(['work', 'refused:needs corpId, agentId:corpId,agentId'])
  })

  it('marks no field for a refusal that was about something else', async () => {
    const sink = recorder()
    const remove = () => Promise.resolve(refused('sign-in-channels/not-permitted', {}, 'not yours'))
    await createChannelsOperations(calls({ remove }), sink).remove('one')
    expect(sink.seen).toEqual(['work', 'refused:not yours:'])
  })

  it('reports a call that threw as the refusal it is', async () => {
    const sink = recorder()
    const operations = createChannelsOperations(calls({
      save: () => Promise.reject(new Error('the socket closed')),
      remove: () => Promise.reject(new Error('the socket closed')),
    }), sink)
    await operations.save({ kind: 'wecom', displayName: 'x', settings: {} })
    await operations.remove('one')
    expect(sink.seen).toEqual(['work', 'refused:the socket closed:', 'work', 'refused:the socket closed:'])
  })

  it('reports a rejection of any error kind by what it says', async () => {
    const sink = recorder()
    const thrown = (): Promise<never> => Promise.reject(new TypeError('the worker went away'))
    const operations = createChannelsOperations(calls({ save: thrown, remove: thrown }), sink)
    await operations.save({ kind: 'wecom', displayName: 'x', settings: {} })
    await operations.remove('one')
    expect(sink.seen).toEqual(['work', 'refused:the worker went away:', 'work', 'refused:the worker went away:'])
  })
})
