/**
 * What a room's own log records.
 *
 * The room is an ordinary session, so the discussion is readable the way
 * every other conversation is: who was invited, what each of them said in
 * which round, and the conclusion the chair wrote when the bound ended it.
 *
 * @module @lyness/lyn-bot-ask/room-session
 */

declare module '@lyness/lyn-session/types' {
  interface SessionEventMap {
    /** A discussion was opened, naming what it is about and who is in it. */
    'room/opened': {
      /** What the participants are discussing. */
      question: string
      /** How many times each of them speaks. */
      rounds: number
      /** Everyone in the room, in speaking order. */
      participants: { bot: string; displayName: string }[]
    }
    /** One participant said one thing. */
    'room/said': {
      /** The bot that said it. */
      bot: string
      /** The name it speaks under. */
      displayName: string
      /** What it said, verbatim. */
      text: string
      /** Which round it was, counting from one. */
      round: number
    }
    /** The discussion ended and the chair wrote its result. */
    'room/concluded': {
      /** The named result, as the chair stated it. */
      conclusion: string
      /** How many remarks it was written from. */
      remarks: number
    }
  }
}

/** The event types a room records, for a composition that lists them. */
export const BOT_ROOM_EVENTS = ['room/opened', 'room/said', 'room/concluded'] as const
