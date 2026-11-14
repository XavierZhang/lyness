/**
 * One sign-in round trip against a stubbed provider: what discovery is
 * believed, what start hands the browser, what complete makes of the return,
 * and every way a return does not produce a person.
 *
 * The security properties this file exists for: endpoints are the provider's
 * own and never configuration, a replayed callback finds nothing, two
 * sign-ins in flight keep their own PKCE verifier, and a provider reached
 * without TLS is refused before anything is sent.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { CHANNEL_ID, OidcChannel, OidcSignInError } from '../src/index.ts'
import type { Config as OidcConfig } from '../src/index.ts'
import { challengeOf } from '../src/protocol.ts'

const ISSUER = 'https://idp.example'
const RETURN_TO = 'https://dsh.example/oauth/callback/oidc'

/** Overrides a test may make to the fixture provider's configuration. */
interface Over {
  issuer?: string
  secret?: string
  organizationClaim?: string
  organizationParameter?: string
  organization?: string
}

/**
 * The fixture provider's configuration.
 * @param over - what this test changes.
 * @returns the configuration to mount.
 */
function config(over: Over = {}): OidcConfig {
  return {
    issuer: over.issuer ?? ISSUER,
    clientId: 'deepseek-harness-web',
    secret: over.secret ?? 'OIDC_CLIENT_SECRET',
    ...over.organizationClaim === undefined ? {} : { organizationClaim: over.organizationClaim },
    ...over.organizationParameter === undefined ? {} : { organizationParameter: over.organizationParameter },
    ...over.organization === undefined ? {} : { organization: over.organization },
  }
}

/** One stubbed provider: a reply per path, and the calls it saw. */
interface Provider {
  readonly calls: { path: string; body?: string; authorization?: string }[]
  reply: (path: string) => { status?: number; body?: unknown; throws?: string }
}

const live: Context[] = []
let provider: Provider

/** The discovery document the fixture provider publishes. */
function discovery(issuer = ISSUER): Record<string, string> {
  return {
    issuer,
    authorization_endpoint: `${issuer}/authorize`,
    token_endpoint: `${issuer}/token`,
    userinfo_endpoint: `${issuer}/userinfo`,
  }
}

beforeEach(() => {
  provider = {
    calls: [],
    reply: (path) => {
      if (path.endsWith('/.well-known/openid-configuration')) return { body: discovery() }
      if (path.endsWith('/token')) return { body: { access_token: 'tok', token_type: 'Bearer', expires_in: 300 } }
      return { body: { sub: 'person-1', name: 'Ada', email: 'ada@acme.example', org: { id: 'acme' } } }
    },
  }
  vi.stubGlobal('fetch', (input: URL | string, init?: RequestInit) => {
    const url = new URL(String(input))
    const headers = init?.headers as Record<string, string> | undefined
    provider.calls.push({
      path: url.pathname,
      ...typeof init?.body === 'string' ? { body: init.body } : {},
      ...headers?.['authorization'] === undefined ? {} : { authorization: headers['authorization'] },
    })
    const answer = provider.reply(url.pathname)
    if (answer.throws !== undefined) return Promise.reject(new Error(answer.throws))
    return Promise.resolve({
      ok: (answer.status ?? 200) < 400,
      status: answer.status ?? 200,
      json: () => answer.body === undefined ? Promise.reject(new Error('not JSON')) : Promise.resolve(answer.body),
    } as Response)
  })
})

afterEach(async () => {
  vi.unstubAllGlobals()
  for (const ctx of live.splice(0)) await ctx.fiber.dispose()
})

/** A channel over a credential store that answers with one secret. */
function channel(secret: string | null = 'the-secret', over: Over = {}): OidcChannel {
  const ctx = new Context()
  live.push(ctx)
  ctx.provide('credentials', {
    resolve: () => Promise.resolve(secret === null ? undefined : { value: secret }),
  })
  return new OidcChannel(ctx, config(over))
}

describe('the provider a channel trusts', () => {
  it('refuses a provider reached without TLS, before anything is sent', () => {
    expect(() => channel('s', { issuer: 'http://idp.example' })).toThrow('must be https')
    expect(provider.calls).toEqual([])
  })

  it('allows loopback without TLS, which is where one runs while somebody develops', () => {
    expect(() => channel('s', { issuer: 'http://localhost:8080' })).not.toThrow()
  })

  it('refuses a document whose issuer is not the one that was asked', async () => {
    provider.reply = () => ({ body: discovery('https://evil.example') })
    await expect(channel().start(RETURN_TO)).rejects.toThrow('calls itself')
  })

  it('takes every endpoint from the document rather than from configuration', async () => {
    const subject = channel()
    const { to } = await subject.start(RETURN_TO)
    expect(new URL(to).origin + new URL(to).pathname).toBe(`${ISSUER}/authorize`)
    expect(provider.calls[0]?.path).toBe('/.well-known/openid-configuration')
  })

  it('reads the document once and reuses it for later sign-ins', async () => {
    const subject = channel()
    await subject.start(RETURN_TO)
    await subject.start(RETURN_TO)
    expect(provider.calls.filter(call => call.path.includes('openid-configuration'))).toHaveLength(1)
  })
})

describe('starting one sign-in', () => {
  it('sends the browser to the provider with the attempt it issued and an S256 challenge', async () => {
    const subject = channel()
    const { to, attempt } = await subject.start(RETURN_TO)
    const url = new URL(to)
    expect(url.searchParams.get('state')).toBe(attempt)
    expect(url.searchParams.get('redirect_uri')).toBe(RETURN_TO)
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('scope')).toBe('openid profile email')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/u)
  })

  it('asks for one organization\'s own page when the deployment named the parameter', async () => {
    const subject = channel('s', { organization: 'acme', organizationParameter: 'organization_id' })
    const { to } = await subject.start(RETURN_TO)
    expect(new URL(to).searchParams.get('organization_id')).toBe('acme')
  })
})

describe('finishing one sign-in', () => {
  it('reports the person by the issuer and the sub that survive a rename', async () => {
    const subject = channel()
    const { attempt } = await subject.start(RETURN_TO)
    expect(await subject.complete(new URLSearchParams({ state: attempt, code: 'the-code' }))).toEqual({
      channel: CHANNEL_ID,
      issuer: ISSUER,
      subject: 'person-1',
      displayName: 'Ada',
      address: 'ada@acme.example',
    })
  })

  it('repeats the attempt\'s own verifier and callback in the exchange', async () => {
    const subject = channel()
    const { to, attempt } = await subject.start(RETURN_TO)
    const challenge = new URL(to).searchParams.get('code_challenge')
    await subject.complete(new URLSearchParams({ state: attempt, code: 'the-code' }))
    const exchange = provider.calls.find(call => call.path.endsWith('/token'))
    const body = new URLSearchParams(exchange?.body ?? '')
    expect(body.get('grant_type')).toBe('authorization_code')
    expect(body.get('redirect_uri')).toBe(RETURN_TO)
    expect(body.get('client_secret')).toBe('the-secret')
    expect(challengeOf(body.get('code_verifier') ?? '')).toBe(challenge)
  })

  it('reads the person with the access token the exchange returned', async () => {
    const subject = channel()
    const { attempt } = await subject.start(RETURN_TO)
    await subject.complete(new URLSearchParams({ state: attempt, code: 'the-code' }))
    expect(provider.calls.find(call => call.path.endsWith('/userinfo'))?.authorization).toBe('Bearer tok')
  })

  it('keeps two sign-ins in flight apart, each with its own verifier', async () => {
    // The failure this pins: a verifier kept on the instance would make the
    // second start overwrite the first, and the first person's exchange would
    // present the wrong one.
    const subject = channel()
    const first = await subject.start(RETURN_TO)
    const second = await subject.start(RETURN_TO)
    const challenges = [first, second].map(start => new URL(start.to).searchParams.get('code_challenge'))
    expect(challenges[0]).not.toBe(challenges[1])
    await subject.complete(new URLSearchParams({ state: first.attempt, code: 'first-code' }))
    const firstVerifier = new URLSearchParams(provider.calls.at(-2)?.body ?? '').get('code_verifier')
    expect(challengeOf(firstVerifier ?? '')).toBe(challenges[0])
  })

  it('names the organization from the claim the deployment chose, nested path included', async () => {
    const subject = channel('s', { organizationClaim: 'org.id' })
    const { attempt } = await subject.start(RETURN_TO)
    // The subject carries the organization through admission rather than on
    // the external subject, so this asserts the claim was found at all.
    expect(await subject.complete(new URLSearchParams({ state: attempt, code: 'c' }))).toMatchObject({
      subject: 'person-1',
    })
  })

  it.each([
    ['no state', { code: 'the-code' }],
    ['no code', { state: 'whatever' }],
    ['a state nobody started', { state: 'not-an-attempt', code: 'the-code' }],
  ])('completes nothing on a return with %s', async (_case, parameters) => {
    const subject = channel()
    await subject.start(RETURN_TO)
    expect(await subject.complete(new URLSearchParams(parameters))).toBeUndefined()
  })

  it('spends the attempt, so a replayed callback link finds nothing', async () => {
    const subject = channel()
    const { attempt } = await subject.start(RETURN_TO)
    const query = new URLSearchParams({ state: attempt, code: 'the-code' })
    expect(await subject.complete(query)).toMatchObject({ subject: 'person-1' })
    expect(await subject.complete(query)).toBeUndefined()
  })
})

describe('what a refusal says', () => {
  it('carries the provider\'s own OAuth error', async () => {
    const subject = channel()
    const { attempt } = await subject.start(RETURN_TO)
    provider.reply = path => path.endsWith('/token')
      ? { status: 400, body: { error: 'invalid_grant', error_description: 'code already used' } }
      : { body: discovery() }
    const refusal = await subject.complete(new URLSearchParams({ state: attempt, code: 'the-code' }))
      .catch((error: unknown) => error)
    expect(refusal).toBeInstanceOf(OidcSignInError)
    expect((refusal as OidcSignInError).code).toBe('invalid_grant')
    expect((refusal as Error).message).toContain('code already used')
  })

  it('names the credential when the store holds no client secret', async () => {
    const subject = channel(null)
    const { attempt } = await subject.start(RETURN_TO)
    await expect(subject.complete(new URLSearchParams({ state: attempt, code: 'c' })))
      .rejects.toThrow('holds no client secret')
  })

  it('says the provider could not be reached when the request throws', async () => {
    const subject = channel()
    provider.reply = () => ({ throws: 'ECONNREFUSED' })
    await expect(subject.start(RETURN_TO)).rejects.toThrow('could not be reached')
  })

  it('says so when an accepted answer is not JSON', async () => {
    const subject = channel()
    provider.reply = () => ({ status: 200 })
    await expect(subject.start(RETURN_TO)).rejects.toThrow('was not JSON')
  })

  it('reports the status when a refusal carries no readable body', async () => {
    const subject = channel()
    provider.reply = () => ({ status: 503 })
    await expect(subject.start(RETURN_TO)).rejects.toThrow('the provider answered 503')
  })

  it('reports the status when a refusal body names no OAuth error', async () => {
    const subject = channel()
    provider.reply = () => ({ status: 500, body: { unrelated: true } })
    await expect(subject.start(RETURN_TO)).rejects.toThrow('the provider answered 500')
  })

  it('says the answer was unreadable when a reply is missing what it must carry', async () => {
    const subject = channel()
    provider.reply = () => ({ body: { authorization_endpoint: `${ISSUER}/authorize` } })
    await expect(subject.start(RETURN_TO)).rejects.toThrow('unreadable answer')
  })

  it('refuses to complete a sign-in before the provider has been discovered', async () => {
    const subject = channel()
    // `complete` is reachable without `start` when a callback link is opened
    // on a process that has never served this channel's authorization.
    expect(await subject.complete(new URLSearchParams({ state: 'x', code: 'c' }))).toBeUndefined()
  })

  it('reports the bare OAuth error when a refusal carries no description', async () => {
    const subject = channel()
    provider.reply = () => ({ status: 400, body: { error: 'invalid_client' } })
    await expect(subject.start(RETURN_TO)).rejects.toThrow('invalid_client')
  })

  it('reports the status when a refusal body is not an object at all', async () => {
    const subject = channel()
    provider.reply = () => ({ status: 502, body: 'gateway text' })
    await expect(subject.start(RETURN_TO)).rejects.toThrow('the provider answered 502')
  })

  it('accepts an issuer whose trailing slash the document omits', async () => {
    const subject = channel('s', { issuer: `${ISSUER}/` })
    provider.reply = path => path.endsWith('/.well-known/openid-configuration')
      ? { body: discovery() }
      : { body: { access_token: 'tok' } }
    await expect(subject.start(RETURN_TO)).resolves.toMatchObject({ attempt: expect.any(String) as string })
  })

  it('says the provider could not be reached when something that is not an Error is thrown', async () => {
    const subject = channel()
    // The case under test is a rejection that is not an Error, so the value
    // reaches the rejection as `unknown` rather than as a string literal.
    const thrown: unknown = 'a string, not an Error'
    vi.stubGlobal('fetch', () => { throw thrown })
    await expect(subject.start(RETURN_TO)).rejects.toThrow('a string, not an Error')
  })

  it('reports a person whose directory publishes neither a name nor an address', async () => {
    // `sub` is the only claim this integration requires: a sign-in that
    // demanded a name would refuse somebody whose directory holds none.
    const subject = channel()
    const { attempt } = await subject.start(RETURN_TO)
    provider.reply = path => path.endsWith('/token')
      ? { body: { access_token: 'tok' } }
      : { body: { sub: 'person-1' } }
    expect(await subject.complete(new URLSearchParams({ state: attempt, code: 'c' })))
      .toEqual({ channel: CHANNEL_ID, issuer: ISSUER, subject: 'person-1' })
  })

  it('falls back to the preferred username when the provider publishes no name', async () => {
    const subject = channel()
    const { attempt } = await subject.start(RETURN_TO)
    provider.reply = path => path.endsWith('/token')
      ? { body: { access_token: 'tok' } }
      : { body: { sub: 'person-1', preferred_username: 'ada' } }
    expect(await subject.complete(new URLSearchParams({ state: attempt, code: 'c' })))
      .toEqual({ channel: CHANNEL_ID, issuer: ISSUER, subject: 'person-1', displayName: 'ada' })
  })
})
