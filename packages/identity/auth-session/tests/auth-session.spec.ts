/**
 * Signed-in sessions: what a session opens on, how its context changes, and
 * what a lapsed or revoked bearer identity does.
 */

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@lyness/cordis'
import Storage from '@lyness/lyn-storage'
import * as StorageDomain from '@lyness/lyn-storage-domain'
import * as StorageJson from '@lyness/lyn-storage-json'
import { brandString } from '@lyness/lyn-brand'
import type { MembershipId, PersonId } from '@lyness/lyn-people'
import type { AuthSessionId } from '../src/types.ts'
import { afterEach, expect, it } from 'vitest'
import { SessionUnavailable } from '../src/index.ts'
import StoredAuthSessions, { resolveLifetime } from '../src/store.ts'

const ADA = brandString<PersonId>('ada')
const BOB = brandString<PersonId>('bob')
const ADA_STANDING = brandString<MembershipId>('ada:member')
const roots: string[] = []
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })

/** A session store over durable JSON storage. */
async function harness(config: { lifetimeMs?: number } = {},
  root = mkdtempSync(join(tmpdir(), 'lyn-auth-'))): Promise<{ ctx: Context; root: string }> {
  roots.push(root)
  const ctx = new Context()
  await ctx.plugin(Storage)
  await ctx.plugin(StorageJson, { root })
  await ctx.plugin(StorageDomain, { backend: 'json' })
  await ctx.plugin(StoredAuthSessions, config).await()
  return { ctx, root }
}

it('opens a session on the personal context, never on a membership', async () => {
  const { ctx } = await harness()

  const session = await ctx.authSessions.establish({ person: ADA, method: 'password' })

  // Opening on a standing would be the guess this design exists to avoid,
  // even for a person who holds exactly one.
  expect(session.acting).toEqual({ person: ADA })
  expect(session.method).toBe('password')
})

it('puts a checked context in force and keeps it', async () => {
  const { ctx } = await harness()
  const session = await ctx.authSessions.establish({ person: ADA, method: 'sso' })

  await ctx.authSessions.switchContext(session.id, { person: ADA, membership: ADA_STANDING })

  expect((await ctx.authSessions.read(session.id)).acting)
    .toEqual({ person: ADA, membership: ADA_STANDING })
})

it('refuses a context belonging to another person', async () => {
  const { ctx } = await harness()
  const session = await ctx.authSessions.establish({ person: ADA, method: 'sso' })

  // Storing it would make every later call from this session act as somebody
  // else, so one bad switch would become many wrong calls.
  await expect(ctx.authSessions.switchContext(session.id, { person: BOB }))
    .rejects.toBeInstanceOf(SessionUnavailable)
  expect((await ctx.authSessions.read(session.id)).acting).toEqual({ person: ADA })
})

it('refuses a lapsed session the moment it is presented', async () => {
  const { ctx } = await harness()
  const session = await ctx.authSessions.establish({ person: ADA, method: 'sso', lifetimeMs: 1 })

  await new Promise(resolve => setTimeout(resolve, 5))

  // Checked on read rather than swept, because a sweep that has not run yet
  // would let a lapsed credential through.
  const refusal = await ctx.authSessions.read(session.id).catch((error: unknown) => error)
  expect((refusal as SessionUnavailable).code).toBe('session-expired')
})

it('refuses an identity no session carries', async () => {
  const { ctx } = await harness()

  const refusal = await ctx.authSessions.read(brandString<AuthSessionId>('nope')).catch((error: unknown) => error)
  expect((refusal as SessionUnavailable).code).toBe('session-unknown')
})

it('ends a session without ending the identity', async () => {
  const { ctx } = await harness()
  const session = await ctx.authSessions.establish({ person: ADA, method: 'sso' })

  expect(await ctx.authSessions.revoke(session.id)).toBe(true)
  await expect(ctx.authSessions.read(session.id)).rejects.toBeInstanceOf(SessionUnavailable)
  // The person still exists and may sign in again.
  expect((await ctx.authSessions.establish({ person: ADA, method: 'sso' })).person).toBe(ADA)
})

it('reports nothing revoked for an identity it does not hold', async () => {
  const { ctx } = await harness()

  expect(await ctx.authSessions.revoke(brandString<AuthSessionId>('nope'))).toBe(false)
})

it('keeps a session across a restart, so a redeploy does not sign everybody out', async () => {
  const first = await harness()
  const session = await first.ctx.authSessions.establish({ person: ADA, method: 'sso' })
  await first.ctx.authSessions.switchContext(session.id, { person: ADA, membership: ADA_STANDING })
  await first.ctx.fiber.dispose()

  const second = await harness({}, first.root)

  expect((await second.ctx.authSessions.read(session.id)).acting)
    .toEqual({ person: ADA, membership: ADA_STANDING })
})

it('lets a deployment issue a session that does not lapse', async () => {
  const { ctx } = await harness({ lifetimeMs: 0 })

  const session = await ctx.authSessions.establish({ person: ADA, method: 'sso' })

  expect(session.expiresAt).toBeUndefined()
  expect((await ctx.authSessions.read(session.id)).person).toBe(ADA)
})

it('applies the documented lifetime for a hand-built config', () => {
  expect(resolveLifetime({})).toBe(14 * 24 * 3_600_000)
  expect(resolveLifetime({ lifetimeMs: 60_000 })).toBe(60_000)
})

it('refuses a switch on a lapsed session rather than reviving it', async () => {
  const { ctx } = await harness()
  const session = await ctx.authSessions.establish({ person: ADA, method: 'sso', lifetimeMs: 1 })
  await new Promise(resolve => setTimeout(resolve, 5))

  await expect(ctx.authSessions.switchContext(session.id, { person: ADA, membership: ADA_STANDING }))
    .rejects.toBeInstanceOf(SessionUnavailable)
})

it('keeps a non-lapsing session non-lapsing across a context switch', async () => {
  const { ctx } = await harness({ lifetimeMs: 0 })
  const session = await ctx.authSessions.establish({ person: ADA, method: 'sso' })

  const switched = await ctx.authSessions.switchContext(session.id, {
    person: ADA, membership: ADA_STANDING,
  })

  // A switch changes the context in force and nothing else; silently giving
  // a non-lapsing session an expiry would sign somebody out unexpectedly.
  expect(switched.expiresAt).toBeUndefined()
  expect(switched.establishedAt).toBe(session.establishedAt)
})
