/**
 * The deletion refusal a caller can act on.
 * @module @lyness/lyn-session-deletion/errors
 */

import type { SessionId } from '@lyness/lyn-session'

/**
 * The conversation is open, so nothing was removed.
 *
 * Its own failure rather than the backend's write-exclusion error because the
 * answer a reader needs is different: a conversation that is open closes, and
 * then this deletion succeeds.
 */
export class SessionDeletionLiveError extends Error {
  /**
   * @param sessionId - the conversation the deletion named.
   * @param liveSessionId - the open member; the conversation itself, or a subagent beneath it.
   */
  constructor(readonly sessionId: SessionId, readonly liveSessionId: SessionId) {
    super(sessionId === liveSessionId
      ? `conversation "${sessionId}" is open; it is deleted after it ends`
      : `conversation "${sessionId}" has an open subagent session "${liveSessionId}"; it is deleted after that ends`)
    this.name = 'SessionDeletionLiveError'
  }
}
