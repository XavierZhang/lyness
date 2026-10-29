/**
 * Host Remote owner of the `sessionData` namespace: what a person may do to
 * their own conversations, which here is delete one.
 *
 * It reads no list of its own. The conversations a caller may see are already
 * answered by `session.list`, and a second listing would be a second answer
 * to the same question — the one place a page and the thing it acts on can
 * disagree. This namespace owns the act alone.
 *
 * Which conversations a call may act on is never a parameter. The ownership
 * rule answers it from the conversation's own log, so a caller holding
 * somebody else's id is told exactly what a caller holding an id that never
 * existed is told.
 *
 * @module @lyness/lyn-api-session-data-controller
 */

import { Context } from '@lyness/cordis'
import { Remote, RemoteError, TypertRemoteService } from '@lyness/lyn-typert-protocol'
import { SessionId } from '@lyness/lyn-session'
import { SessionDeletionLiveError } from '@lyness/lyn-session-deletion'
import { SessionAlreadyOwnedError, SessionPersistenceNotFoundError } from '@lyness/lyn-session-persistence'
import { SessionQueryError } from '@lyness/lyn-session-query'
import type {} from '@lyness/lyn-session-ownership/visibility'
import type { SessionDeleteValue } from './types.ts'

export type * from './types.ts'

declare module '@lyness/cordis' {
  interface Context {
    /** Host owner of the `sessionData` Remote namespace. */
    sessionDataController: SessionDataController
  }
}

/** What a caller who may not see a conversation is told, and so is one who named nothing. */
const NO_SUCH_CONVERSATION = 'no such conversation'

/** Host service backing the generated `ctx.remote.sessionData` namespace. */
export default class SessionDataController extends TypertRemoteService {
  static inject = ['sessionDeletion', 'sessionQuery']

  /**
   * Register the namespace.
   * @param ctx - Host context carrying the deletion service and the query service.
   */
  constructor(ctx: Context) {
    super(ctx, 'sessionDataController', { namespace: 'sessionData', requires: 'member' })
  }

  /**
   * Delete one of this caller's own conversations, with every subagent
   * session beneath it.
   *
   * Nothing is recoverable afterwards, and no other surface undoes it. What
   * goes is the stored logs and the projections cached about them; bytes a
   * conversation only referred to — an uploaded file's stored object, which
   * is addressed by its content and may be shared with another conversation —
   * are not this call's to remove, and the page that offers the control says
   * so rather than leaving a person to assume either way.
   * @param sessionId - the conversation, as a listing reported its id.
   * @returns the stored sessions that were removed.
   * @throws {RemoteError} `session-data/not-found` when this caller has no
   *   such conversation, and `session-data/open` while it is still open.
   */
  @Remote
  async delete(sessionId: string): Promise<SessionDeleteValue> {
    const id = SessionId(sessionId)
    await this.assertMayDelete(id)
    try {
      const result = await this.ctx.sessionDeletion.delete(id)
      return { removed: result.removed.map(String) }
    } catch (error: unknown) {
      // A conversation that went live between the visibility read and here,
      // or one another process is writing: the same answer, because closing
      // it is what makes the deletion succeed either way.
      if (error instanceof SessionDeletionLiveError || error instanceof SessionAlreadyOwnedError) {
        throw new RemoteError('session-data/open', error.message, {})
      }
      if (error instanceof SessionPersistenceNotFoundError) {
        throw new RemoteError('session-data/not-found', NO_SUCH_CONVERSATION, {})
      }
      throw error
    }
  }

  /**
   * Refuse unless the call in progress may see the conversation.
   *
   * The observation is the authoritative read — a live conversation answers
   * from its own projection and a cold one from its log — so this is the same
   * answer the export route acts on rather than the cheaper listing one. A
   * deployment that mounts no ownership rule has one operator, who may delete
   * what they asked to delete.
   * @param id - the conversation the call named.
   * @throws {RemoteError} `session-data/not-found` when it is absent or another person's.
   */
  private async assertMayDelete(id: SessionId): Promise<void> {
    const visibility = this.ctx.get('sessionVisibility')
    if (visibility === undefined) return
    let visible: boolean
    try {
      using observation = await this.ctx.sessionQuery.observeSession(id, { projectionMode: 'none' })
      visible = await visibility.mayReadObservation(observation)
    } catch (error: unknown) {
      if (!(error instanceof SessionQueryError && error.code === 'SESSION_QUERY_SESSION_NOT_FOUND')) throw error
      visible = false
    }
    if (!visible) throw new RemoteError('session-data/not-found', NO_SUCH_CONVERSATION, {})
  }
}
