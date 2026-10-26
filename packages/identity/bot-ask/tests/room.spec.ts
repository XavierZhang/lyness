/**
 * What a room does: every participant speaks once per round in the order the
 * opener named them, each reading what was said before it, and the chair
 * writes one named conclusion when the bound ends it.
 *
 * Driven against the production agent loop with a scripted model, so the room
 * session and each speaker's own session are written by the shipping code.
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
import SessionProjectionRegistry from '@lyness/lyn-session-projection'
import SystemPrompt from '@lyness/lyn-system-prompt'
import ToolRuntime from '@lyness/lyn-tools'
import Storage from '@lyness/lyn-storage'
import * as StorageJson from '@lyness/lyn-storage-json'
import * as StorageDomain from '@lyness/lyn-storage-domain'
import AdminAudit from '@lyness/lyn-admin-audit'
import ManagedPeople from '@lyness/lyn-managed-people'
import ManagedBots, { botProjectionDefinition } from '@lyness/lyn-managed-bots'
import BotRoom, {
  MAX_ROUNDS, NOBODY_TO_DISCUSS_WITH, NOT_A_BOT, NOT_A_TEAMMATE, RoomRefusedError, briefing, rounds,
} from '../src/room.ts'
import { ANSWERING_PROVIDER, TakingTurnsAdapter } from './answering-adapter.ts'

const live: Context[] = []
const roots: string[] = []

afterEach(async () => {
  for (const ctx of live.splice(0)) await ctx.fiber.dispose()
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true })
})

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

/** A deployment with a roster, the production loop and a turn-taking model. */
async function bench(): Promise<{ ctx: Context; model: TakingTurnsAdapter; log: Recorded[] }> {
  const root = await mkdtemp(join(tmpdir(), 'lyn-bot-room-'))
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
  const model = new TakingTurnsAdapter()
  ctx.llm.registerAdapter([ANSWERING_PROVIDER], model)
  ctx.provide('agentPresets', {
    list: () => Promise.resolve([{ id: 'standard' }]),
    mount: (_agentCtx: Context, id: string) => Promise.resolve({ id }),
  } as never)
  ctx.provide('agentDefaultModel', {
    currentSelection: () => ({ provider: ANSWERING_PROVIDER, model: 'scripted' }),
    saveSelection: () => Promise.resolve(),
  } as never)
  ctx.sessionProjections.register(botProjectionDefinition)
  const log: Recorded[] = []
  ctx.on('session/event', (session, event) => { log.push({ session: session.id, type: event.type, data: event.data }) })
  await ctx.plugin(AdminAudit, {}).await()
  await ctx.plugin(ManagedPeople).await()
  await ctx.plugin(ManagedBots).await()
  await ctx.plugin(BotRoom).await()
  return { ctx, model, log }
}

/** One bot in that organization. */
async function bot(ctx: Context, displayName: string): Promise<PersonId> {
  const saved = await ctx.managedBots.save({
    displayName, organization: 'acme', persona: `You are ${displayName}.`, job: '', preset: 'standard',
  }, BY)
  return brandString<PersonId>(saved.id)
}

/** A production agent whose session speaks as that bot, or as nobody. */
async function opening(ctx: Context, id: string, bot_: PersonId | undefined): Promise<Agent> {
  const agent = await ctx.agentLoop.create(
    SessionId(id),
    { provider: ANSWERING_PROVIDER, model: 'scripted' },
    { cwd: '/w' },
  )
  if (bot_ !== undefined) {
    agent.session.append('bot/engaged', { bot: bot_, displayName: 'Chair', persona: 'You are Chair.' })
  }
  return agent
}

/** The events of one type the room recorded, in order. */
function roomLog(log: readonly Recorded[], room: SessionId, type: string): unknown[] {
  return log.filter(entry => entry.session === room && entry.type === type).map(entry => entry.data)
}

describe('holding a discussion', () => {
  it('gives every participant a turn each round, and ends with one conclusion', async () => {
    const { ctx, model, log } = await bench()
    const chair = await bot(ctx, 'Chair')
    const first = await bot(ctx, 'First')
    const second = await bot(ctx, 'Second')
    await ctx.managedBots.saveTeam(
      { displayName: 'Intake', organization: 'acme', members: [chair, first, second] },
      BY,
    )
    const opener = await opening(ctx, 'opener', chair)
    model.answers = ['a', 'b', 'c', 'd', 'e', 'f', 'the conclusion']

    const held = await ctx.botRoom.hold(
      opener,
      { participants: [first, second], question: 'Ship it?', rounds: 2 },
      new AbortController().signal,
    )

    // The opener speaks first each round, then the invited in the order named.
    expect(held.remarks.map(one => one.displayName)).toEqual([
      'Chair', 'First', 'Second', 'Chair', 'First', 'Second',
    ])
    expect(held.conclusion).toBe('the conclusion')
    expect(roomLog(log, held.sessionId, 'room/opened')).toEqual([{
      question: 'Ship it?',
      rounds: 2,
      participants: [
        { bot: chair, displayName: 'Chair' },
        { bot: first, displayName: 'First' },
        { bot: second, displayName: 'Second' },
      ],
    }])
    expect(roomLog(log, held.sessionId, 'room/said')).toHaveLength(6)
    expect(roomLog(log, held.sessionId, 'room/concluded'))
      .toEqual([{ conclusion: 'the conclusion', remarks: 6 }])
  })

  it('shows each speaker what was said before it, and nothing of any other conversation', async () => {
    const { ctx, model } = await bench()
    const chair = await bot(ctx, 'Chair')
    const first = await bot(ctx, 'First')
    await ctx.managedBots.saveTeam({ displayName: 'Intake', organization: 'acme', members: [chair, first] }, BY)
    const opener = await opening(ctx, 'opener', chair)
    model.answers = ['the opener spoke', 'the invited spoke', 'done']

    await ctx.botRoom.hold(
      opener,
      { participants: [first], question: 'Ship it?', rounds: 1 },
      new AbortController().signal,
    )

    const texts = model.requests.map(request => request.messages
      .flatMap(message => message.content.flatMap(block => block.type === 'text' ? [block.text] : []))
      .join('\n'))
    // The first speaker reads an empty transcript; the second reads the first.
    expect(texts[0]).toContain('Nobody has spoken yet.')
    expect(texts[1]).toContain('Chair: the opener spoke')
    // And the chair's own summarising request reads both.
    expect(texts[2]).toContain('First: the invited spoke')
    expect(texts[2]).toContain('Write the conclusion.')
  })

  it('skips a participant that said nothing, and still concludes', async () => {
    const { ctx, model, log } = await bench()
    const chair = await bot(ctx, 'Chair')
    const first = await bot(ctx, 'First')
    await ctx.managedBots.saveTeam({ displayName: 'Intake', organization: 'acme', members: [chair, first] }, BY)
    const opener = await opening(ctx, 'opener', chair)
    // The opener speaks, the invited says nothing, the chair concludes.
    model.answers = ['only I spoke', '', 'concluded anyway']

    const held = await ctx.botRoom.hold(
      opener,
      { participants: [first], question: 'Ship it?', rounds: 1 },
      new AbortController().signal,
    )

    expect(held.remarks.map(one => one.displayName)).toEqual(['Chair'])
    expect(roomLog(log, held.sessionId, 'room/said')).toHaveLength(1)
    expect(held.conclusion).toBe('concluded anyway')
  })

  it('ends an empty discussion by saying so rather than asking the chair', async () => {
    const { ctx, model } = await bench()
    const chair = await bot(ctx, 'Chair')
    const first = await bot(ctx, 'First')
    await ctx.managedBots.saveTeam({ displayName: 'Intake', organization: 'acme', members: [chair, first] }, BY)
    const opener = await opening(ctx, 'opener', chair)
    model.answers = ['']

    const held = await ctx.botRoom.hold(
      opener,
      { participants: [first], question: 'Ship it?', rounds: 1 },
      new AbortController().signal,
    )

    expect(held.remarks).toEqual([])
    expect(held.conclusion).toBe('Nobody said anything, so there is no conclusion.')
    // Two speaking turns and no summarising request: the chair was not asked.
    expect(model.requests).toHaveLength(2)
  })

  it('ends with a stated absence when the chair\'s own request produced nothing', async () => {
    const { ctx, model } = await bench()
    const chair = await bot(ctx, 'Chair')
    const first = await bot(ctx, 'First')
    await ctx.managedBots.saveTeam({ displayName: 'Intake', organization: 'acme', members: [chair, first] }, BY)
    const opener = await opening(ctx, 'opener', chair)
    model.answers = ['said', 'said too', 'reasoned only']
    // The chair's own request ends on reasoning: there is prose in the
    // stream's blocks for the speakers, and none in the chair's.
    model.silent = [2]

    const held = await ctx.botRoom.hold(
      opener,
      { participants: [first], question: 'Ship it?', rounds: 1 },
      new AbortController().signal,
    )

    // The remarks are the record; a missing summary is not a reason to lose them.
    expect(held.remarks).toHaveLength(2)
    expect(held.conclusion).toBe('The discussion ended without a stated conclusion.')
  })
})

describe('what a discussion refuses', () => {
  it('refuses a session that speaks as nobody', async () => {
    const { ctx } = await bench()
    const first = await bot(ctx, 'First')
    const person = await opening(ctx, 'person', undefined)
    await expect(ctx.botRoom.hold(
      person, { participants: [first], question: 'Ship it?', rounds: 1 }, new AbortController().signal,
    )).rejects.toThrow(new RoomRefusedError('not-a-bot', NOT_A_BOT))
  })

  it('refuses a participant that is not a teammate', async () => {
    const { ctx } = await bench()
    const chair = await bot(ctx, 'Chair')
    const stranger = await bot(ctx, 'Stranger')
    const opener = await opening(ctx, 'opener', chair)
    // Team membership is the whole authorization, as it is for an ask.
    await expect(ctx.botRoom.hold(
      opener, { participants: [stranger], question: 'Ship it?', rounds: 1 }, new AbortController().signal,
    )).rejects.toThrow(new RoomRefusedError('not-a-teammate', NOT_A_TEAMMATE))
  })

  it('refuses a discussion with nobody else in it', async () => {
    const { ctx } = await bench()
    const chair = await bot(ctx, 'Chair')
    const opener = await opening(ctx, 'opener', chair)
    await expect(ctx.botRoom.hold(
      opener, { participants: [], question: 'Ship it?', rounds: 1 }, new AbortController().signal,
    )).rejects.toThrow(new RoomRefusedError('nobody', NOBODY_TO_DISCUSS_WITH))
  })
})

describe('the bound', () => {
  it('is the deployment\'s, so more rounds than it chairs runs fewer', () => {
    expect(rounds(1)).toBe(1)
    expect(rounds(MAX_ROUNDS)).toBe(MAX_ROUNDS)
    // Clamped rather than refused: a request for more is a shorter
    // discussion, not an error the model has to recover from.
    expect(rounds(MAX_ROUNDS + 10)).toBe(MAX_ROUNDS)
    expect(rounds(0)).toBe(1)
    expect(rounds(-3)).toBe(1)
    expect(rounds(2.7)).toBe(2)
    expect(rounds(Number.NaN)).toBe(1)
  })
})

describe('what one speaker reads', () => {
  it('names the question, the transcript and whose turn it is', () => {
    expect(briefing('Ship it?', [], 'First')).toContain('Nobody has spoken yet.')
    expect(briefing('Ship it?', [], 'First')).toContain('You are First.')
    const said = briefing(
      'Ship it?',
      [{ bot: brandString<PersonId>('a'), displayName: 'A', text: 'yes' }],
      undefined,
    )
    expect(said).toContain('A: yes')
    expect(said).toContain('Write the conclusion.')
  })
})
