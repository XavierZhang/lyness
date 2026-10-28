/**
 * The model-facing `ask_teammate` and `list_teammates` tools: thin adapters
 * over `ctx.botAsk.ask()` and the roster's teammate catalog.
 *
 * They add no authority of their own. Which bots are teammates is the
 * relation an administrator wrote, and what an ask may reach is the service's
 * decision — a tool that re-derived either would be a second rule to keep in
 * step with the first.
 *
 * @module @deepseek-ai/dsh-bot-ask/tool
 */

import type { Context } from '@deepseek-ai/cordis'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { PersonId } from '@deepseek-ai/dsh-people'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-managed-bots'
import type {} from '@deepseek-ai/dsh-session-projection'
import type {} from './index.ts'
import { MAX_ROUNDS } from './room.ts'
import type {} from './room.ts'

export const name = 'bot-ask-tools'
export const inject = ['tools', 'botAsk', 'botRoom', 'managedBots', 'sessionProjections']

/**
 * Register the three teammate tools.
 * @param ctx - context carrying the tool registry, the two services and the roster.
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

  ctx.tools.register(defineTool({
    name: 'hold_discussion',
    description:
      'Discuss one question with several teammates at once and wait for the conclusion. '
      + 'Everyone speaks in turn, once per round, reading what was said before them; you speak first each round. '
      + `A deployment chairs at most ${String(MAX_ROUNDS)} rounds, and asking for more simply runs fewer. `
      + 'The conclusion is written by the chair from what was said, not by any participant. '
      + 'Use this when one answer is not enough because the teammates would disagree; use ask_teammate otherwise.',
    parameters: {
      participants: {
        type: 'array',
        required: true,
        items: { type: 'string' },
        description: 'The ids of teammates from list_teammates. You are added as the first speaker.',
      },
      question: {
        type: 'string',
        required: true,
        description: 'What to discuss. Include whatever context it needs: nobody can see your conversation.',
      },
      rounds: {
        type: 'number',
        required: true,
        description: `How many times each participant speaks, from 1 to ${String(MAX_ROUNDS)}.`,
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          conclusion: { type: 'string', required: true },
          remarks: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                name: { type: 'string', required: true },
                said: { type: 'string', required: true },
              },
            },
          },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: `${value.remarks.map(one => `${one.name}: ${one.said}`).join('\n\n')}\n\nConclusion:\n\n${value.conclusion}`,
      }],
    },
    async execute(args, exec) {
      const caller = exec.agent
      if (!caller) throw new Error('hold_discussion requires a calling agent (exec.agent was undefined)')
      const held = await ctx.botRoom.hold(
        caller,
        {
          participants: args.participants.map(one => brandString<PersonId>(one)),
          question: args.question,
          rounds: args.rounds,
        },
        exec.signal,
      )
      return {
        conclusion: held.conclusion,
        remarks: held.remarks.map(one => ({ name: one.displayName, said: one.text })),
      }
    },
  }))
}
