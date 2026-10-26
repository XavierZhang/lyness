/**
 * One bot asking a teammate a question.
 *
 * The whole point is what an ask is NOT. It is not a read: the asking bot
 * never reaches the asked bot's conversations, cannot list them, and cannot
 * learn that a particular one exists. The asked bot answers in a conversation
 * of its own, under its own character and its own preset, and decides what to
 * say; what comes back is prose composed for the question.
 *
 * That is the only safe reading. The asked bot's conversations belong to the
 * people who opened them, and session visibility refuses those people's own
 * colleagues — a bot that could read them would be a way around a rule the
 * product enforces everywhere else.
 *
 * @module @lyness/lyn-bot-ask
 */

import { Service } from '@lyness/cordis'
import type { Context } from '@lyness/cordis'
import type { Agent } from '@lyness/lyn-agent'
import { brandString } from '@lyness/lyn-brand'
import type { PersonId } from '@lyness/lyn-people'
import type {} from '@lyness/lyn-session-projection'
import type { TeammateView } from '@lyness/lyn-managed-bots'
import type {} from '@lyness/lyn-managed-bots/session'
import { runBotTurn } from './turn.ts'
import type {} from './session.ts'

export { BOT_ASK_EVENTS } from './session.ts'

declare module '@lyness/cordis' {
  interface Context {
    /** One bot asking a teammate; absent where a deployment maintains no bots. */
    botAsk: BotAsk
  }
}

/** Message an ask from a session that speaks as nobody is refused with. */
export const NOT_A_BOT = 'bot-ask: only a bot asks a teammate'

/** Message an ask naming somebody who is not a teammate is refused with. */
export const NOT_A_TEAMMATE = 'bot-ask: that bot is not in a team with yours'

/** Message an ask whose answering turn did not complete is refused with. */
export const NO_ANSWER = 'bot-ask: the teammate did not answer'

/**
 * Why one ask was refused.
 *
 * A closed set rather than a message to read: a tool reporting it tells the
 * model which of three different things happened, and matching prose would
 * break the moment the prose changed.
 */
export type AskRefusal = 'not-a-bot' | 'not-a-teammate' | 'no-answer'

/** An ask this service refused, carrying the reason it refused. */
export class AskRefusedError extends Error {
  /** Which rule refused it. */
  readonly reason: AskRefusal

  /**
   * @param reason - which rule refused it.
   * @param message - what went wrong, in words the asking model can act on.
   */
  constructor(reason: AskRefusal, message: string) {
    super(message)
    this.name = 'AskRefusedError'
    this.reason = reason
  }
}

/** What one ask answered. */
export interface Answer {
  /** The teammate that answered. */
  readonly teammate: PersonId
  /** The name it speaks under. */
  readonly displayName: string
  /** The prose it composed for this question. */
  readonly text: string
}

/** One bot asking a teammate a question. */
export class BotAsk extends Service {
  static inject = ['agentPresets', 'agents', 'agentDefaultModel', 'managedBots', 'sessionProjections', 'sessions']

  /**
   * @param ctx - context carrying the roster, the agent registry and the session store.
   */
  constructor(ctx: Context) {
    super(ctx, 'botAsk')
  }

  /**
   * Ask one teammate a question, and answer with what it said.
   *
   * The asking agent's own session decides who is asking: a session that
   * speaks as nobody has no teammates, so a person's own conversation cannot
   * reach another bot this way.
   * @param asker - the agent asking, whose session names the asking bot.
   * @param teammate - the bot to ask.
   * @param question - what to ask it, sent verbatim as the answering turn's user message.
   * @param signal - cancellation from the asking turn.
   * @returns what the teammate answered.
   * @throws {AskRefusedError} when the asking session speaks as no bot, the
   * target is not a teammate, or the answering turn did not complete.
   */
  async ask(asker: Agent, teammate: PersonId, question: string, signal: AbortSignal): Promise<Answer> {
    const me = this.ctx.sessionProjections.stateOf(asker.session, 'bot')
    if (me === null || me === undefined) throw new AskRefusedError('not-a-bot', NOT_A_BOT)
    const mine = brandString<PersonId>(me.bot)

    // Team membership is the whole authorization: two bots that share only an
    // organization are not teammates, and the catalog this reads is the one an
    // administrator wrote.
    const teammates = await this.ctx.managedBots.teammates(mine)
    const target = teammates.find(candidate => candidate.id === teammate)
    if (target === undefined) throw new AskRefusedError('not-a-teammate', NOT_A_TEAMMATE)

    // The catalog entry carries everything the answering turn runs with, so
    // there is no second read of the roster to disagree with it.
    const answer = await this.answerTurn(asker, me.displayName, mine, question, target, signal)
    asker.session.append('bot/asked', {
      teammate: target.id,
      displayName: target.displayName,
      question,
      answer: answer.text,
    })
    return answer
  }

  /**
   * Run the answering turn in a conversation of the teammate's own.
   *
   * Its own session rather than a child of the asker's: a child would be as
   * privileged as its parent and would answer under the asker's character,
   * which is neither bot's.
   */
  private async answerTurn(
    asker: Agent,
    askerName: string,
    askerId: PersonId,
    question: string,
    target: TeammateView,
    signal: AbortSignal,
  ): Promise<Answer> {
    const { text } = await runBotTurn(this.ctx, {
      engaged: { bot: target.id, displayName: target.displayName, persona: target.persona },
      preset: target.preset,
      // The asker's own directory: two bots a team puts together share the
      // work the asker is doing, and an answering turn with no directory has
      // nothing its file tools could read.
      cwd: askerDirectory(asker),
      prompt: question,
      // Recorded before the turn, so a session that failed to answer still
      // says who asked it what.
      before: (session) => {
        session.append('bot/answered', { asker: askerId, displayName: askerName, question })
      },
      signal,
    })
    if (text === undefined) throw new AskRefusedError('no-answer', NO_ANSWER)
    return { teammate: target.id, displayName: target.displayName, text }
  }
}

/**
 * The directory the answering turn runs in.
 *
 * The asking session's own. A session header records an absolute path or
 * nothing, and every agent this service can be asked from was created with
 * one, so the absence is a broken caller rather than a case to default.
 * @param asker - the agent asking.
 * @returns its session's directory.
 */
function askerDirectory(asker: Agent): string {
  const cwd = asker.session.header.cwd
  /* v8 ignore next -- an Agent is created with a directory; this names the broken caller rather than inventing one. */
  if (cwd === undefined) throw new Error('bot-ask: the asking session records no directory')
  return cwd
}

export default BotAsk
