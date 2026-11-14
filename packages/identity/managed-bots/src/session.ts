/**
 * The session-log record of which bot is speaking, and the prompt section it
 * speaks through.
 *
 * The character reaches the model, so by the repo's model-visible ⟺ logged
 * rule it has to be reconstructable from the log alone. It is written into
 * the event rather than looked up again on resume, and that is the whole
 * point: an administrator who rewrites a bot's character changes what it
 * says next, and must not change what it already said. A resumed session
 * rebuilds the prompt it actually ran with.
 *
 * @module @deepseek-ai/dsh-managed-bots/session
 */

import type { Context } from '@deepseek-ai/cordis'
import { z } from 'zod'
import type { ProjectionDefinition } from '@deepseek-ai/dsh-session-projection'
import type {} from '@deepseek-ai/dsh-system-prompt'

/** The bot one session speaks as, as its log records it. */
export interface EngagedBot {
  /** The bot's stable identity, which the session is attributed to. */
  readonly bot: string
  /** The name it speaks under. */
  readonly displayName: string
  /** The character it was given, verbatim, as it reached the model. */
  readonly persona: string
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionStateMap {
    bot: EngagedBot | null
  }
  interface SessionProjectionMap {
    /** The bot this session speaks as, or null when a person opened it themselves. */
    bot: EngagedBot | null
  }
}

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    /**
     * This session speaks as one bot, with the character it carried when the
     * session opened. Log-only: it records the prompt section later turns ran
     * under, so a resumed session rebuilds the one it used rather than
     * whatever the roster holds now.
     */
    'bot/engaged': { bot: string; displayName: string; persona: string }
  }
}

const engagedSchema = z.union([
  z.object({ bot: z.string(), displayName: z.string(), persona: z.string() }).strict(),
  z.null(),
])

/** The bot a session speaks as, from the event that engaged it. */
export const botProjectionDefinition = {
  key: 'bot',
  stateSchema: engagedSchema,
  // No header field: a session speaks as a bot because one was named when it
  // was created, and that is an event rather than a creation fact the header
  // would have to grow a column for.
  init: () => null,
  apply: (state, event) => event.type === 'bot/engaged' ? event.data : state,
  wire: { viewSchema: engagedSchema, view: state => state },
  stateVersion: 1,
} satisfies ProjectionDefinition<'bot', EngagedBot | null>

/** Name of the prompt section one bot's character is registered under. */
export const BOT_PERSONA_SECTION = 'bot:persona'

/**
 * Put one bot's character into an agent's prompt.
 *
 * A section of its own rather than the deployment persona row, because the
 * preset the bot runs with may already carry one: the preset says how this
 * agent works, and the bot says who is speaking. Appending cannot widen what
 * the agent may do, which is what keeps a character written by a tenant
 * administrator from reaching past the permission preset.
 * @param agentCtx - the agent scope the bot runs in, after its preset mounted.
 * @param engaged - the bot and the character its log records.
 * @returns the disposer that withdraws the section.
 */
export function composeBotPersona(agentCtx: Context, engaged: EngagedBot): () => void {
  const text = engaged.persona === ''
    ? `You are ${engaged.displayName}.`
    : `You are ${engaged.displayName}.\n\n${engaged.persona}`
  return agentCtx.systemPrompt.section({
    name: BOT_PERSONA_SECTION,
    order: agentCtx.systemPrompt.getSectionOrder('BOT_PERSONA'),
    text,
  })
}
