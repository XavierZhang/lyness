/**
 * Signing in through a channel: what each refusal looks like, and what a
 * successful sign-in leaves behind.
 */

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@lyness/cordis'
import Storage from '@lyness/lyn-storage'
import * as StorageDomain from '@lyness/lyn-storage-domain'
import * as StorageJson from '@lyness/lyn-storage-json'
import { brandString } from '@lyness/lyn-brand'
import type { PersonId } from '@lyness/lyn-people'
import StoredAuthSessions from '@lyness/lyn-auth-session/store'
import { afterEach, describe, expect, it } from 'vitest'
import SignIn, { DEFAULT_LIFETIME_MS, SignInRefused, channelId, resolveConfig } from '../src/index.ts'
import type { Config, SignInChannel } from '../src/index.ts'
import { SignInAdmission } from '../src/admission.ts'
import type { ExternalSubject } from '../src/types.ts'

const ADA = brandString<PersonId>('ada')
const ENTRA = channelId('microsoft-entra')

const roots: string[] = []
const live: Context[] = []
// Stop each context before its storage root goes: a store still running when
// its directory disappears flushes into nothing and reports it as an
// unhandled rejection, which would make a passing suite look broken.
afterEach(async () => {
  for (const ctx of live.splice(0)) await ctx.fiber.dispose()
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

/** An admission rule answering from a fixed table, so the test states the decision. */
class TableAdmission extends SignInAdmission {
  constructor(ctx: Context, private readonly answer: PersonId | undefined) {
    super(ctx)
  }

  admit(subject: ExternalSubject): Promise<PersonId | undefined> {
    void subject
    return Promise.resolve(this.answer)
  }
}

/** A channel returning a fixed outcome, standing in for a browser round trip. */
function channel(outcome: ExternalSubject | undefined, id = ENTRA): SignInChannel {
  return {
    id,
    displayName: 'Microsoft Entra ID',
    authenticate: () => Promise.resolve(outcome),
  }
}

const SUBJECT: ExternalSubject = {
  channel: ENTRA,
  issuer: 'contoso.onmicrosoft.com',
  subject: '7a1f',
  displayName: 'Ada Lovelace',
}

/** A context with sessions, one admission answer, and the sign-in service. */
async function harness(
  admits: PersonId | undefined,
  config: Config = {},
): Promise<Context> {
  const root = mkdtempSync(join(tmpdir(), 'lyn-sign-in-'))
  roots.push(root)
  const ctx = new Context()
  await ctx.plugin(Storage)
  await ctx.plugin(StorageJson, { root })
  await ctx.plugin(StorageDomain, { backend: 'json' })
  await ctx.plugin(StoredAuthSessions, {}).await()
  await ctx.plugin(class extends TableAdmission {
    constructor(inner: Context) { super(inner, admits) }
  }).await()
  await ctx.plugin(SignIn, config).await()
  live.push(ctx)
  return ctx
}

describe('resolveConfig', () => {
  it('lasts twelve hours when a deployment states no term', () => {
    expect(resolveConfig({}).lifetimeMs).toBe(DEFAULT_LIFETIME_MS)
  })

  it('takes the stated term when a deployment states one', () => {
    expect(resolveConfig({ lifetimeMs: 60_000 }).lifetimeMs).toBe(60_000)
  })
})

describe('SignIn', () => {
  it('establishes a session for the person the rule admits', async () => {
    const ctx = await harness(ADA)
    ctx.signIn.register(channel(SUBJECT))
    const id = await ctx.signIn.begin(ENTRA)
    const session = await ctx.authSessions.read(id)
    expect(session.person).toBe(ADA)
  })

  it('records which channel proved who they are', async () => {
    const ctx = await harness(ADA)
    ctx.signIn.register(channel(SUBJECT))
    const session = await ctx.authSessions.read(await ctx.signIn.begin(ENTRA))
    expect(session.method).toBe('sign-in:microsoft-entra')
  })

  it('opens on the personal context rather than on a standing', async () => {
    const ctx = await harness(ADA)
    ctx.signIn.register(channel(SUBJECT))
    const session = await ctx.authSessions.read(await ctx.signIn.begin(ENTRA))
    expect(session.acting.membership).toBeUndefined()
  })

  it('lapses after the term the deployment stated', async () => {
    const ctx = await harness(ADA, { lifetimeMs: 60_000 })
    ctx.signIn.register(channel(SUBJECT))
    const session = await ctx.authSessions.read(await ctx.signIn.begin(ENTRA))
    const lifetime = Date.parse(session.expiresAt ?? '') - Date.parse(session.establishedAt)
    expect(lifetime).toBe(60_000)
  })

  it('refuses a channel nobody mounted', async () => {
    const ctx = await harness(ADA)
    await expect(ctx.signIn.begin(channelId('wecom')))
      .rejects.toMatchObject({ code: 'channel-unknown' })
  })

  it('refuses a sign-in the directory did not complete', async () => {
    const ctx = await harness(ADA)
    ctx.signIn.register(channel(undefined))
    await expect(ctx.signIn.begin(ENTRA))
      .rejects.toMatchObject({ code: 'not-authenticated' })
  })

  it('refuses a verified subject this deployment admits as nobody', async () => {
    const ctx = await harness(undefined)
    ctx.signIn.register(channel(SUBJECT))
    await expect(ctx.signIn.begin(ENTRA))
      .rejects.toMatchObject({ code: 'not-admitted' })
  })

  it('establishes nothing when admission refuses', async () => {
    const ctx = await harness(undefined)
    ctx.signIn.register(channel(SUBJECT))
    let established = 0
    const store = ctx.authSessions
    const real = store.establish.bind(store)
    store.establish = async (request) => { established += 1; return real(request) }
    await expect(ctx.signIn.begin(ENTRA)).rejects.toThrow(SignInRefused)
    expect(established).toBe(0)
  })

  it('says nothing about whether the account exists', async () => {
    const refusal = new SignInRefused('not-admitted')
    expect(refusal.message).toBe('this account may not use this deployment')
  })

  it('offers each mounted channel to a surface', async () => {
    const ctx = await harness(ADA)
    ctx.signIn.register(channel(SUBJECT))
    ctx.signIn.register(channel(SUBJECT, channelId('wecom')))
    expect(ctx.signIn.available().map(({ id }) => id)).toEqual(['microsoft-entra', 'wecom'])
  })

  it('rejects two channels claiming one id', async () => {
    const ctx = await harness(ADA)
    ctx.signIn.register(channel(SUBJECT))
    expect(() => ctx.signIn.register(channel(SUBJECT))).toThrow(/already registered/u)
  })

  it('stops offering a channel whose plugin withdrew it', async () => {
    const ctx = await harness(ADA)
    const dispose = ctx.signIn.register(channel(SUBJECT))
    await dispose()
    expect(ctx.signIn.available()).toHaveLength(0)
  })

  it('stops offering a channel whose plugin was unloaded', async () => {
    const ctx = await harness(ADA)
    // The registering plugin owns the registration without holding the
    // disposer: `register` runs on the caller's own fiber, so unloading the
    // channel plugin is what a deployment reloading one actually does.
    const fiber = ctx.plugin({
      name: 'test-channel',
      inject: ['signIn'],
      apply: (inner: Context) => { void inner.signIn.register(channel(SUBJECT)) },
    })
    await fiber.await()
    expect(ctx.signIn.available()).toHaveLength(1)
    await fiber.dispose()
    expect(ctx.signIn.available()).toHaveLength(0)
  })
})
