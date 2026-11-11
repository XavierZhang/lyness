/**
 * The join between the calls and the baked store: what an outcome publishes
 * before a render, and what the inject factory hands the page.
 */

import { describe, expect, it, vi } from 'vitest'
import type { InvitationRowView } from '@lyness/lyn-api-invitations-controller/types'
import { PageBinding, pageFace } from '../src/client/binding.ts'
import type { InvitationsActions } from '../src/client/binding.ts'
import type { InvitationsOperations } from '../src/client/operations.ts'

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

/** The store writes, as the framework bakes them. */
function actions(): InvitationsActions & { readonly calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    begin: () => { calls.push('begin') },
    succeed: (invitations) => { calls.push(`succeed:${String(invitations.length)}`) },
    fail: (status) => { calls.push(`fail:${status}`) },
    reset: () => { calls.push('reset') },
    work: () => { calls.push('work') },
    issued: (invitation) => { calls.push(`issued:${invitation.id}`) },
    revoked: (id) => { calls.push(`revoked:${id}`) },
    refused: (refusal) => { calls.push(`refused:${refusal.reason}`) },
  }
}

/** Every outcome, in one sequence. */
function publishAll(binding: PageBinding): void {
  binding.begin()
  binding.succeed([INVITATION])
  binding.fail('forbidden')
  binding.reset()
  binding.work()
  binding.issued(INVITATION)
  binding.revoked(INVITATION.id)
  binding.refused({ reason: 'needs an organization', fields: ['organization'] })
}

describe('publishing before there is a store', () => {
  it('publishes to nobody rather than failing', () => {
    const binding = new PageBinding()
    // The plugin can start a read at load; the store is baked when the page
    // first renders, which may be later or never.
    expect(() => { publishAll(binding) }).not.toThrow()
  })
})

describe('publishing to the baked store', () => {
  it('forwards every outcome in the order it happened', () => {
    const binding = new PageBinding()
    const bound = actions()
    binding.bind(bound)
    publishAll(binding)
    expect(bound.calls).toEqual([
      'begin',
      'succeed:1',
      'fail:forbidden',
      'reset',
      'work',
      'issued:inv-1',
      'revoked:inv-1',
      'refused:needs an organization',
    ])
  })
})

describe('the face the page is registered with', () => {
  it('binds the store and hands over the operations and the redemption path', () => {
    const binding = new PageBinding()
    const operations: InvitationsOperations = {
      load: vi.fn(() => Promise.resolve()),
      retry: vi.fn(() => Promise.resolve()),
      issue: vi.fn(() => Promise.resolve()),
      revoke: vi.fn(() => Promise.resolve()),
    }
    const bound = actions()
    const face = pageFace(binding, operations, '/join')(bound)

    expect(face).toMatchObject({
      load: operations.load,
      retry: operations.retry,
      issue: operations.issue,
      revoke: operations.revoke,
      joinPath: '/join',
    })
    // Bound by the same call, so an outcome published afterwards lands.
    binding.begin()
    expect(bound.calls).toEqual(['begin'])
  })
})
