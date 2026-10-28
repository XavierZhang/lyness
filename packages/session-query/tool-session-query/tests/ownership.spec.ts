/**
 * One workspace, two people: a tool call reaches what the person who opened
 * its conversation could reach, and nothing else.
 *
 * A workspace is a path, and on a deployment that serves named people two of
 * them can be working in the same one — so the workspace rule alone would let
 * a model read the other person's sessions on request.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { turnBoundaryProjectionDefinition } from '@deepseek-ai/dsh-agent-loop'
import { brandString } from '@deepseek-ai/dsh-brand'
import { createUserMessage, ToolCallId } from '@deepseek-ai/dsh-llm'
import type { MembershipId, PersonId } from '@deepseek-ai/dsh-people'
import SessionStore, { SessionId, type Session } from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import * as SessionOwnership from '@deepseek-ai/dsh-session-ownership'
import SessionVisibility from '@deepseek-ai/dsh-session-ownership/visibility'
import JsonlSessionPersistence from '@deepseek-ai/dsh-session-persistence-jsonl'
import SqliteSessionQueryEngine from '@deepseek-ai/dsh-session-query-sqlite'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import * as ToolSessionQuery from '@deepseek-ai/dsh-tool-session-query'

const ADA = brandString<PersonId>('ada')
const BEA = brandString<PersonId>('bea')

const temporaryDirectories: string[] = []
const contexts: Context[] = []

afterEach(async () => {
  for (const ctx of contexts.splice(0)) await ctx.fiber.dispose()
  for (const directory of temporaryDirectories.splice(0)) {
    await rm(directory, { recursive: true, force: true })
  }
})

/** One deployment serving two people out of one workspace. */
async function deployment(): Promise<{
  readonly ctx: Context
  readonly as: (person: PersonId | undefined) => void
  readonly conversation: (id: string, text: string) => Session
  readonly run: (name: string, args: unknown, caller: Session) => Promise<string>
}> {
  const root = await mkdtemp(join(tmpdir(), 'dsh-tool-session-query-ownership-'))
  temporaryDirectories.push(root)
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjectionRegistry)
  ctx.sessionProjections.register(turnBoundaryProjectionDefinition)
  let person: PersonId | undefined
  ctx.provide('requestPrincipal', {
    current: () => person === undefined
      ? undefined
      : { person, acting: { person, membership: brandString<MembershipId>(`${person}:member`) } },
  } as never)
  ctx.provide('people', {
    person: () => Promise.resolve(undefined),
    membership: (id: MembershipId) => Promise.resolve({ id, person: ADA, role: 'member' }),
    memberships: () => Promise.resolve([]),
  } as never)
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(JsonlSessionPersistence, { root, compression: 'none' })
  await ctx.plugin(SqliteSessionQueryEngine, { path: join(root, 'session-query.db') })
  await ctx.plugin(SessionOwnership).await()
  await ctx.plugin(SessionVisibility)
  await ctx.plugin(ToolSessionQuery)

  let call = 0
  return {
    ctx,
    as: (who: PersonId | undefined) => { person = who },
    conversation: (id: string, text: string) => {
      const session = ctx.sessions.create(SessionId(id), { meta: { createdAt: 10, cwd: '/work' } })
      session.append('turn/start', { turn: 1 })
      session.append(
        'user/message',
        createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } }),
        { surfaceOp: 'append' },
      )
      session.append('step/start', { turn: 1, step: 1 })
      return session
    },
    run: async (name: string, args: unknown, caller: Session) => {
      const result = await ctx.tools.execute({
        name,
        arguments: args,
        callId: ToolCallId(`ownership-${String(++call)}`),
        signal: new AbortController().signal,
        agent: { id: caller.id, session: caller, status: 'idle', ctx } as Agent,
      })
      return result.content.map(block => block.type === 'text' ? block.text : '').join('\n')
    },
  }
}

describe('a model asking about prior sessions', () => {
  it('finds its own person\'s conversations and not the other person\'s', { timeout: 20_000 }, async () => {
    const it_ = await deployment()
    it_.as(BEA)
    it_.conversation('theirs', 'shared workspace needle')
    it_.as(ADA)
    it_.conversation('mine-earlier', 'shared workspace needle')
    const caller = it_.conversation('caller', 'asking about the needle')

    const found = await it_.run('session_search', { query: 'shared workspace needle' }, caller)
    expect(found).toContain('Session mine-earlier')
    expect(found).not.toContain('Session theirs')
  })

  it('refuses to open the other person\'s conversation by id', { timeout: 20_000 }, async () => {
    const it_ = await deployment()
    it_.as(BEA)
    it_.conversation('theirs', 'shared workspace needle')
    it_.as(ADA)
    const caller = it_.conversation('caller', 'asking about the needle')

    const refused = await it_.run(
      'session_event_search',
      { session_id: 'theirs', query: 'shared workspace needle' },
      caller,
    )
    // The same refusal a session outside the workspace gets: telling the
    // model that this one exists but belongs to somebody else would answer
    // the question it was refused.
    expect(refused).toContain('session target is outside the caller workspace')
  })

  it('leaves a deployment with no accounts reading its whole workspace', { timeout: 20_000 }, async () => {
    const it_ = await deployment()
    // Nobody is signed in: every session reads as the deployment's own, which
    // is the single-operator shape this tool has always served.
    it_.conversation('earlier', 'shared workspace needle')
    const caller = it_.conversation('caller', 'asking about the needle')
    expect(await it_.run('session_search', { query: 'shared workspace needle' }, caller))
      .toContain('Session earlier')
  })
})
