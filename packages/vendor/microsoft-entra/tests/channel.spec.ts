/**
 * Entra ID as a redirect channel: where it sends the browser, what it accepts
 * on the way back, and what it refuses.
 */

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@lyness/cordis'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Storage from '@lyness/lyn-storage'
import * as StorageDomain from '@lyness/lyn-storage-domain'
import * as StorageJson from '@lyness/lyn-storage-json'
import { brandString } from '@lyness/lyn-brand'
import type { PersonId } from '@lyness/lyn-people'
import StoredAuthSessions from '@lyness/lyn-auth-session/store'
import SignIn from '@lyness/lyn-sign-in'
import RosterAdmission from '@lyness/lyn-sign-in/admission-roster'
import * as EntraChannelPlugin from '../src/channel.ts'
import {
  CHANNEL_ID, DEFAULT_ATTEMPT_TTL_MS, EntraChannel, asExternalSubject, resolveAttemptTtl,
} from '../src/channel.ts'

const DIRECTORY = 'contoso.onmicrosoft.com'
const RETURN_TO = 'https://lyness.example/oauth/callback/microsoft-entra'

/**
 * The configuration fields these tests set, as a plain record: the package's
 * own `Config` name is shared with its schema, and spreading that resolves to
 * the schema class rather than to the fields.
 */
interface Options {
  readonly directory: string
  readonly clientId: string
  readonly attemptTtlMs?: number
}

const BASE: Options = {
  directory: DIRECTORY,
  clientId: '00000000-0000-0000-0000-000000000000',
}

function channel(over: Partial<Options> = {}): EntraChannel {
  return new EntraChannel({ ...BASE, ...over })
}

/** One directory answering both network steps, so no real request is made. */
function directoryAnswering(me: Record<string, unknown>): void {
  vi.stubGlobal('fetch', vi.fn((input: URL | string) => {
    const url = String(input)
    if (url.includes('/oauth2/v2.0/token')) {
      return Promise.resolve(Response.json({
        access_token: 'at', token_type: 'Bearer', expires_in: 3600,
      }))
    }
    if (url.includes('/v1.0/me')) return Promise.resolve(Response.json(me))
    throw new Error(`unexpected request to ${url}`)
  }))
}

beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }) })
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('resolveAttemptTtl', () => {
  it('remembers an attempt for ten minutes by default', () => {
    expect(resolveAttemptTtl(BASE)).toBe(DEFAULT_ATTEMPT_TTL_MS)
  })

  it('takes the stated lifetime when a deployment states one', () => {
    expect(resolveAttemptTtl({ ...BASE, attemptTtlMs: 30_000 })).toBe(30_000)
  })
})

describe('asExternalSubject', () => {
  it('names the directory as the issuer and the object id as the subject', () => {
    expect(asExternalSubject({ objectId: '7a1f', directoryId: DIRECTORY })).toEqual({
      channel: CHANNEL_ID,
      issuer: DIRECTORY,
      subject: '7a1f',
    })
  })

  it('carries a name and an address when the directory publishes them', () => {
    const subject = asExternalSubject({
      objectId: '7a1f', directoryId: DIRECTORY, displayName: 'Ada', address: 'ada@contoso.com',
    })
    expect(subject).toMatchObject({ displayName: 'Ada', address: 'ada@contoso.com' })
  })
})

describe('EntraChannel.start', () => {
  it('offers itself as a redirect channel', () => {
    expect(channel().kind).toBe('redirect')
  })

  it('sends the browser to the configured directory', async () => {
    const { to } = await channel().start(RETURN_TO)
    expect(to).toContain(`https://login.microsoftonline.com/${DIRECTORY}/oauth2/v2.0/authorize`)
  })

  it('names the deployment own callback as the redirect', async () => {
    const { to } = await channel().start(RETURN_TO)
    expect(new URL(to).searchParams.get('redirect_uri')).toBe(RETURN_TO)
  })

  it('binds the attempt to the state the directory will echo', async () => {
    const { to, attempt } = await channel().start(RETURN_TO)
    expect(new URL(to).searchParams.get('state')).toBe(attempt)
  })

  it('gives two sign-ins different attempts', async () => {
    const entra = channel()
    const first = await entra.start(RETURN_TO)
    const second = await entra.start(RETURN_TO)
    expect(first.attempt).not.toBe(second.attempt)
  })

  it('asks for a code the server can read, not a fragment', async () => {
    const { to } = await channel().start(RETURN_TO)
    expect(new URL(to).searchParams.get('response_mode')).toBe('query')
  })
})

describe('EntraChannel.complete', () => {
  it('reports the person the directory names', async () => {
    directoryAnswering({ id: '7a1f', displayName: 'Ada Lovelace', userPrincipalName: 'ada@contoso.com' })
    const entra = channel()
    const { attempt } = await entra.start(RETURN_TO)
    await expect(entra.complete(new URLSearchParams({ state: attempt, code: 'c' }))).resolves.toEqual({
      channel: CHANNEL_ID,
      issuer: DIRECTORY,
      subject: '7a1f',
      displayName: 'Ada Lovelace',
      address: 'ada@contoso.com',
    })
  })

  it('completes no sign-in when the directory returns an error instead of a code', async () => {
    const entra = channel()
    const { attempt } = await entra.start(RETURN_TO)
    await expect(entra.complete(new URLSearchParams({ state: attempt, error: 'access_denied' })))
      .resolves.toBeUndefined()
  })

  it('completes no sign-in when the return carries no state', async () => {
    await expect(channel().complete(new URLSearchParams({ code: 'c' }))).resolves.toBeUndefined()
  })

  it('completes no sign-in for a state this process never issued', async () => {
    await expect(channel().complete(new URLSearchParams({ state: 'forged', code: 'c' })))
      .resolves.toBeUndefined()
  })

  it('spends one callback only once', async () => {
    directoryAnswering({ id: '7a1f' })
    const entra = channel()
    const { attempt } = await entra.start(RETURN_TO)
    const query = new URLSearchParams({ state: attempt, code: 'c' })
    await expect(entra.complete(query)).resolves.toMatchObject({ subject: '7a1f' })
    await expect(entra.complete(query)).resolves.toBeUndefined()
  })

  it('forgets an attempt nobody came back from', async () => {
    const entra = channel({ attemptTtlMs: 30_000 })
    const { attempt } = await entra.start(RETURN_TO)
    vi.advanceTimersByTime(30_001)
    await expect(entra.complete(new URLSearchParams({ state: attempt, code: 'c' })))
      .resolves.toBeUndefined()
  })

  it('does not accumulate attempts nobody finished', async () => {
    const entra = channel({ attemptTtlMs: 30_000 })
    const stale = await entra.start(RETURN_TO)
    vi.advanceTimersByTime(30_001)
    // Starting another sign-in is what sweeps the lapsed one, so the stale
    // state is gone even before its own callback is tried.
    await entra.start(RETURN_TO)
    await expect(entra.complete(new URLSearchParams({ state: stale.attempt, code: 'c' })))
      .resolves.toBeUndefined()
  })

  it('reports the refusal the directory gave rather than failing silently', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(
      Response.json({ error: 'invalid_grant' }, { status: 400 }),
    )))
    const entra = channel()
    const { attempt } = await entra.start(RETURN_TO)
    await expect(entra.complete(new URLSearchParams({ state: attempt, code: 'c' })))
      .rejects.toThrow(/invalid_grant/u)
  })
})

describe('mounted as a channel', () => {
  it('signs a bound person in through the real sign-in flow', async () => {
    directoryAnswering({ id: '7a1f', displayName: 'Ada Lovelace' })
    const root = mkdtempSync(join(tmpdir(), 'lyn-entra-channel-'))
    const ctx = new Context()
    try {
      await ctx.plugin(Storage)
      await ctx.plugin(StorageJson, { root })
      await ctx.plugin(StorageDomain, { backend: 'json' })
      await ctx.plugin(StoredAuthSessions, {}).await()
      await ctx.plugin(RosterAdmission, {
        bindings: [{ channel: 'microsoft-entra', issuer: DIRECTORY, subject: '7a1f', person: 'ada' }],
      }).await()
      await ctx.plugin(SignIn, {}).await()
      await ctx.plugin(EntraChannelPlugin, BASE).await()

      expect(ctx.signIn.available()).toEqual([
        { id: CHANNEL_ID, displayName: 'Microsoft Entra ID', kind: 'redirect' },
      ])
      const started = await ctx.signIn.begin(CHANNEL_ID, RETURN_TO)
      if (started.kind !== 'redirect') throw new Error('expected a redirect')
      const state = new URL(started.start.to).searchParams.get('state') ?? ''
      const id = await ctx.signIn.resume(CHANNEL_ID, new URLSearchParams({ state, code: 'c' }))
      expect((await ctx.authSessions.read(id)).person).toBe(brandString<PersonId>('ada'))
    } finally {
      await ctx.fiber.dispose()
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('admits nobody the deployment did not bind', async () => {
    directoryAnswering({ id: 'unknown-person' })
    const root = mkdtempSync(join(tmpdir(), 'lyn-entra-channel-'))
    const ctx = new Context()
    try {
      await ctx.plugin(Storage)
      await ctx.plugin(StorageJson, { root })
      await ctx.plugin(StorageDomain, { backend: 'json' })
      await ctx.plugin(StoredAuthSessions, {}).await()
      await ctx.plugin(RosterAdmission, { bindings: [] }).await()
      await ctx.plugin(SignIn, {}).await()
      await ctx.plugin(EntraChannelPlugin, BASE).await()

      const started = await ctx.signIn.begin(CHANNEL_ID, RETURN_TO)
      if (started.kind !== 'redirect') throw new Error('expected a redirect')
      const state = new URL(started.start.to).searchParams.get('state') ?? ''
      await expect(ctx.signIn.resume(CHANNEL_ID, new URLSearchParams({ state, code: 'c' })))
        .rejects.toMatchObject({ code: 'not-admitted' })
    } finally {
      await ctx.fiber.dispose()
      rmSync(root, { recursive: true, force: true })
    }
  })
})
