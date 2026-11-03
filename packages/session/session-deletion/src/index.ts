/**
 * Delete one conversation.
 *
 * A conversation is more than one stored session: its subagents each keep a
 * log of their own, and what was folded out of those logs is cached beside
 * them. So "delete this conversation" is an operation with an order and a
 * refusal, which is why it lives in a service rather than inside a caller.
 *
 * What it removes is exactly what the ZIP export archives — the named session
 * and the descendants `sessionQuery.traceSession` reports — so a person who
 * exported a conversation and then deleted it holds everything that was
 * taken. The two surfaces read one lineage answer rather than each deciding
 * what a conversation is.
 *
 * @module @lyness/lyn-session-deletion
 */

import { Context, Service } from '@lyness/cordis'
import type { SessionId } from '@lyness/lyn-session'
import type {} from '@lyness/lyn-session-persistence'
import type {} from '@lyness/lyn-session-projection-cache'
import { SessionDeletionLiveError } from './errors.ts'
import { liveMemberOf, membersOf } from './members.ts'
import type { SessionDeletionResult } from './types.ts'

export { SessionDeletionLiveError } from './errors.ts'
export { liveMemberOf, membersOf } from './members.ts'
export type * from './types.ts'

declare module '@lyness/cordis' {
  interface Context {
    sessionDeletion: SessionDeletion
  }
}

/** Deletes one conversation's stored logs and what was cached about them. */
export default class SessionDeletion extends Service {
  static inject = ['sessionPersistence', 'sessionQuery']

  /**
   * @param ctx - Host context carrying the persistence backend and the query service.
   */
  constructor(ctx: Context) {
    super(ctx, 'sessionDeletion')
  }

  /**
   * Delete one conversation: the named session's stored log, every subagent
   * log beneath it, and the cached projections of each.
   *
   * A conversation that is open is refused rather than removed underneath
   * itself, and the refusal names the member that is live. The trace is one
   * observation, so a member that goes live after it is caught by the
   * backend's own write exclusion instead — either way nothing is removed
   * from under a writer.
   *
   * Members go deepest first. Lineage is read from each log's own parent
   * field, so removing a parent before its children would leave them in the
   * corpus with nothing to find them by; this order keeps a failed deletion
   * retryable as the same conversation.
   * @param id - the conversation's own session.
   * @param signal - cancellation, observed between members and before each removal.
   * @returns what was removed.
   * @throws {SessionDeletionLiveError} when the conversation or a subagent beneath it is open.
   * @throws {SessionPersistenceNotFoundError} when the named session has no stored log.
   * @throws {SessionAlreadyOwnedError} when a member went live, or another process writes it.
   */
  async delete(id: SessionId, signal?: AbortSignal): Promise<SessionDeletionResult> {
    signal?.throwIfAborted()
    const lineage = await this.ctx.sessionQuery.traceSession(id, signal)
    signal?.throwIfAborted()
    if (lineage.target.live) throw new SessionDeletionLiveError(id, id)
    const members = membersOf(id, lineage.descendants)
    const live = liveMemberOf(lineage.descendants)
    if (live !== undefined) throw new SessionDeletionLiveError(id, live)
    const removed: SessionId[] = []
    const forgotten: SessionId[] = []
    const cache = this.ctx.get('sessionProjectionCache')
    // Reverse of the pre-order walk: every member's descendants come before it.
    for (const member of [...members].reverse()) {
      signal?.throwIfAborted()
      await this.ctx.sessionPersistence.delete(member, signal === undefined ? undefined : { signal })
      removed.push(member)
      // After the log, so a failure here leaves a cached record whose log is
      // gone rather than a log whose attribution was already dropped.
      if (cache !== undefined && await cache.forget(member)) forgotten.push(member)
    }
    return { removed, forgotten }
  }
}
