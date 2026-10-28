/**
 * What the two teammate tools hand the model: the catalog a bot picks from,
 * an empty one for a conversation that speaks as nobody, and the answer an
 * ask returns. The authorization itself is pinned against the service in
 * `bot-ask.spec.ts`; these tools add none of their own.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@lyness/cordis'
import { brandString } from '@lyness/lyn-brand'
import { ToolCallId } from '@lyness/lyn-llm'
import type { PersonId } from '@lyness/lyn-people'
import AgentRegistry from '@lyness/lyn-agent'
import AgentLoop from '@lyness/lyn-agent-loop'
import LlmRuntime from '@lyness/lyn-llm'
import SessionStore, { SessionId } from '@lyness/lyn-session'
import SessionProjectionRegistry from '@lyness/lyn-session-projection'
import SystemPrompt from '@lyness/lyn-system-prompt'
import ToolRuntime from '@lyness/lyn-tools'
import type { ToolBatchResult } from '@lyness/lyn-tools'
import type { Agent } from '@lyness/lyn-agent'
import { botProjectionDefinition } from '@lyness/lyn-managed-bots'
import type { EngagedBot, TeammateView } from '@lyness/lyn-managed-bots'
import * as BotAskTools from '../src/tool.ts'
import { AnsweringAdapter, ANSWERING_PROVIDER } from './answering-adapter.ts'

const SIGNAL = new AbortController().signal
const live: Context[] = []
afterEach(async () => { for (const ctx of live.splice(0)) await ctx.fiber.dispose() })

const SCRIBE: TeammateView = {
  id: brandString<PersonId>('scribe'),
  displayName: 'Scribe',
  job: 'Keeps the record of a discussion.',
  persona: 'You write minutes.',
  preset: 'standard',
}

/** The tools mounted over doubles for the roster and the ask service. */
async function bench(asked: { answer?: string } = {}): Promise<{
  ctx: Context
  asks: { teammate: string; question: string }[]
  discussions: { participants: readonly string[]; question: string; rounds: number }[]
}> {
  const ctx = new Context()
  live.push(ctx)
  await ctx.plugin(LlmRuntime)
  await ctx.plugin(SystemPrompt, {})
  await ctx.plugin(ToolRuntime, {})
  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(AgentLoop, { agents: [] })
  ctx.llm.registerAdapter([ANSWERING_PROVIDER], new AnsweringAdapter())
  ctx.sessionProjections.register(botProjectionDefinition)
  const asks: { teammate: string; question: string }[] = []
  ctx.provide('managedBots', { teammates: () => Promise.resolve([SCRIBE]) } as never)
  const discussions: { participants: readonly string[]; question: string; rounds: number }[] = []
  ctx.provide('botRoom', {
    hold: (_opener: Agent, request: { participants: readonly string[]; question: string; rounds: number }) => {
      discussions.push(request)
      return Promise.resolve({
        sessionId: 'room',
        remarks: [{ bot: 'scribe', displayName: 'Scribe', text: 'Minutes are filed.' }],
        conclusion: 'Ship it on Friday.',
      })
    },
  } as never)
  ctx.provide('botAsk', {
    ask: (_asker: Agent, teammate: PersonId, question: string) => {
      asks.push({ teammate, question })
      return Promise.resolve({ teammate, displayName: 'Scribe', text: asked.answer ?? 'Minutes are filed.' })
    },
  } as never)
  await ctx.plugin(BotAskTools).await()
  return { ctx, asks, discussions }
}

/** One production agent whose session speaks as that bot, or as nobody. */
async function agent(ctx: Context, id: string, engaged: EngagedBot | undefined): Promise<Agent> {
  const made = await ctx.agentLoop.create(
    SessionId(id),
    { provider: ANSWERING_PROVIDER, model: 'scripted' },
    { cwd: '/w' },
  )
  if (engaged !== undefined) made.session.append('bot/engaged', { ...engaged })
  return made
}

let calls = 0
/** Run one tool the way the loop runs it. */
function call(ctx: Context, name: string, args: unknown, agentOrNone: Agent | undefined) {
  return ctx.tools.execute({
    signal: SIGNAL,
    calls: [{
      type: 'tool-call' as const,
      id: ToolCallId(`call-${String(++calls)}`),
      name,
      arguments: JSON.stringify(args),
    }],
    ...agentOrNone === undefined ? {} : { agent: agentOrNone },
  })
}

/** The text the batch's one tool result carries. */
function text(batch: ToolBatchResult): string {
  const blocks = batch.results[0]?.result.content ?? []
  return blocks.filter(block => block.type === 'text').map(block => block.type === 'text' ? block.text : '').join('')
}

describe('list_teammates', () => {
  it('names each teammate and what it is for', async () => {
    const { ctx } = await bench()
    const bot = await agent(ctx, 'mine', { bot: 'triage', displayName: 'Triage', persona: '' })
    expect(text(await call(ctx, 'list_teammates', {}, bot)))
      .toBe('Scribe (scribe) — Keeps the record of a discussion.')
  })

  it('answers nobody for a conversation that speaks as no bot', async () => {
    const { ctx } = await bench()
    const person = await agent(ctx, 'person', undefined)
    // Answering an empty list says so without naming anybody's bots.
    expect(text(await call(ctx, 'list_teammates', {}, person)))
      .toBe('you are in no team, so there is nobody to ask')
  })

  it('requires a calling agent', async () => {
    const { ctx } = await bench()
    expect(text(await call(ctx, 'list_teammates', {}, undefined))).toContain('requires a calling agent')
  })
})

describe('ask_teammate', () => {
  it('hands the question to the service and renders what came back', async () => {
    const { ctx, asks } = await bench()
    const bot = await agent(ctx, 'mine', { bot: 'triage', displayName: 'Triage', persona: '' })
    const result = await call(ctx, 'ask_teammate', { teammate: 'scribe', question: 'What did we decide?' }, bot)

    expect(asks).toEqual([{ teammate: 'scribe', question: 'What did we decide?' }])
    expect(text(result)).toBe('Scribe answered:\n\nMinutes are filed.')
  })

  it('requires a calling agent', async () => {
    const { ctx } = await bench()
    expect(text(await call(ctx, 'ask_teammate', { teammate: 'scribe', question: 'Anything?' }, undefined)))
      .toContain('requires a calling agent')
  })
})

describe('hold_discussion', () => {
  it('hands the room to the service and renders every remark before the conclusion', async () => {
    const { ctx, discussions } = await bench()
    const bot = await agent(ctx, 'mine', { bot: 'triage', displayName: 'Triage', persona: '' })
    const result = await call(
      ctx,
      'hold_discussion',
      { participants: ['scribe'], question: 'Ship it?', rounds: 2 },
      bot,
    )

    expect(discussions).toEqual([{ participants: ['scribe'], question: 'Ship it?', rounds: 2 }])
    expect(text(result)).toBe('Scribe: Minutes are filed.\n\nConclusion:\n\nShip it on Friday.')
  })

  it('requires a calling agent', async () => {
    const { ctx } = await bench()
    expect(text(await call(ctx, 'hold_discussion', { participants: [], question: 'Ship it?', rounds: 1 }, undefined)))
      .toContain('requires a calling agent')
  })
})
