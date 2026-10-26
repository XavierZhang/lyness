/**
 * The model-facing `ask_teammate` and `list_teammates` tools: thin adapters
 * over `ctx.botAsk.ask()` and the roster's teammate catalog.
 *
 * They add no authority of their own. Which bots are teammates is the
 * relation an administrator wrote, and what an ask may reach is the service's
 * decision — a tool that re-derived either would be a second rule to keep in
 * step with the first.
 *
 * @module @lyness/lyn-bot-ask/tool
 */

import type { Context } from '@lyness/cordis'
import { brandString } from '@lyness/lyn-brand'
import type { PersonId } from '@lyness/lyn-people'
import { defineTool } from '@lyness/lyn-tools'
import type {} from '@lyness/lyn-managed-bots'
import type {} from '@lyness/lyn-session-projection'
import type {} from './index.ts'

export const name = 'bot-ask-tools'
export const inject = ['tools', 'botAsk', 'managedBots', 'sessionProjections']

/**
 * Register the two teammate tools.
 * @param ctx - context carrying the tool registry, the ask service and the roster.
 */
export function apply(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'list_teammates',
    description:
      'List the bots you may ask. Each entry says what that bot is for and how it answers, '
      + 'so you can pick the one whose job covers your question. '
      + 'You cannot see any of their conversations.',
    parameters: {},
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          teammates: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string', required: true },
                name: { type: 'string', required: true },
                job: { type: 'string', required: true },
              },
            },
          },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: value.teammates.length === 0
          ? 'you are in no team, so there is nobody to ask'
          : value.teammates.map(one => `${one.name} (${one.id}) — ${one.job}`).join('\n'),
      }],
    },
    async execute(_args, exec) {
      const caller = exec.agent
      if (!caller) throw new Error('list_teammates requires a calling agent (exec.agent was undefined)')
      const me = ctx.sessionProjections.stateOf(caller.session, 'bot')
      // A conversation a person opened speaks as nobody and has no teammates;
      // answering an empty list says so without naming anybody's bots.
      if (me === null || me === undefined) return { teammates: [] }
      const teammates = await ctx.managedBots.teammates(brandString<PersonId>(me.bot))
      return { teammates: teammates.map(one => ({ id: one.id, name: one.displayName, job: one.job })) }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'ask_teammate',
    description:
      'Ask one of your teammates a question and wait for its answer. It answers in a conversation of its own, '
      + 'with its own character and tools, and decides what to tell you. '
      + 'You receive prose written for your question — never its conversations. '
      + 'Both sides record the question and the answer.',
    parameters: {
      teammate: {
        type: 'string',
        required: true,
        description: 'The id of a bot from list_teammates.',
      },
      question: {
        type: 'string',
        required: true,
        description: 'What to ask it. Include whatever context it needs: it cannot see your conversation.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string', required: true },
          answer: { type: 'string', required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: `${value.name} answered:\n\n${value.answer}` }],
    },
    async execute(args, exec) {
      const caller = exec.agent
      if (!caller) throw new Error('ask_teammate requires a calling agent (exec.agent was undefined)')
      const answer = await ctx.botAsk.ask(caller, brandString<PersonId>(args.teammate), args.question, exec.signal)
      return { name: answer.displayName, answer: answer.text }
    },
  }))
}
