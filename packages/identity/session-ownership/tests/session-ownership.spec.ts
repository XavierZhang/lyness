/**
 * What a session records about whose conversation it is: written once at
 * creation from the principal that opened it, absent when nobody did, and
 * never rewritten afterwards.
 */

import { Context } from '@lyness/cordis'
import { afterEach, describe, expect, it } from 'vitest'
import { brandString } from '@lyness/lyn-brand'
import type { MembershipId, PersonId } from '@lyness/lyn-people'
import SessionStore from '@lyness/lyn-session'
import type { Session } from '@lyness/lyn-session'
import SessionProjectionRegistry from '@lyness/lyn-session-projection'
import * as SessionOwnership from '../src/index.ts'
import { ownerOf } from '../src/index.ts'
import type { SessionOwnerRecord } from '../src/index.ts'

const ADA = brandString<PersonId>('ada')
const ACME = brandString<MembershipId>('ada:acme')

const live: Context[] = []
afterEach(async () => { for (const ctx of live.splice(0)) await ctx.fiber.dispose() })

/** Every ownership record in one session's own log. */
function records(session: Session): SessionOwnerRecord[] {
  return session.ownEvents()
    .filter(event => event.type === 'session/owner')
    .map(event => event.data)
}

/** Sessions, projections, a principal, and the stamp. */
async function bench(options: {
  person?: PersonId
  membership?: MembershipId
  before?: boolean
} = {}): Promise<Context> {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjectionRegistry)
  ctx.provide('requestPrincipal', {
    current: () => options.person === undefined
      ? undefined
      : { person: options.person, acting: { person: options.person, membership: options.membership } },
  } as never)
  if (options.before === true) ctx.sessions.create()
  await ctx.plugin(SessionOwnership).await()
  live.push(ctx)
  return ctx
}

describe('session ownership', () => {
  it('records the person who opened the conversation', async () => {
    const ctx = await bench({ person: ADA })
    const [record] = records(ctx.sessions.create())
    expect(record).toMatchObject({ version: 1, owner: ADA })
    expect(Date.parse(record?.openedAt ?? '')).not.toBeNaN()
  })

  it('records the standing they held it open under', async () => {
    const ctx = await bench({ person: ADA, membership: ACME })
    expect(records(ctx.sessions.create())[0]).toMatchObject({ owner: ADA, membership: ACME })
  })

  it('names no standing for someone acting as themselves', async () => {
    const ctx = await bench({ person: ADA })
    const [record] = records(ctx.sessions.create())
    // Absent rather than null: an individual's conversation belongs to no
    // organization, and nothing stands in for one.
    expect(record !== undefined && 'membership' in record).toBe(false)
  })

  it('records nobody when nobody opened it', async () => {
    const ctx = await bench()
    // A CLI run, a subagent and an inbound webhook all create sessions that
    // no request principal opened; attribution invented here would be wrong
    // permanently.
    expect(records(ctx.sessions.create())).toEqual([])
    expect(ownerOf(ctx, ctx.sessions.create())).toBeUndefined()
  })

  it('stamps a session that already existed when the plugin mounted', async () => {
    const ctx = await bench({ person: ADA, before: true })
    const [existing] = ctx.sessions.list()
    expect(records(existing!)).toHaveLength(1)
  })

  it('reads the record back, and writes it exactly once', async () => {
    const ctx = await bench({ person: ADA, membership: ACME })
    const session = ctx.sessions.create()
    expect(ownerOf(ctx, session)).toMatchObject({ owner: ADA, membership: ACME })

    // Every other event leaves the attribution alone.
    session.append('turn/start', { turn: 1 })
    expect(ownerOf(ctx, session)).toMatchObject({ owner: ADA })

    // A second mount is a restart: the session keeps what it was created with.
    await ctx.plugin(SessionOwnership).await()
    expect(records(session)).toHaveLength(1)
  })

  it('folds only its own event into the state', () => {
    const record: SessionOwnerRecord = { version: 1, owner: ADA, openedAt: '2026-10-16T00:00:00.000Z' }
    expect(SessionOwnership.applyOwnerEvent(null, { type: 'session/owner', data: record })).toBe(record)
    expect(SessionOwnership.applyOwnerEvent(record, { type: 'turn/start', data: {} })).toBe(record)
  })
})
