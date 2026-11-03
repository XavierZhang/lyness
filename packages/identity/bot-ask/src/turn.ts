/**
 * One turn run as one bot, in a conversation of that bot's own.
 *
 * Shared by the two things a bot does with a teammate — asking it a question
 * and discussing one with several of them — because both need the same thing
 * and neither may have it cheaply: a session that carries the teammate's
 * preset, the teammate's character and the teammate's name, rather than a
 * child of the caller's that would answer under the caller's.
 *
 * The engagement is an argument rather than something this reads, so the
 * authorization stays where it belongs: whoever obtained the engagement was
 * judged for it, and this function grants nothing on its own.
 *
 * @module @deepseek-ai/dsh-bot-ask/turn
 */

import type { Context } from '@deepseek-ai/cordis'
import { brandString } from '@deepseek-ai/dsh-brand'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { Session, SessionId } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-agent-default-model'
import type {} from '@deepseek-ai/dsh-agent-preset-registry'
import type {} from '@deepseek-ai/dsh-managed-bots'
import type { EngagedBot } from '@deepseek-ai/dsh-managed-bots/session'
import { randomUUID } from '@deepseek-ai/dsh-util-crypto'

/** What one bot runs with for one turn. */
export interface BotTurnRequest {
  /** The bot and the character to record, as the roster answered it. */
  readonly engaged: EngagedBot
  /** The preset whose tools, prompt sections and skills it runs with. */
  readonly preset: string
  /** The directory the turn runs in; a session header takes an absolute path. */
  readonly cwd: string
  /** What to send as the turn's user message. */
  readonly prompt: string
  /** Records written into the bot's own session before its turn runs. */
  readonly before?: (session: Session) => void
  /** Cancellation from the calling turn. */
  readonly signal: AbortSignal
}

/** What one bot's turn produced. */
export interface BotTurnResult {
  /** The session the turn ran in. */
  readonly sessionId: SessionId
  /** Its final prose, or undefined when the turn produced none. */
  readonly text: string | undefined
}

/**
 * Run one turn as one bot and answer with what it said.
 *
 * The prose is collected from the events the turn commits rather than scanned
 * back out of the log: what the caller is told is what the turn produced, and
 * a historical read would make this depend on storage it does not need.
 * @param ctx - context carrying the agent registry, the preset registry and the roster.
 * @param request - the bot, its preset, where it runs, and what to send it.
 * @returns the session it ran in and its final prose.
 */
export async function runBotTurn(ctx: Context, request: BotTurnRequest): Promise<BotTurnResult> {
  const selection = ctx.agentDefaultModel.currentSelection()
  const roster = ctx.managedBots
  const sessionId = brandString<SessionId>(`session-${randomUUID()}`)
  const created = await ctx.agents.create({
    sessionId,
    agentOptions: { provider: selection.provider, model: selection.model },
    meta: { cwd: request.cwd, agentPreset: request.preset },
    setup: async (agentCtx) => {
      await ctx.agentPresets.mount(agentCtx, request.preset)
      agentCtx.effect(() => roster.compose(agentCtx, request.engaged))
    },
  })
  const { agent } = created
  try {
    await agent.whenIdle()
    // Recorded after creation rather than inside setup, because a session only
    // dispatches its events once it is published: a record written before that
    // reaches its own log and no observer.
    agent.session.append('bot/engaged', { ...request.engaged })
    request.before?.(agent.session)
    let text: string | undefined
    const collect = ctx.on('session/event', (session, event) => {
      if (session.id !== agent.session.id || event.type !== 'assistant/message') return
      const joined = event.data.message.content
        .flatMap(block => block.type === 'text' ? [block.text] : [])
        .join('')
      if (joined !== '') text = joined
    })
    try {
      agent.followup(createUserMessage({
        content: [{ type: 'text', text: request.prompt }],
        source: { kind: 'user' },
      }))
      await agent.whenIdle()
    } finally {
      collect()
    }
    request.signal.throwIfAborted()
    await ctx.sessions.flush(agent.session)
    return { sessionId, text }
  } finally {
    await created.dispose()
  }
}
