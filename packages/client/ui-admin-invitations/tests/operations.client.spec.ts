/**
 * What the page's calls do with what the deployment answers: one read shared
 * by every caller, a deployment that issues no invitations told apart from a
 * caller who may not issue them and from a read that broke, a refusal
 * carrying the fields a form marks, and the code that arrives once.
 */

import { describe, expect, it, vi } from 'vitest'
import type { InvitationRowView } from '@lyness/lyn-api-invitations-controller/types'
import { createInvitationsOperations, statusOf } from '../src/client/operations.ts'
import type { CallOutcome, InvitationsCalls, InvitationsSink } from '../src/client/operations.ts'

const INVITATION: InvitationRowView = {
  id: 'inv-1',
  label: 'Bea',
  role: 'member',
  organization: 'acme',
  issuedAt: '2026-11-11T00:00:00.000Z',
  expiresAt: '2026-11-18T00:00:00.000Z',
  maxUses: 1,
  uses: 0,
  open: true,
  code: 'the-code',
}

/** One refusal, as a Remote call answers it. */
function refused(code: string, details: object = {}, message?: string): CallOutcome<never> {
  return {
    ok: false,
    error: { code, message: message ?? code, details } as never,
  }
}

/** A sink that records what it was told. */
function recorder(): InvitationsSink & { seen: string[]; read: unknown[] } {
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
    issued: (invitation) => { seen.push(`issued:${invitation.id}`); read.push(invitation) },
    revoked: (id) => { seen.push(`revoked:${id}`) },
    refused: (refusal) => { seen.push(`refused:${refusal.reason}:${refusal.fields.join(',')}`) },
  }
}

/** Calls answering whatever one test needs. */
function calls(over: Partial<InvitationsCalls> = {}): InvitationsCalls {
  return {
    list: () => Promise.resolve({ ok: true, value: [INVITATION] }),
    issue: () => Promise.resolve({ ok: true, value: INVITATION }),
    revoke: () => Promise.resolve({ ok: true, value: undefined }),
    ...over,
  }
}

describe('the read', () => {
  it('answers the invitations this standing administers', async () => {
    const sink = recorder()
    await createInvitationsOperations(calls(), sink).load()
    expect(sink.seen).toEqual(['begin', 'succeed'])
    expect(sink.read).toEqual([[INVITATION]])
  })

  it('is shared, so two callers cost the deployment one request', async () => {
    const list = vi.fn(() => Promise.resolve({ ok: true as const, value: [INVITATION] }))
    const operations = createInvitationsOperations(calls({ list }), recorder())
    await Promise.all([operations.load(), operations.load()])
    expect(list).toHaveBeenCalledOnce()
  })

  it('tells a deployment that issues none apart from a caller who may not, and from a read that broke', async () => {
    const none = recorder()
    await createInvitationsOperations(calls({ list: () => Promise.resolve(refused('gateway/internal')) }), none).load()
    expect(none.seen).toEqual(['begin', 'fail:unavailable'])

    const member = recorder()
    await createInvitationsOperations(
      calls({ list: () => Promise.resolve(refused('invitations/no-standing')) }), member).load()
    expect(member.seen).toEqual(['begin', 'fail:forbidden'])

    const broke = recorder()
    await createInvitationsOperations(calls({ list: () => Promise.reject(new Error('offline')) }), broke).load()
    expect(broke.seen).toEqual(['begin', 'fail:failed'])
  })

  it('drops the previous failure before reading again', async () => {
    const sink = recorder()
    const operations = createInvitationsOperations(
      calls({ list: () => Promise.resolve(refused('gateway/timeout')) }), sink)
    await operations.load()
    await operations.retry()
    expect(sink.seen).toEqual(['begin', 'fail:failed', 'reset', 'begin', 'fail:failed'])
  })

  it('maps a refusal that is about the standing apart from one that is not', () => {
    expect(statusOf({ code: 'gateway/forbidden', message: '', details: {} } as never)).toBe('forbidden')
    expect(statusOf({ code: 'gateway/unreachable', message: '', details: {} } as never)).toBe('failed')
  })
})

describe('issuing one', () => {
  it('publishes the invitation it answered, with the code', async () => {
    const sink = recorder()
    await createInvitationsOperations(calls(), sink).issue({ label: 'Bea', role: 'member', organization: 'acme' })
    expect(sink.seen).toEqual(['work', 'issued:inv-1'])
    expect(sink.read).toEqual([INVITATION])
  })

  it('reports a refusal with the fields the server named', async () => {
    const sink = recorder()
    await createInvitationsOperations(calls({
      issue: () => Promise.resolve(
        refused('invitations/incomplete', { fields: ['organization'] }, 'needs an organization')),
    }), sink).issue({ label: 'Lead', role: 'tenant-administrator' })
    expect(sink.seen).toEqual(['work', 'refused:needs an organization:organization'])
  })

  it('reports a refusal about something else without naming a field', async () => {
    const sink = recorder()
    await createInvitationsOperations(calls({
      issue: () => Promise.resolve(refused('invitations/out-of-bounds', {}, 'more uses than allowed')),
    }), sink).issue({ label: 'Team', role: 'member', organization: 'acme', maxUses: 9000 })
    expect(sink.seen).toEqual(['work', 'refused:more uses than allowed:'])
  })

  it('reports a transport failure as its own message', async () => {
    const sink = recorder()
    await createInvitationsOperations(calls({ issue: () => Promise.reject(new Error('offline')) }), sink)
      .issue({ label: 'Bea', role: 'member', organization: 'acme' })
    expect(sink.seen).toEqual(['work', 'refused:offline:'])
  })
})

describe('withdrawing one', () => {
  it('publishes the invitation that stops admitting anybody', async () => {
    const sink = recorder()
    await createInvitationsOperations(calls(), sink).revoke('inv-1')
    expect(sink.seen).toEqual(['work', 'revoked:inv-1'])
  })

  it('reports a refusal, and a transport failure, without closing the row', async () => {
    const standing = recorder()
    await createInvitationsOperations(calls({
      revoke: () => Promise.resolve(refused('invitations/not-permitted', {}, 'not yours')),
    }), standing).revoke('inv-1')
    expect(standing.seen).toEqual(['work', 'refused:not yours:'])

    const broke = recorder()
    await createInvitationsOperations(calls({ revoke: () => Promise.reject(new Error('offline')) }), broke)
      .revoke('inv-1')
    expect(broke.seen).toEqual(['work', 'refused:offline:'])
  })
})
