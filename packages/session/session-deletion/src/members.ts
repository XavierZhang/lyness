/**
 * Which stored sessions one conversation is.
 *
 * Its own unit because two callers must agree about the word: the ZIP export
 * archives a conversation's members and this package removes them. Both walk
 * the lineage trace the same way, so the archive and the deletion can never
 * mean different things by "this conversation".
 *
 * @module @lyness/lyn-session-deletion/members
 */

import type { SessionId } from '@lyness/lyn-session'
import type { SessionLineageNode } from '@lyness/lyn-session-query'

/**
 * Every member of one conversation, the named session first and each
 * descendant after the node it hangs from.
 *
 * An id is taken once. A corrupt corpus can name a session its own
 * descendant, and visiting it twice would delete a member and then fail to
 * find it.
 * @param target - the conversation's own session.
 * @param descendants - the trace's descendant trees.
 * @returns the members in pre-order, each id once.
 */
export function membersOf(target: SessionId, descendants: readonly SessionLineageNode[]): SessionId[] {
  const members: SessionId[] = [target]
  const seen = new Set<SessionId>([target])
  const walk = (nodes: readonly SessionLineageNode[]): void => {
    for (const node of nodes) {
      const id = node.session.header.id
      if (seen.has(id)) continue
      seen.add(id)
      members.push(id)
      walk(node.descendants)
    }
  }
  walk(descendants)
  return members
}

/**
 * The first open session in a descendant tree, if any.
 * @param nodes - the descendant trees to search.
 * @returns the live descendant's id, or undefined when none is open.
 */
export function liveMemberOf(nodes: readonly SessionLineageNode[]): SessionId | undefined {
  for (const node of nodes) {
    if (node.session.live) return node.session.header.id
    const deeper = liveMemberOf(node.descendants)
    if (deeper !== undefined) return deeper
  }
  return undefined
}
