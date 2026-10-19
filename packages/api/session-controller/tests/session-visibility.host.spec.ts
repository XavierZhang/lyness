/**
 * A conversation is its owner's: another person's does not appear in a list,
 * is not matched by a search, and answers every address as not found.
 *
 * The rule itself is pinned in `lyn-session-ownership`; what this spec pins
 * is that each of this controller's read paths asks it: the corpus read the
 * list and the search share, the resolution every Agent-backed endpoint goes
 * through, the history, and the projections.
 */

import { describe, expect, it } from 'vitest'
import { Context } from '@lyness/cordis'
import AgentRegistry from '@lyness/lyn-agent'
import type { Agent } from '@lyness/lyn-agent'
import { brandString } from '@lyness/lyn-brand'
import type { MembershipId, PersonId } from '@lyness/lyn-people'
import SessionStore, { SessionId } from '@lyness/lyn-session'
import type { Session } from '@lyness/lyn-session'
import SessionProjectionRegistry from '@lyness/lyn-session-projection'
import * as SessionOwnership from '@lyness/lyn-session-ownership'
import SessionVisibility from '@lyness/lyn-session-ownership/visibility'
import { createSessionTestController, createSessionTestRemote, type TestSessionRemote } from './test-remote.ts'
import type SessionController from '../src/index.ts'

const ADA = brandString<PersonId>('ada')
const BEA = brandString<PersonId>('bea')

/** One deployment serving two people, with the call in progress under the test's control. */
interface Harness {
  readonly ctx: Context
  readonly remote: TestSessionRemote
  /** The Host face, for the resolution every Agent-backed endpoint goes through. */
  readonly controller: SessionController
  /** Put one person behind every following call; `undefined` is a call with nobody behind it. */
  readonly as: (person: PersonId | undefined) => void
  /** Open and attach one session as whoever is behind the call now. */
  readonly open: () => Promise<Session>
}

async function harness(): Promise<Harness> {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(SessionProjectionRegistry)
  let person: PersonId | undefined
  let opened = 0
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
  await ctx.plugin(SessionOwnership).await()
  await ctx.plugin(SessionVisibility)
  const defaults = { defaultModelSelection: () => ({ provider: 'p', model: 'm' }), cwd: '/tmp' }
  return {
    ctx,
    controller: createSessionTestController(ctx, defaults),
    remote: createSessionTestRemote(ctx, defaults),
    as: (who: PersonId | undefined) => { person = who },
    open: async () => {
      // A listing and a history both refuse a session with no cwd, so every
      // session here has one: what this spec proves must be the rule.
      const id = SessionId(`session-${String(++opened)}`)
      const session = ctx.sessions.create(id, { meta: { createdAt: opened, cwd: '/tmp' } })
      await ctx.agents.register({ id: session.id, session, status: 'idle', ctx } as Agent)
      return session
    },
  }
}

/** The ids one call's list answers with. */
async function listed(remote: TestSessionRemote): Promise<string[]> {
  const result = await remote.list({})
  if (!result.ok) throw new Error('list failed')
  return result.value.items.map(item => String(item.sessionId))
}

/** The failure code one call answered with, or undefined when it succeeded. */
function codeOf(result: { ok: boolean; error?: { code: string } }): string | undefined {
  return result.ok ? undefined : result.error?.code
}

describe('two people on one deployment', () => {
  it('lists each person only their own conversations', async () => {
    const it = await harness()
    it.as(ADA)
    const mine = await it.open()
    it.as(BEA)
    const theirs = await it.open()

    expect(await listed(it.remote)).toEqual([String(theirs.id)])
    it.as(ADA)
    expect(await listed(it.remote)).toEqual([String(mine.id)])
  })

  it('answers another person\'s conversation as not found, whatever is asked of it', async () => {
    const it = await harness()
    it.as(BEA)
    const theirs = await it.open()
    it.as(ADA)

    // Every Agent-backed endpoint — prompt, rename, fork, cancel, the rest —
    // resolves through this one face, so refusing here refuses all of them.
    const resolved = await it.controller.resolveAgent(theirs.id)
    expect('error' in resolved && resolved.error.code).toBe('session/not-found')
    // And the history, which never resumes an Agent at all.
    expect(codeOf(await it.remote.page({
      address: { kind: 'session', sessionId: theirs.id },
      throughSeq: 0,
      beforeSeq: 1,
      maxMessages: 10,
    }))).toBe('session/not-found')
  })

  it('answers a projection read of another person\'s conversation with nothing', async () => {
    const it = await harness()
    it.as(BEA)
    const theirs = await it.open()
    it.as(ADA)
    const result = await it.remote.projections({ sessionId: theirs.id })
    expect(result.ok && result.value).toBe(null)
  })

  it('leaves its owner every one of those answers', async () => {
    const it = await harness()
    it.as(ADA)
    const mine = await it.open()

    expect('agent' in await it.controller.resolveAgent(mine.id)).toBe(true)
    expect(codeOf(await it.remote.page({
      address: { kind: 'session', sessionId: mine.id },
      throughSeq: 0,
      beforeSeq: 1,
      maxMessages: 10,
    }))).toBeUndefined()
    const projections = await it.remote.projections({ sessionId: mine.id })
    expect(projections.ok && projections.value).not.toBe(null)
  })
})

describe('a deployment with no accounts', () => {
  it('keeps every conversation visible, because nothing mounts the rule', async () => {
    const ctx = new Context()
    await ctx.plugin(SessionStore)
    await ctx.plugin(AgentRegistry)
    const remote = createSessionTestRemote(ctx, {
      defaultModelSelection: () => ({ provider: 'p', model: 'm' }),
      cwd: '/tmp',
    })
    const one = ctx.sessions.create()
    await ctx.agents.register({ id: one.id, session: one, status: 'idle', ctx } as Agent)
    const two = ctx.sessions.create()
    await ctx.agents.register({ id: two.id, session: two, status: 'idle', ctx } as Agent)
    expect((await listed(remote)).sort()).toEqual([String(one.id), String(two.id)].sort())
  })
})
