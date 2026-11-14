/**
 * What the two logs record when one bot asks another.
 *
 * Both sides, because an answer is a disclosure: the asking side records what
 * it learned and from whom, and the answering side records who asked it what,
 * so the bot's own readers can see what it has been asked for. Neither event
 * carries the other side's conversation.
 *
 * @module @deepseek-ai/dsh-bot-ask/session
 */

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    /**
     * This session asked a teammate a question and received an answer. Recorded
     * on the asking side once the answer is in, so the log holds what reached
     * the model rather than an attempt that never answered.
     */
    'bot/asked': {
      /** The teammate's stable identity. */
      teammate: string
      /** The name it speaks under. */
      displayName: string
      /** What it was asked, verbatim. */
      question: string
      /** What it answered, verbatim. */
      answer: string
    }
    /**
     * This session exists because a teammate asked its bot a question.
     * Recorded before the turn runs, so a session that failed to answer still
     * says who asked it what.
     */
    'bot/answered': {
      /** The asking bot's stable identity. */
      asker: string
      /** The name it speaks under. */
      displayName: string
      /** What it asked, verbatim. */
      question: string
    }
  }
}

/** The event types this package records, for a composition that lists them. */
export const BOT_ASK_EVENTS = ['bot/asked', 'bot/answered'] as const
