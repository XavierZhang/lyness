/**
 * What a deletion answers.
 * @module @lyness/lyn-session-deletion/types
 */

import type { SessionId } from '@lyness/lyn-session'

/** What one deletion removed. */
export interface SessionDeletionResult {
  /**
   * Every session whose stored log is gone, sub-sessions before the
   * conversation they belong to — the order they were removed in.
   */
  readonly removed: readonly SessionId[]
  /**
   * Sessions whose cached projections were removed with their log. A member
   * absent here had no cached record, which is ordinary: the cache is
   * optional, and a conversation can be deleted before one was ever written.
   */
  readonly forgotten: readonly SessionId[]
}
