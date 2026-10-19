/**
 * Whose conversations one call may see: its own, never another person's, and
 * — for what nobody opened — only a platform administrator's.
 */

import { Context } from '@lyness/cordis'
import { afterEach, describe, expect, it } from 'vitest'
import { brandString } from '@lyness/lyn-brand'
import type { Membership, MembershipId, PersonId, Role } from '@lyness/lyn-people'
import SessionStore, { SessionId } from '@lyness/lyn-session'
import type { Session, SessionHeader } from '@lyness/lyn-session'
import SessionProjectionRegistry from '@lyness/lyn-session-projection'
import * as SessionOwnership from '../src/index.ts'
import SessionVisibility from '../src/visibility.ts'
import type { SessionOwnerRecord } from '../src/types.ts'

const ADA = brandString<PersonId>('ada')
const BEA = brandString<PersonId>('bea')

const live: Context[] = []
afterEach(async () => { for (const ctx of live.splice(0)) await ctx.fiber.dispose() })

/** One deployment, with the call in progress under the test's control. */
interface Bench {
  /** The context the rule is mounted on. */
  readonly ctx: Context
  /** Put one person, in one standing, behind every following call. */
  readonly as: (person: PersonId | undefined, role?: Role) => void
  /** Open one session as whoever is behind the call now. */
  readonly open: () => Session
}

/** Sessions, projections, the stamp, and the rule. */
async function bench(cached?: SessionOwnerRecord | 'none'): Promise<Bench> {
  const ctx = new Context()
  live.push(ctx)
  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjectionRegistry)
  let standing: Membership | undefined
  let person: PersonId | undefined
  ctx.provide('requestPrincipal', {
    current: () => person === undefined
      ? undefined
      : { person, acting: { person, membership: standing?.id } },
  } as never)
  ctx.provide('people', {
    person: () => Promise.resolve(undefined),
    membership: (id: MembershipId) => Promise.resolve(standing?.id === id ? standing : undefined),
    memberships: () => Promise.resolve([]),
  })
  if (cached !== undefined) {
    // What the durable cache holds for a cold row: the owner unit's own
    // stored state, which the registry decodes back through its schema.
    ctx.provide('sessionProjectionCache', {
      cachedCheckpoint: () => cached === 'none'
        ? undefined
        : { owner: { ver: 1, seq: 0, val: cached } },
    } as never)
  }
  await ctx.plugin(SessionOwnership).await()
  await ctx.plugin(SessionVisibility)
  return {
    ctx,
    as: (who: PersonId | undefined, role?: Role) => {
      person = who
      standing = who === undefined || role === undefined
        ? undefined
        : { id: brandString<MembershipId>(`${who}:${role}`), person: who, role }
    },
    open: () => ctx.sessions.create(),
  }
}

/** One header, as a listing holds it. */
function header(it: Bench): SessionHeader {
  return it.open().header
}

describe('a call with nobody behind it', () => {
  it('sees everything, because it is the deployment acting on itself', async () => {
    const it = await bench()
    // A CLI run, a subagent and a scheduled follow-up all reach here with no
    // principal; filtering them would hide a deployment's work from itself.
    expect(await it.ctx.sessionVisibility.mayRead(it.open())).toBe(true)
  })
})

describe('a signed-in call', () => {
  it('sees the conversation it opened', async () => {
    const it = await bench()
    it.as(ADA, 'member')
    expect(await it.ctx.sessionVisibility.mayRead(it.open())).toBe(true)
  })

  it('does not see another person\'s conversation', async () => {
    const it = await bench()
    it.as(BEA, 'member')
    const theirs = it.open()
    it.as(ADA, 'member')
    expect(await it.ctx.sessionVisibility.mayRead(theirs)).toBe(false)
  })

  it('does not let an administrator past the conversations of the people it administers', async () => {
    const it = await bench()
    it.as(BEA, 'member')
    const theirs = it.open()
    it.as(ADA, 'platform-administrator')
    // Administering a deployment is not reading its people's conversations.
    expect(await it.ctx.sessionVisibility.mayRead(theirs)).toBe(false)
  })
})

describe('a conversation nobody opened', () => {
  it('is the deployment\'s own, so only a platform administrator sees it', async () => {
    const it = await bench()
    // Created with no principal, as a webhook or a scheduled run creates one.
    const unattributed = it.open()
    for (const [role, expected] of [
      ['member', false], ['tenant-administrator', false], ['platform-administrator', true],
    ] as const) {
      it.as(ADA, role)
      expect(await it.ctx.sessionVisibility.mayRead(unattributed)).toBe(expected)
    }
  })

  it('is refused a call acting in no standing at all', async () => {
    const it = await bench()
    const unattributed = it.open()
    it.as(ADA)
    expect(await it.ctx.sessionVisibility.mayRead(unattributed)).toBe(false)
  })
})

describe('a cold read that never resumes an Agent', () => {
  it('reads the attribution out of the cut it already holds', async () => {
    const it_ = await bench()
    it_.as(ADA, 'member')
    const written = it_.open().ownEvents()
    // The same log, read as a page or a follow would read it: the session is
    // not open here, so the events are all there is.
    const cut = {
      header: { ...it_.open().header, id: SessionId('a-cold-session') },
      events: written,
    }
    expect(await it_.ctx.sessionVisibility.mayReadObservation(cut)).toBe(true)
    it_.as(BEA, 'member')
    expect(await it_.ctx.sessionVisibility.mayReadObservation(cut)).toBe(false)
  })

  it('reads a cut that attributes nobody as the deployment\'s own', async () => {
    const it_ = await bench()
    const cut = {
      header: { ...it_.open().header, id: SessionId('an-unattributed-session') },
      events: [{ type: 'turn/start', data: { turn: 1 } }],
    }
    it_.as(ADA, 'member')
    expect(await it_.ctx.sessionVisibility.mayReadObservation(cut)).toBe(false)
    it_.as(ADA, 'platform-administrator')
    expect(await it_.ctx.sessionVisibility.mayReadObservation(cut)).toBe(true)
  })

  it('prefers the open session over the cut when there is one', async () => {
    const it_ = await bench()
    it_.as(ADA, 'member')
    const session = it_.open()
    // No events in the cut at all: the open session's own projection is what
    // answers, so a truncated or empty page cannot widen what is visible.
    expect(await it_.ctx.sessionVisibility.mayReadObservation({ header: session.header, events: [] })).toBe(true)
    it_.as(BEA, 'member')
    expect(await it_.ctx.sessionVisibility.mayReadObservation({ header: session.header, events: [] })).toBe(false)
  })
})

describe('a subagent child', () => {
  it('belongs to the conversation that spawned it', async () => {
    const it_ = await bench()
    it_.as(ADA, 'member')
    const parent = it_.open()
    // The loop opens a child outside any request, so it carries no owner.
    it_.as(undefined)
    const child = it_.ctx.sessions.create(SessionId('child'), {
      meta: { parentSession: parent.id, origin: 'subagent' },
    })

    it_.as(ADA, 'member')
    expect(await it_.ctx.sessionVisibility.mayRead(child)).toBe(true)
    it_.as(BEA, 'member')
    expect(await it_.ctx.sessionVisibility.mayRead(child)).toBe(false)
  })

  it('is the deployment\'s own while the conversation it belongs to is closed', async () => {
    const it_ = await bench()
    // No parent is open here: reading one would mean resuming it.
    const orphan = it_.ctx.sessions.create(SessionId('orphan-child'), {
      meta: { parentSession: SessionId('a-cold-parent'), origin: 'subagent' },
    })
    it_.as(ADA, 'member')
    expect(await it_.ctx.sessionVisibility.mayRead(orphan)).toBe(false)
    it_.as(ADA, 'platform-administrator')
    expect(await it_.ctx.sessionVisibility.mayRead(orphan)).toBe(true)
  })
})

describe('listing without reading a log', () => {
  const owned: SessionOwnerRecord = { version: 1, owner: ADA, openedAt: '2026-10-18T00:00:00.000Z' }

  it('answers from the projection cache', async () => {
    const it = await bench(owned)
    it.as(ADA, 'member')
    expect(await it.ctx.sessionVisibility.mayList(header(it))).toBe(true)
    it.as(BEA, 'member')
    expect(await it.ctx.sessionVisibility.mayList(header(it))).toBe(false)
  })

  it('reads a row the cache cannot answer for as unattributed', async () => {
    // Not a leak and not a loss: the row stays out of a member's list, and
    // opening it by id still asks the session's own log.
    const it = await bench('none')
    it.as(ADA, 'member')
    expect(await it.ctx.sessionVisibility.mayList(header(it))).toBe(false)
    it.as(ADA, 'platform-administrator')
    expect(await it.ctx.sessionVisibility.mayList(header(it))).toBe(true)
  })

  it('answers a deployment with no cache mounted at all', async () => {
    const it = await bench()
    it.as(ADA, 'platform-administrator')
    expect(await it.ctx.sessionVisibility.mayList(header(it))).toBe(true)
  })

  it('keeps the rows one call may see, in the order they were given', async () => {
    const it = await bench(owned)
    it.as(ADA, 'member')
    const rows = [header(it), header(it), header(it)]
    expect(await it.ctx.sessionVisibility.listable(rows, row => row)).toEqual(rows)
    it.as(BEA, 'member')
    expect(await it.ctx.sessionVisibility.listable(rows, row => row)).toEqual([])
  })
})
