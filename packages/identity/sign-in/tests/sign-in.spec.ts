/**
 * Signing in through a channel: what each refusal looks like, and what a
 * successful sign-in leaves behind.
 */

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import Storage from '@deepseek-ai/dsh-storage'
import * as StorageDomain from '@deepseek-ai/dsh-storage-domain'
import * as StorageJson from '@deepseek-ai/dsh-storage-json'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { PersonId } from '@deepseek-ai/dsh-people'
import type { AuthSessionId } from '@deepseek-ai/dsh-auth-session'
import StoredAuthSessions from '@deepseek-ai/dsh-auth-session/store'
import { afterEach, describe, expect, it } from 'vitest'
import SignIn, { DEFAULT_LIFETIME_MS, SignInRefused, channelId, resolveConfig } from '../src/index.ts'
import type { Config, SignInChannel } from '../src/index.ts'
import { SignInAdmission } from '../src/admission.ts'
import type { ExternalSubject } from '../src/types.ts'

const ADA = brandString<PersonId>('ada')
const ENTRA = channelId('microsoft-entra')
// A self-driven channel ignores the callback address; the tests pass one
// anyway so the call reads the same for both shapes.
const UNUSED_CALLBACK = 'https://DeepSeek Harness.example/callback'

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
    kind: 'self-driven',
    id,
    displayName: 'Microsoft Entra ID',
    authenticate: () => Promise.resolve(outcome),
  }
}

/** A redirect channel standing in for a directory the browser leaves for. */
function redirecting(outcome: ExternalSubject | undefined, id = ENTRA): SignInChannel {
  return {
    kind: 'redirect',
    id,
    displayName: 'Microsoft Entra ID',
    start: (returnTo: string) => Promise.resolve({ to: `https://login.example/?redirect_uri=${returnTo}`, attempt: 'a1' }),
    complete: (parameters: URLSearchParams) =>
      Promise.resolve(parameters.get('code') === null ? undefined : outcome),
  }
}

/** The session a self-driven sign-in produced, or a failure naming the other shape. */
async function sessionFrom(ctx: Context, id = ENTRA): Promise<AuthSessionId> {
  const outcome = await ctx.signIn.begin(id, UNUSED_CALLBACK)
  if (outcome.kind !== 'session') throw new Error('expected a session, got a redirect')
  return outcome.session
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
  const root = mkdtempSync(join(tmpdir(), 'dsh-sign-in-'))
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
    const session = await ctx.authSessions.read(await sessionFrom(ctx))
    expect(session.person).toBe(ADA)
  })

  it('records which channel proved who they are', async () => {
    const ctx = await harness(ADA)
    ctx.signIn.register(channel(SUBJECT))
    const session = await ctx.authSessions.read(await sessionFrom(ctx))
    expect(session.method).toBe('sign-in:microsoft-entra')
  })

  it('opens on the personal context rather than on a standing', async () => {
    const ctx = await harness(ADA)
    ctx.signIn.register(channel(SUBJECT))
    const session = await ctx.authSessions.read(await sessionFrom(ctx))
    expect(session.acting.membership).toBeUndefined()
  })

  it('lapses after the term the deployment stated', async () => {
    const ctx = await harness(ADA, { lifetimeMs: 60_000 })
    ctx.signIn.register(channel(SUBJECT))
    const session = await ctx.authSessions.read(await sessionFrom(ctx))
    const lifetime = Date.parse(session.expiresAt ?? '') - Date.parse(session.establishedAt)
    expect(lifetime).toBe(60_000)
  })

  it('refuses a channel nobody mounted', async () => {
    const ctx = await harness(ADA)
    await expect(ctx.signIn.begin(channelId('wecom'), UNUSED_CALLBACK))
      .rejects.toMatchObject({ code: 'channel-unknown' })
  })

  it('refuses a sign-in the directory did not complete', async () => {
    const ctx = await harness(ADA)
    ctx.signIn.register(channel(undefined))
    await expect(ctx.signIn.begin(ENTRA, UNUSED_CALLBACK))
      .rejects.toMatchObject({ code: 'not-authenticated' })
  })

  it('refuses a verified subject this deployment admits as nobody', async () => {
    const ctx = await harness(undefined)
    ctx.signIn.register(channel(SUBJECT))
    await expect(ctx.signIn.begin(ENTRA, UNUSED_CALLBACK))
      .rejects.toMatchObject({ code: 'not-admitted' })
  })

  it('establishes nothing when admission refuses', async () => {
    const ctx = await harness(undefined)
    ctx.signIn.register(channel(SUBJECT))
    let established = 0
    const store = ctx.authSessions
    const real = store.establish.bind(store)
    store.establish = async (request) => { established += 1; return real(request) }
    await expect(ctx.signIn.begin(ENTRA, UNUSED_CALLBACK)).rejects.toThrow(SignInRefused)
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
    expect(ctx.signIn.available()).toEqual([
      { id: 'microsoft-entra', displayName: 'Microsoft Entra ID', kind: 'self-driven' },
      { id: 'wecom', displayName: 'Microsoft Entra ID', kind: 'self-driven' },
    ])
  })

  it('tells a surface which shape each channel signs in with', async () => {
    const ctx = await harness(ADA)
    ctx.signIn.register(redirecting(SUBJECT))
    expect(ctx.signIn.available().map(({ kind }) => kind)).toEqual(['redirect'])
  })

  it('sends the browser to the directory for a redirect channel', async () => {
    const ctx = await harness(ADA)
    ctx.signIn.register(redirecting(SUBJECT))
    const outcome = await ctx.signIn.begin(ENTRA, 'https://DeepSeek Harness.example/callback')
    expect(outcome).toEqual({
      kind: 'redirect',
      start: { to: 'https://login.example/?redirect_uri=https://DeepSeek Harness.example/callback', attempt: 'a1' },
    })
  })

  it('establishes nothing until the directory returns', async () => {
    const ctx = await harness(ADA)
    ctx.signIn.register(redirecting(SUBJECT))
    await ctx.signIn.begin(ENTRA, 'https://DeepSeek Harness.example/callback')
    const id = await ctx.signIn.resume(ENTRA, new URLSearchParams({ code: 'c' }))
    expect((await ctx.authSessions.read(id)).person).toBe(ADA)
  })

  it('refuses a return that completes no sign-in', async () => {
    const ctx = await harness(ADA)
    ctx.signIn.register(redirecting(SUBJECT))
    await expect(ctx.signIn.resume(ENTRA, new URLSearchParams({ error: 'access_denied' })))
      .rejects.toMatchObject({ code: 'not-authenticated' })
  })

  it('admits a redirect sign-in by the same rule as a self-driven one', async () => {
    const ctx = await harness(undefined)
    ctx.signIn.register(redirecting(SUBJECT))
    await expect(ctx.signIn.resume(ENTRA, new URLSearchParams({ code: 'c' })))
      .rejects.toMatchObject({ code: 'not-admitted' })
  })

  it('has nothing to resume for a channel that drives itself', async () => {
    const ctx = await harness(ADA)
    ctx.signIn.register(channel(SUBJECT))
    await expect(ctx.signIn.resume(ENTRA, new URLSearchParams()))
      .rejects.toMatchObject({ code: 'nothing-to-resume' })
  })

  it('refuses to resume a channel nobody mounted', async () => {
    const ctx = await harness(ADA)
    await expect(ctx.signIn.resume(channelId('wecom'), new URLSearchParams()))
      .rejects.toMatchObject({ code: 'channel-unknown' })
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
