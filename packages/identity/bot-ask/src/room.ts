/**
 * Several bots discussing one question, with a chair that is code.
 *
 * Three things make this a room rather than a group of agents running at
 * once. A **chair** decides who speaks next and when the discussion ends; it
 * is a deployment rule rather than a participant's own judgement, because a
 * participant that chose its own turn would be one nobody could stop. A
 * **bound** ends it whatever the chair thinks. And a **conclusion** is
 * written when it ends, because a named result is what the opener asked for.
 *
 * The chair here is round-robin, which is the rule a deployment can predict:
 * every participant speaks once per round, in the order the opener named
 * them, for as many rounds as the bound allows. A smarter chair can replace
 * it; a room with no bound could not be made safe later.
 *
 * Each participant speaks in a session of its own, under its own character
 * and preset, and reads the discussion so far. That is not a hole in the rule
 * that an ask is not a read: the transcript it reads is the room it was
 * invited to, and nothing of any other conversation reaches it.
 *
 * @module @lyness/lyn-bot-ask/room
 */

import { Service } from '@lyness/cordis'
import type { Context } from '@lyness/cordis'
import type { Agent } from '@lyness/lyn-agent'
import { brandString } from '@lyness/lyn-brand'
import { BlockAssembler, createSystemMessage, createUserMessage } from '@lyness/lyn-llm'
import type { PersonId } from '@lyness/lyn-people'
import type { Session, SessionId } from '@lyness/lyn-session'
import type { TeammateView } from '@lyness/lyn-managed-bots'
import type {} from '@lyness/lyn-managed-bots'
import type {} from '@lyness/lyn-session-projection'
import { randomUUID } from '@lyness/lyn-util-crypto'
import { runBotTurn } from './turn.ts'
import type {} from './room-session.ts'

export { BOT_ROOM_EVENTS } from './room-session.ts'

declare module '@lyness/cordis' {
  interface Context {
    /** Several bots discussing one question; absent where a deployment maintains no bots. */
    botRoom: BotRoom
  }
}

/** Message a discussion opened by a session that speaks as no bot is refused with. */
export const NOT_A_BOT = 'bot-room: only a bot opens a discussion'

/** Message a discussion naming somebody who is not a teammate is refused with. */
export const NOT_A_TEAMMATE = 'bot-room: every participant has to be in a team with yours'

/** Message a discussion naming nobody else is refused with. */
export const NOBODY_TO_DISCUSS_WITH = 'bot-room: a discussion needs at least two participants'

/**
 * Why one discussion was refused.
 *
 * A closed set rather than a message to read: the tool reporting it tells the
 * model which of three different things happened.
 */
export type RoomRefusal = 'not-a-bot' | 'not-a-teammate' | 'nobody'

/** A discussion this service refused, carrying the reason it refused. */
export class RoomRefusedError extends Error {
  /** Which rule refused it. */
  readonly reason: RoomRefusal

  /**
   * @param reason - which rule refused it.
   * @param message - what went wrong, in words the opening model can act on.
   */
  constructor(reason: RoomRefusal, message: string) {
    super(message)
    this.name = 'RoomRefusedError'
    this.reason = reason
  }
}

/** The largest number of rounds a deployment will chair. */
export const MAX_ROUNDS = 5

/** What one discussion is held about. */
export interface RoomRequest {
  /** The teammates to invite, by id; the opener joins as the first speaker. */
  readonly participants: readonly PersonId[]
  /** What they are discussing, sent to each participant with the transcript so far. */
  readonly question: string
  /** How many times each participant speaks; clamped to {@link MAX_ROUNDS}. */
  readonly rounds: number
}

/** One thing said in a room. */
export interface RoomRemark {
  /** The bot that said it. */
  readonly bot: PersonId
  /** The name it speaks under. */
  readonly displayName: string
  /** What it said. */
  readonly text: string
}

/** What one discussion produced. */
export interface RoomResult {
  /** The session holding the discussion. */
  readonly sessionId: SessionId
  /** Everything said, in order. */
  readonly remarks: readonly RoomRemark[]
  /** The named result the chair wrote when it ended. */
  readonly conclusion: string
}

/** The system prompt the chair's own summarising request carries. */
const CHAIR_PROMPT = 'You are the chair of a discussion that has just ended. '
  + 'State its conclusion in a few sentences: what was agreed, what remains open, and what should happen next. '
  + 'Report only what the participants said. Do not add a position of your own.'

/** Several bots discussing one question. */
export class BotRoom extends Service {
  static inject = [
    'agentPresets', 'agents', 'agentDefaultModel', 'llm', 'managedBots', 'sessionProjections', 'sessions',
  ]

  /**
   * @param ctx - context carrying the roster, the agent registry and the session store.
   */
  constructor(ctx: Context) {
    super(ctx, 'botRoom')
  }

  /**
   * Hold one discussion and answer with what was said and concluded.
   * @param opener - the agent opening it, whose session names the opening bot.
   * @param request - who to invite, what to discuss, and for how many rounds.
   * @param signal - cancellation from the opening turn.
   * @returns the room session, every remark, and the chair's conclusion.
   * @throws {RoomRefusedError} when the opening session speaks as no bot, a
   * participant is not a teammate, or nobody else was named.
   */
  async hold(opener: Agent, request: RoomRequest, signal: AbortSignal): Promise<RoomResult> {
    // The roster owns the projection and answers for it.
    const me = this.ctx.managedBots.botOf(opener.session)
    if (me === undefined) throw new RoomRefusedError('not-a-bot', NOT_A_BOT)
    const mine = brandString<PersonId>(me.bot)
    if (request.participants.length === 0) {
      throw new RoomRefusedError('nobody', NOBODY_TO_DISCUSS_WITH)
    }

    // Team membership is the whole authorization, as it is for an ask: the
    // opener may invite the colleagues an administrator put it with.
    const teammates = await this.ctx.managedBots.teammates(mine)
    const invited: TeammateView[] = []
    for (const participant of request.participants) {
      const found = teammates.find(candidate => candidate.id === participant)
      if (found === undefined) throw new RoomRefusedError('not-a-teammate', NOT_A_TEAMMATE)
      invited.push(found)
    }

    const cwd = openerDirectory(opener)
    const room = this.ctx.sessions.create(
      brandString<SessionId>(`session-${randomUUID()}`),
      { meta: { cwd } },
    )
    const speakers: TeammateView[] = [
      { id: mine, displayName: me.displayName, job: '', persona: me.persona, preset: presetOf(opener) },
      ...invited,
    ]
    room.append('room/opened', {
      question: request.question,
      rounds: rounds(request.rounds),
      participants: speakers.map(speaker => ({ bot: speaker.id, displayName: speaker.displayName })),
    })

    const remarks: RoomRemark[] = []
    for (let round = 0; round < rounds(request.rounds); round += 1) {
      for (const speaker of speakers) {
        signal.throwIfAborted()
        const { text } = await runBotTurn(this.ctx, {
          engaged: { bot: speaker.id, displayName: speaker.displayName, persona: speaker.persona },
          preset: speaker.preset,
          cwd,
          prompt: briefing(request.question, remarks, speaker.displayName),
          signal,
        })
        // A participant that said nothing this round simply did not speak;
        // the discussion is not the place to refuse it.
        if (text === undefined) continue
        const remark: RoomRemark = { bot: speaker.id, displayName: speaker.displayName, text }
        remarks.push(remark)
        room.append('room/said', { ...remark, round: round + 1 })
      }
    }

    const conclusion = await this.conclude(request.question, remarks, signal)
    room.append('room/concluded', { conclusion, remarks: remarks.length })
    await this.ctx.sessions.flush(room)
    return { sessionId: room.id, remarks, conclusion }
  }

  /**
   * Write the conclusion from what was said.
   *
   * The chair's own request, under a fixed prompt rather than any
   * participant's character: a conclusion written in one bot's voice would be
   * that bot's position, which is the one thing a chair must not add.
   */
  private async conclude(question: string, remarks: readonly RoomRemark[], signal: AbortSignal): Promise<string> {
    if (remarks.length === 0) return 'Nobody said anything, so there is no conclusion.'
    const selection = this.ctx.agentDefaultModel.currentSelection()
    const assembler = new BlockAssembler()
    const stream = this.ctx.llm.stream({
      provider: selection.provider,
      model: selection.model,
      signal,
      messages: [
        createSystemMessage(CHAIR_PROMPT),
        createUserMessage({
          source: { kind: 'user' },
          content: [{ type: 'text', text: briefing(question, remarks) }],
        }),
      ],
    })
    for await (const chunk of stream) assembler.push(chunk)
    const text = assembler.blocks()
      .flatMap(block => block.type === 'text' ? [block.text] : [])
      .join('')
    // A chair whose own request produced nothing still ends the room: the
    // remarks are the record, and a missing summary is not a reason to lose
    // them.
    return text === '' ? 'The discussion ended without a stated conclusion.' : text
  }
}

/**
 * The rounds one discussion runs for.
 *
 * Clamped rather than validated, because the bound is the deployment's and
 * not the model's: a request for more rounds than a deployment chairs is a
 * shorter discussion, not a refusal.
 * @param requested - the rounds the opener asked for.
 * @returns at least one round and at most {@link MAX_ROUNDS}.
 */
export function rounds(requested: number): number {
  if (!Number.isFinite(requested)) return 1
  return Math.min(MAX_ROUNDS, Math.max(1, Math.trunc(requested)))
}

/**
 * What one participant is sent: the question, what was said so far, and whose
 * turn it is.
 * @param question - what the room is discussing.
 * @param remarks - everything said so far, in order.
 * @param speaking - the name whose turn it is; absent addresses the chair.
 * @returns the prompt text.
 */
export function briefing(
  question: string,
  remarks: readonly RoomRemark[],
  speaking?: string,
): string {
  const said = remarks.length === 0
    ? 'Nobody has spoken yet.'
    : remarks.map(remark => `${remark.displayName}: ${remark.text}`).join('\n\n')
  const asked = speaking === undefined
    ? 'Write the conclusion.'
    : `You are ${speaking}. Say what you have to add. Be brief, and do not repeat what somebody already said.`
  return `The discussion is about:\n\n${question}\n\nSaid so far:\n\n${said}\n\n${asked}`
}

/**
 * The directory the discussion runs in.
 *
 * The opening session's own, for the reason an ask uses the asker's: the
 * participants share the work the opener is doing.
 * @param opener - the agent opening the discussion.
 * @returns its session's directory.
 */
function openerDirectory(opener: Agent): string {
  const cwd = opener.session.header.cwd
  /* v8 ignore next -- an Agent is created with a directory; this names the broken caller rather than inventing one. */
  if (cwd === undefined) throw new Error('bot-room: the opening session records no directory')
  return cwd
}

/**
 * The preset the opening bot is running, so it speaks in the room as itself.
 *
 * Read from the session's own projection rather than from the roster, for the
 * same reason its character is: an administrator who changed the preset since
 * did not change what this conversation runs under.
 */
function presetOf(opener: Agent): string {
  const header: Session['header'] = opener.session.header
  /* v8 ignore next -- a session that speaks as a bot was created with that bot's preset. */
  return header.agentPreset ?? ''
}

export default BotRoom
