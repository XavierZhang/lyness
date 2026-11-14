/**
 * Which stored sessions one conversation is, and the order they come in.
 */

import { describe, expect, it } from 'vitest'
import { SessionId, SESSION_FORMAT_VERSION } from '@lyness/lyn-session'
import type { SessionHeader } from '@lyness/lyn-session'
import type { SessionLineageNode } from '@lyness/lyn-session-query'
import { liveMemberOf, membersOf } from '../src/members.ts'

/**
 * One lineage node.
 * @param id - the session the node is about.
 * @param options - whether it is open, and the nodes beneath it.
 * @returns the node.
 */
function node(
  id: string,
  options: { live?: boolean; descendants?: SessionLineageNode[] } = {},
): SessionLineageNode {
  const header: SessionHeader = {
    version: SESSION_FORMAT_VERSION,
    id: SessionId(id),
    createdAt: 0,
    isSeeded: false,
  }
  return {
    session: { header, live: options.live ?? false, persisted: true },
    descendants: options.descendants ?? [],
  }
}

describe('membersOf', () => {
  it('names the conversation alone when nothing hangs from it', () => {
    expect(membersOf(SessionId('root'), [])).toEqual([SessionId('root')])
  })

  it('names each descendant after the node it hangs from', () => {
    const members = membersOf(SessionId('root'), [
      node('child', { descendants: [node('grandchild')] }),
      node('sibling'),
    ])
    expect(members).toEqual([
      SessionId('root'), SessionId('child'), SessionId('grandchild'), SessionId('sibling'),
    ])
    // The deletion walks this list backwards, so every member's descendants
    // are removed before it.
    expect([...members].reverse()).toEqual([
      SessionId('sibling'), SessionId('grandchild'), SessionId('child'), SessionId('root'),
    ])
  })

  it('takes a repeated id once', () => {
    // A corrupt corpus can name a session its own descendant; visiting it
    // twice would delete a member and then fail to find it.
    const members = membersOf(SessionId('root'), [
      node('child', { descendants: [node('root'), node('child')] }),
    ])
    expect(members).toEqual([SessionId('root'), SessionId('child')])
  })
})

describe('liveMemberOf', () => {
  it('finds no open member in a cold tree', () => {
    expect(liveMemberOf([node('child', { descendants: [node('grandchild')] })])).toBeUndefined()
  })

  it('names the open member at the top of the tree', () => {
    expect(liveMemberOf([node('child', { live: true })])).toBe(SessionId('child'))
  })

  it('names an open member nested beneath a cold one', () => {
    expect(liveMemberOf([
      node('child', { descendants: [node('grandchild', { live: true })] }),
    ])).toBe(SessionId('grandchild'))
  })
})
