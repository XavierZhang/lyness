/**
 * Microsoft Entra sign-in: the request shapes it sends, the answers it accepts,
 * and one complete browser round trip through the real authorization,
 * credential, and loopback-server services.
 */

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@lyness/cordis'
import WebServer from '@lyness/lyn-host-webserver'
import AuthorizationService from '@lyness/lyn-authorization'
import type { AuthorizationNotice } from '@lyness/lyn-authorization'
import { LocalCredentialProvider } from '@lyness/lyn-credentials-local'
import MicrosoftEntra, {
  DEFAULT_AUTHORITY_HOST, DEFAULT_GRAPH_ORIGIN, DEFAULT_REDIRECT_PATH, DEFAULT_SCOPES,
  ENTRA_CREDENTIAL_KEY, EntraSignInError, createSecrets, resolveConfig, stateMatches,
} from '../src/index.ts'
import type { EntraGrant } from '../src/index.ts'
import {
  authorizeUrl, graphMeSchema, subjectFromGraph, tokenEndpoint, tokenErrorSchema,
  tokenRequestBody, tokenResponseSchema,
} from '../src/protocol.ts'

const cleanups: (() => Promise<unknown>)[] = []
afterEach(async () => {
  vi.unstubAllGlobals()
  while (cleanups.length > 0) await cleanups.pop()?.()
})

const CONFIG = { directory: 'contoso.onmicrosoft.com', clientId: 'app-client-id' }
const RESOLVED = resolveConfig(CONFIG)
const SECRETS = {
  verifier: 'verifier-value', challenge: 'challenge-value', state: 'state-value', nonce: 'nonce-value',
}

describe('the resolved configuration', () => {
  it('applies the public-cloud defaults', () => {
    expect(RESOLVED).toEqual({
      directory: 'contoso.onmicrosoft.com',
      clientId: 'app-client-id',
      authorityHost: DEFAULT_AUTHORITY_HOST,
      graphOrigin: DEFAULT_GRAPH_ORIGIN,
      scopes: [...DEFAULT_SCOPES],
      redirectPath: DEFAULT_REDIRECT_PATH,
      attemptTimeoutMs: 300_000,
      requestTimeoutMs: 20_000,
    })
  })

  it('keeps every value a sovereign cloud names', () => {
    expect(resolveConfig({
      ...CONFIG,
      authorityHost: 'login.partner.microsoftonline.cn',
      graphOrigin: 'https://microsoftgraph.chinacloudapi.cn',
      scopes: ['openid', 'User.Read'],
      redirectPath: '/cb',
      attemptTimeoutMs: 60_000,
      requestTimeoutMs: 5000,
    })).toMatchObject({
      authorityHost: 'login.partner.microsoftonline.cn',
      graphOrigin: 'https://microsoftgraph.chinacloudapi.cn',
      redirectPath: '/cb',
    })
  })

  it('trims a trailing slash from the Graph origin', () => {
    expect(resolveConfig({ ...CONFIG, graphOrigin: 'https://graph.microsoft.com/' }).graphOrigin)
      .toBe('https://graph.microsoft.com')
  })

  it('refuses a Graph origin that is not https', () => {
    expect(() => resolveConfig({ ...CONFIG, graphOrigin: 'http://graph.example' }))
      .toThrow('graphOrigin must be an https origin')
  })

  it('refuses a scope list that could not read the signed-in person', () => {
    // The sign-in would succeed and `/me` would then fail, after the person
    // already used their browser.
    expect(() => resolveConfig({ ...CONFIG, scopes: ['openid', 'profile'] }))
      .toThrow('must include User.Read')
  })
})

describe('the OIDC requests', () => {
  it('asks the directory for a code with PKCE, state, and a nonce', () => {
    const url = authorizeUrl(RESOLVED, SECRETS, 'http://127.0.0.1:7391/cb')
    expect(url.origin).toBe(`https://${DEFAULT_AUTHORITY_HOST}`)
    expect(url.pathname).toBe('/contoso.onmicrosoft.com/oauth2/v2.0/authorize')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: 'app-client-id',
      response_type: 'code',
      response_mode: 'query',
      redirect_uri: 'http://127.0.0.1:7391/cb',
      scope: DEFAULT_SCOPES.join(' '),
      state: 'state-value',
      nonce: 'nonce-value',
      code_challenge: 'challenge-value',
      code_challenge_method: 'S256',
    })
  })

  it('addresses the token endpoint of the configured directory', () => {
    expect(tokenEndpoint(RESOLVED).toString())
      .toBe(`https://${DEFAULT_AUTHORITY_HOST}/contoso.onmicrosoft.com/oauth2/v2.0/token`)
  })

  it('sends the verifier only when redeeming the code', () => {
    const body = tokenRequestBody(RESOLVED, SECRETS, 'http://127.0.0.1:7391/cb', 'the-code')
    expect(Object.fromEntries(body)).toEqual({
      client_id: 'app-client-id',
      grant_type: 'authorization_code',
      code: 'the-code',
      redirect_uri: 'http://127.0.0.1:7391/cb',
      code_verifier: 'verifier-value',
      scope: DEFAULT_SCOPES.join(' '),
    })
    expect(authorizeUrl(RESOLVED, SECRETS, 'http://127.0.0.1:7391/cb').search)
      .not.toContain('verifier-value')
  })
})

describe('the answers the directory may give', () => {
  it('accepts a token response and ignores fields this build does not use', () => {
    const parsed = tokenResponseSchema.safeParse({
      access_token: 'at', token_type: 'Bearer', expires_in: 3599, id_token: 'ignored',
    })
    expect(parsed.success && parsed.data.access_token).toBe('at')
  })

  it('refuses a token response missing what the grant needs', () => {
    expect(tokenResponseSchema.safeParse({ token_type: 'Bearer', expires_in: 1 }).success).toBe(false)
    expect(tokenResponseSchema.safeParse({ access_token: 'at', token_type: 'Bearer', expires_in: 0 }).success)
      .toBe(false)
  })

  it('reads the directory\'s own refusal reason', () => {
    const parsed = tokenErrorSchema.safeParse({ error: 'invalid_grant', error_description: 'expired' })
    expect(parsed.success && parsed.data.error).toBe('invalid_grant')
    expect(tokenErrorSchema.safeParse({}).success).toBe(false)
  })

  it('takes the stable object id and prefers the principal name as the address', () => {
    expect(subjectFromGraph(graphMeSchema.parse({
      id: 'object-1', displayName: 'Ada', userPrincipalName: 'ada@contoso.com', mail: 'other@contoso.com',
    }), 'dir-1')).toEqual({
      objectId: 'object-1', directoryId: 'dir-1', displayName: 'Ada', address: 'ada@contoso.com',
    })
  })

  it('falls back to the mail address and omits names the directory withholds', () => {
    expect(subjectFromGraph(graphMeSchema.parse({ id: 'object-2', mail: 'only@contoso.com' }), 'dir-1'))
      .toEqual({ objectId: 'object-2', directoryId: 'dir-1', address: 'only@contoso.com' })
    expect(subjectFromGraph(graphMeSchema.parse({ id: 'object-3', displayName: null, userPrincipalName: null }), 'dir-1'))
      .toEqual({ objectId: 'object-3', directoryId: 'dir-1' })
  })

  it('refuses a person the directory describes without an id', () => {
    expect(graphMeSchema.safeParse({ displayName: 'Ada' }).success).toBe(false)
  })
})

describe('one attempt\'s single-use values', () => {
  it('derives a distinct challenge, state, and nonce for every attempt', () => {
    const first = createSecrets()
    const second = createSecrets()
    expect(first.verifier).not.toBe(second.verifier)
    expect(first.state).not.toBe(second.state)
    expect(first.nonce).not.toBe(second.nonce)
    expect(first.challenge).not.toBe(first.verifier)
  })

  it('matches a state only exactly', () => {
    expect(stateMatches('abc', 'abc')).toBe(true)
    expect(stateMatches('abc', 'abd')).toBe(false)
    expect(stateMatches('abc', 'ab')).toBe(false)
  })
})

/** Boot the real authorization, credential, and loopback services with Entra. */
async function harness(overrides: Record<string, unknown> = {}): Promise<{
  ctx: Context
  notices: AuthorizationNotice[]
  signIn: () => Promise<unknown>
}> {
  const home = await mkdtemp(join(tmpdir(), 'lyn-entra-'))
  cleanups.push(() => rm(home, { recursive: true, force: true }))
  const ctx = new Context()
  const web = ctx.plugin(WebServer, { host: '127.0.0.1', port: 0 })
  await web
  const credentials = ctx.plugin(LocalCredentialProvider, { path: join(home, 'credentials.yaml'), watch: false })
  await credentials
  const authorization = ctx.plugin(AuthorizationService)
  await authorization
  const entra = ctx.plugin(MicrosoftEntra, { ...CONFIG, attemptTimeoutMs: 5000, ...overrides })
  await entra
  cleanups.push(async () => { await ctx.fiber.dispose() })

  const notices: AuthorizationNotice[] = []
  const signIn = (): Promise<unknown> => ctx.authorization.begin({
    key: ENTRA_CREDENTIAL_KEY,
    interaction: {
      notify: (notice) => { notices.push(notice) },
      prompt: () => Promise.reject(new Error('this flow asks nothing')),
    },
  })
  return { ctx, notices, signIn }
}

/** Wait for the authorize URL the flow published, then act as the browser. */
async function visitCallback(
  ctx: Context,
  notices: AuthorizationNotice[],
  transform: (params: URLSearchParams) => URLSearchParams = params => params,
): Promise<Response> {
  for (let attempt = 0; attempt < 200 && notices.length === 0; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, 5))
  }
  const published = new URL(notices[0]?.url ?? '')
  const params = transform(new URLSearchParams({
    state: published.searchParams.get('state') ?? '',
    code: 'returned-code',
  }))
  const redirect = new URL(published.searchParams.get('redirect_uri') ?? '')
  return fetch(`http://127.0.0.1:${String(ctx.webServer.port)}${redirect.pathname}?${params.toString()}`)
}

describe('a browser sign-in', () => {
  it('redeems the code, reads the person from the directory, and commits the grant', async () => {
    const calls: string[] = []
    const realFetch = globalThis.fetch
    vi.stubGlobal('fetch', async (input: URL | string, init?: RequestInit) => {
      const url = String(input)
      calls.push(url)
      if (url.endsWith('/oauth2/v2.0/token')) {
        expect(typeof init?.body === 'string' ? init.body : '').toContain('code_verifier=')
        return new Response(JSON.stringify({
          access_token: 'the-access-token', token_type: 'Bearer', expires_in: 3600, refresh_token: 'the-refresh',
        }), { headers: { 'content-type': 'application/json' } })
      }
      if (url.endsWith('/v1.0/me')) {
        expect((init?.headers as Record<string, string>).authorization).toBe('Bearer the-access-token')
        return new Response(JSON.stringify({ id: 'object-1', displayName: 'Ada', userPrincipalName: 'ada@contoso.com' }),
          { headers: { 'content-type': 'application/json' } })
      }
      return realFetch(input, init)
    })

    const { ctx, notices, signIn } = await harness()
    const attempt = signIn()
    const browser = await visitCallback(ctx, notices)
    expect(browser.status).toBe(200)
    await attempt

    const record = await ctx.credentials.readRecord(ENTRA_CREDENTIAL_KEY)
    const grant = record?.kind === 'grant' ? record.payload as EntraGrant : undefined
    expect(grant?.subject).toEqual({
      objectId: 'object-1',
      directoryId: 'contoso.onmicrosoft.com',
      displayName: 'Ada',
      address: 'ada@contoso.com',
    })
    expect(grant?.refreshToken).toBe('the-refresh')
    expect(grant?.expiresAt).toBeGreaterThan(Date.now())
    expect(await ctx.microsoftEntra.subject()).toEqual(grant?.subject)
    expect(calls.some(url => url.endsWith('/oauth2/v2.0/token'))).toBe(true)
  })

  it('commits a grant without a refresh token when the directory grants none', async () => {
    const realFetch = globalThis.fetch
    vi.stubGlobal('fetch', async (input: URL | string, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/oauth2/v2.0/token')) {
        // No `offline_access` consent means no refresh token, and the grant
        // must still be committed rather than treated as incomplete.
        return new Response(JSON.stringify({ access_token: 'at', token_type: 'Bearer', expires_in: 120 }),
          { headers: { 'content-type': 'application/json' } })
      }
      if (url.endsWith('/v1.0/me')) {
        return new Response(JSON.stringify({ id: 'object-9' }), { headers: { 'content-type': 'application/json' } })
      }
      return realFetch(input, init)
    })
    const { ctx, notices, signIn } = await harness()
    const attempt = signIn()
    await visitCallback(ctx, notices)
    await attempt

    const record = await ctx.credentials.readRecord(ENTRA_CREDENTIAL_KEY)
    const grant = record?.kind === 'grant' ? record.payload as EntraGrant : undefined
    expect(grant?.refreshToken).toBeUndefined()
    expect(grant?.subject.objectId).toBe('object-9')
  })

  it('reports no subject before anyone has signed in', async () => {
    const { ctx } = await harness()
    expect(await ctx.microsoftEntra.subject()).toBeUndefined()
  })

  it('refuses a callback whose state does not match the attempt', async () => {
    const { ctx, notices, signIn } = await harness({ attemptTimeoutMs: 1000 })
    const attempt = signIn()
    const browser = await visitCallback(ctx, notices, (params) => {
      params.set('state', 'not-this-attempt')
      return params
    })
    expect(browser.status).toBe(400)
    await expect(attempt).rejects.toThrow()
  })

  it('refuses a callback carrying a repeated code', async () => {
    const { ctx, notices, signIn } = await harness({ attemptTimeoutMs: 1000 })
    const attempt = signIn()
    const browser = await visitCallback(ctx, notices, (params) => {
      params.append('code', 'second-code')
      return params
    })
    expect(browser.status).toBe(400)
    await expect(attempt).rejects.toThrow()
  })

  it('reports the directory\'s own reason when it refuses the code', async () => {
    const realFetch = globalThis.fetch
    vi.stubGlobal('fetch', async (input: URL | string, init?: RequestInit) => {
      if (String(input).endsWith('/oauth2/v2.0/token')) {
        return new Response(JSON.stringify({ error: 'invalid_grant', error_description: 'expired' }),
          { status: 400, headers: { 'content-type': 'application/json' } })
      }
      return realFetch(input, init)
    })
    const { ctx, notices, signIn } = await harness()
    const attempt = signIn()
    await visitCallback(ctx, notices)
    await expect(attempt).rejects.toThrow('invalid_grant')
  })

  it('reports a status when the refusal carries no reason this build can read', async () => {
    const realFetch = globalThis.fetch
    vi.stubGlobal('fetch', async (input: URL | string, init?: RequestInit) => {
      if (String(input).endsWith('/oauth2/v2.0/token')) {
        return new Response('{}', { status: 503, headers: { 'content-type': 'application/json' } })
      }
      return realFetch(input, init)
    })
    const { ctx, notices, signIn } = await harness()
    const attempt = signIn()
    await visitCallback(ctx, notices)
    await expect(attempt).rejects.toThrow('status 503')
  })

  it('refuses a token response it cannot read', async () => {
    const realFetch = globalThis.fetch
    vi.stubGlobal('fetch', async (input: URL | string, init?: RequestInit) => {
      if (String(input).endsWith('/oauth2/v2.0/token')) {
        return new Response(JSON.stringify({ token_type: 'Bearer' }),
          { headers: { 'content-type': 'application/json' } })
      }
      return realFetch(input, init)
    })
    const { ctx, notices, signIn } = await harness()
    const attempt = signIn()
    await visitCallback(ctx, notices)
    await expect(attempt).rejects.toThrow('token response this build cannot read')
  })

  it('reports a directory that will not describe the signed-in person', async () => {
    const realFetch = globalThis.fetch
    vi.stubGlobal('fetch', async (input: URL | string, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/oauth2/v2.0/token')) {
        return new Response(JSON.stringify({ access_token: 'at', token_type: 'Bearer', expires_in: 60 }),
          { headers: { 'content-type': 'application/json' } })
      }
      if (url.endsWith('/v1.0/me')) return new Response('nope', { status: 403 })
      return realFetch(input, init)
    })
    const { ctx, notices, signIn } = await harness()
    const attempt = signIn()
    await visitCallback(ctx, notices)
    await expect(attempt).rejects.toThrow('status 403')
  })

  it('refuses a person described in a form it cannot read', async () => {
    const realFetch = globalThis.fetch
    vi.stubGlobal('fetch', async (input: URL | string, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/oauth2/v2.0/token')) {
        return new Response(JSON.stringify({ access_token: 'at', token_type: 'Bearer', expires_in: 60 }),
          { headers: { 'content-type': 'application/json' } })
      }
      if (url.endsWith('/v1.0/me')) {
        return new Response(JSON.stringify({ displayName: 'no id' }), { headers: { 'content-type': 'application/json' } })
      }
      return realFetch(input, init)
    })
    const { ctx, notices, signIn } = await harness()
    const attempt = signIn()
    await visitCallback(ctx, notices)
    await expect(attempt).rejects.toThrow('form this build cannot read')
  })

  it('gives up when the browser never returns', async () => {
    const { signIn } = await harness({ attemptTimeoutMs: 1000 })
    await expect(signIn()).rejects.toThrow(EntraSignInError)
  }, 20_000)

  it('stops when the person withdraws the attempt', async () => {
    const { ctx, notices, signIn } = await harness()
    const attempt = signIn()
    for (let i = 0; i < 200 && notices.length === 0; i += 1) {
      await new Promise(resolve => setTimeout(resolve, 5))
    }
    ctx.authorization.cancel(ENTRA_CREDENTIAL_KEY)
    // The seam reports a withdrawal as an outcome rather than a failure, so a
    // cancelled sign-in is not an error the surface has to explain.
    expect(await attempt).toEqual({ status: 'cancelled' })
    expect(await ctx.credentials.readRecord(ENTRA_CREDENTIAL_KEY)).toBeUndefined()
  })
})
