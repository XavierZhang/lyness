/**
 * What one bot asking a teammate does, and the three things it refuses.
 *
 * Driven against the production agent loop with a scripted model, so the
 * answering turn's session is written by the shipping code: the claim worth
 * pinning is that an ask is not a read — the answering turn runs in a session
 * of the teammate's own, with the teammate's character, and what comes back
 * is the prose that session recorded rather than its log.
 */

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@lyness/cordis'
import AgentRegistry from '@lyness/lyn-agent'
import type { Agent } from '@lyness/lyn-agent'
import AgentLoop from '@lyness/lyn-agent-loop'
import { brandString } from '@lyness/lyn-brand'
import LlmRuntime from '@lyness/lyn-llm'
import type { Membership, MembershipId, PersonId } from '@lyness/lyn-people'
import SessionStore, { SessionId } from '@lyness/lyn-session'
import type { Session } from '@lyness/lyn-session'
import SessionProjectionRegistry from '@lyness/lyn-session-projection'
import SystemPrompt from '@lyness/lyn-system-prompt'
import ToolRuntime from '@lyness/lyn-tools'
import Storage from '@lyness/lyn-storage'
import * as StorageJson from '@lyness/lyn-storage-json'
import * as StorageDomain from '@lyness/lyn-storage-domain'
import ManagedPeople from '@lyness/lyn-managed-people'
import ManagedBots, { botProjectionDefinition } from '@lyness/lyn-managed-bots'
import type { EngagedBot } from '@lyness/lyn-managed-bots/session'
import BotAsk, { AskRefusedError, NO_ANSWER, NOT_A_BOT, NOT_A_TEAMMATE } from '../src/index.ts'
import { AnsweringAdapter, ANSWERING_PROVIDER } from './answering-adapter.ts'

const live: Context[] = []
const roots: string[] = []

afterEach(async () => {
  for (const ctx of live.splice(0)) await ctx.fiber.dispose()
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true })
})

/** The standing one administrator acts in. */
const BY: Membership = {
  id: brandString<MembershipId>('ada:platform-administrator'),
  person: brandString<PersonId>('ada'),
  role: 'platform-administrator',
}

/** One event this deployment recorded, with the session that recorded it. */
interface Recorded {
  readonly session: SessionId
  readonly type: string
  readonly data: unknown
}

/** A deployment with a roster, a prompt, the production loop and a scripted model. */
async function bench(): Promise<{ ctx: Context; model: AnsweringAdapter; log: Recorded[] }> {
  const root = await mkdtemp(join(tmpdir(), 'lyn-bot-ask-'))
  roots.push(root)
  const ctx = new Context()
  live.push(ctx)
  await ctx.plugin(LlmRuntime)
  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(SystemPrompt, {})
  await ctx.plugin(ToolRuntime, {})
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(AgentLoop, { agents: [] })
  await ctx.plugin(Storage)
  await ctx.plugin(StorageJson, { root })
  await ctx.plugin(StorageDomain, { backend: 'json' })
  const model = new AnsweringAdapter()
  ctx.llm.registerAdapter([ANSWERING_PROVIDER], model)
  ctx.provide('agentPresets', {
    list: () => Promise.resolve([{ id: 'standard' }]),
    // The real registry mounts a plugin tree on the answering agent's scope;
    // what this service does with it is compose the teammate's own preset.
    mount: (_agentCtx: Context, id: string) => Promise.resolve({ id }),
  } as never)
  ctx.provide('agentDefaultModel', {
    currentSelection: () => ({ provider: ANSWERING_PROVIDER, model: 'scripted' }),
    saveSelection: () => Promise.resolve(),
  } as never)
  ctx.sessionProjections.register(botProjectionDefinition)
  // The answering session is flushed and released once its turn settles, so
  // what it recorded is read from the event stream rather than from the
  // in-memory table it has already left.
  const log: Recorded[] = []
  ctx.on('session/event', (session, event) => { log.push({ session: session.id, type: event.type, data: event.data }) })
  await ctx.plugin(ManagedPeople).await()
  await ctx.plugin(ManagedBots).await()
  await ctx.plugin(BotAsk).await()
  return { ctx, model, log }
}

/** One bot in that organization. */
async function bot(ctx: Context, displayName: string, persona = ''): Promise<PersonId> {
  const saved = await ctx.managedBots.save({
    displayName, organization: 'acme', persona, job: `What ${displayName} is for.`, preset: 'standard',
  }, BY)
  return brandString<PersonId>(saved.id)
}

/** A production agent whose session speaks as that bot, or as nobody. */
async function asking(ctx: Context, id: string, engaged: EngagedBot | undefined): Promise<Agent> {
  const agent = await ctx.agentLoop.create(
    SessionId(id),
    { provider: ANSWERING_PROVIDER, model: 'scripted' },
    { cwd: '/w' },
  )
  if (engaged !== undefined) agent.session.append('bot/engaged', { ...engaged })
  return agent
}

/** The events of one type that session recorded. */
function recorded(session: Session, type: string): unknown[] {
  return session.snapshotEvents().filter(event => event.type === type).map(event => event.data)
}

/** The events of one type the answering session recorded, in order. */
function theirs(log: readonly Recorded[], asker: Agent, type: string): unknown[] {
  return log.filter(entry => entry.session !== asker.session.id && entry.type === type).map(entry => entry.data)
}

/** One team holding both bots. */
async function team(ctx: Context, members: readonly PersonId[]): Promise<void> {
  await ctx.managedBots.saveTeam({ displayName: 'Intake', organization: 'acme', members: [...members] }, BY)
}

describe('asking a teammate', () => {
  it('answers from a session of the teammate\'s own, and records the exchange on both sides', async () => {
    const { ctx, model, log } = await bench()
    const triage = await bot(ctx, 'Triage')
    const scribe = await bot(ctx, 'Scribe', 'You write minutes.')
    await team(ctx, [triage, scribe])
    const asker = await asking(ctx, 'asker', { bot: triage, displayName: 'Triage', persona: '' })

    const answered = await ctx.botAsk.ask(
      asker, scribe, 'What is the capital of France?', new AbortController().signal,
    )

    expect(answered).toEqual({ teammate: scribe, displayName: 'Scribe', text: 'The capital is Paris.' })
    expect(recorded(asker.session, 'bot/asked')).toEqual([{
      teammate: scribe,
      displayName: 'Scribe',
      question: 'What is the capital of France?',
      answer: 'The capital is Paris.',
    }])

    // The answering side is a session of its own, speaking as the teammate,
    // and it records who asked it what.
    expect(theirs(log, asker, 'bot/engaged'))
      .toEqual([{ bot: scribe, displayName: 'Scribe', persona: 'You write minutes.' }])
    expect(theirs(log, asker, 'bot/answered'))
      .toEqual([{ asker: triage, displayName: 'Triage', question: 'What is the capital of France?' }])
    // Its own turn ran there, not in the asker's session.
    expect(theirs(log, asker, 'turn/end')).toHaveLength(1)
    expect(recorded(asker.session, 'turn/end')).toEqual([])
    // The teammate's character reached the model that answered.
    expect(model.requests.at(-1)?.messages.some(message => message.role === 'system')).toBe(true)
  })

  it('keeps the last prose when the turn also produced a message with none', async () => {
    const { ctx, model } = await bench()
    const triage = await bot(ctx, 'Triage')
    const scribe = await bot(ctx, 'Scribe')
    await team(ctx, [triage, scribe])
    const asker = await asking(ctx, 'asker', { bot: triage, displayName: 'Triage', persona: '' })
    model.answer = { text: 'Filed.', thenSilent: true }

    const answered = await ctx.botAsk.ask(asker, scribe, 'Anything?', new AbortController().signal)
    expect(answered.text).toBe('Filed.')
  })

  it('refuses a session that speaks as nobody', async () => {
    const { ctx } = await bench()
    const scribe = await bot(ctx, 'Scribe')
    const person = await asking(ctx, 'person', undefined)
    // A conversation a person opened has no teammates, so asking this way is
    // not a route from a person to another organization's bot.
    await expect(ctx.botAsk.ask(person, scribe, 'Anything?', new AbortController().signal))
      .rejects.toThrow(new AskRefusedError('not-a-bot', NOT_A_BOT))
  })

  it('refuses a bot that shares only an organization', async () => {
    const { ctx } = await bench()
    const triage = await bot(ctx, 'Triage')
    const stranger = await bot(ctx, 'Stranger')
    const asker = await asking(ctx, 'asker', { bot: triage, displayName: 'Triage', persona: '' })

    await expect(ctx.botAsk.ask(asker, stranger, 'Anything?', new AbortController().signal))
      .rejects.toThrow(new AskRefusedError('not-a-teammate', NOT_A_TEAMMATE))
    // And nothing was recorded, nor any session opened for it.
    expect(recorded(asker.session, 'bot/asked')).toEqual([])
    expect(ctx.sessions.list()).toHaveLength(1)
  })

  it('refuses a teammate whose turn said nothing', async () => {
    const { ctx, model, log } = await bench()
    const triage = await bot(ctx, 'Triage')
    const scribe = await bot(ctx, 'Scribe')
    await team(ctx, [triage, scribe])
    const asker = await asking(ctx, 'asker', { bot: triage, displayName: 'Triage', persona: '' })
    model.answer = { text: '' }

    await expect(ctx.botAsk.ask(asker, scribe, 'Anything?', new AbortController().signal))
      .rejects.toThrow(new AskRefusedError('no-answer', NO_ANSWER))
    // Nothing is told to the asking model, so nothing is recorded as learned.
    expect(recorded(asker.session, 'bot/asked')).toEqual([])
    // The answering session still says what it was asked.
    expect(theirs(log, asker, 'bot/answered')).toHaveLength(1)
  })
})
