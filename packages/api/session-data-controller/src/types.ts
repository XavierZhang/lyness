/**
 * Wire vocabulary of the personal conversation-data surface.
 * @module @lyness/lyn-api-session-data-controller/types
 */

/** What one deletion answers. */
export interface SessionDeleteValue {
  /**
   * Every session whose stored log is gone: the conversation and each
   * subagent session beneath it.
   *
   * The page reports the count rather than assuming one, because a
   * conversation that delegated work was more than one stored log and a
   * person deleting it is entitled to know how many went.
   */
  readonly removed: readonly string[]
}

declare module '@lyness/lyn-typert-protocol' {
  interface RemoteErrorDetailsMap {
    /**
     * There is no such conversation for this caller.
     *
     * One code for two facts — absent, and belonging to somebody else —
     * deliberately: a separate refusal for the second would tell one person
     * that another's conversation exists.
     */
    'session-data/not-found': Record<string, never>
    /**
     * The conversation is open, so nothing was deleted. It is deleted after
     * it ends; a reader who closes it and asks again succeeds.
     */
    'session-data/open': Record<string, never>
  }
}
