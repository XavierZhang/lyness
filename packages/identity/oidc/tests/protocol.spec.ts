/**
 * The request shapes and the claim reading, without a network: what discovery
 * is asked for, what PKCE values are produced, and where an organization is
 * found in a reply.
 */

import { describe, expect, it } from 'vitest'
import {
  authorizeUrl,
  challengeOf,
  discoveryUrl,
  newVerifier,
  organizationOf,
  tokenRequest,
  userinfoRequest,
} from '../src/protocol.ts'
import { resolveConfig } from '../src/index.ts'
import type { Discovery } from '../src/protocol.ts'

const ISSUER = 'https://idp.example'

/** The endpoints a provider publishes. */
const DISCOVERY: Discovery = {
  issuer: ISSUER,
  authorization_endpoint: `${ISSUER}/authorize`,
  token_endpoint: `${ISSUER}/token`,
  userinfo_endpoint: `${ISSUER}/userinfo`,
}

/** One resolved configuration, with the fields a test varies. */
function config(over: { organization?: string; organizationParameter?: string } = {}) {
  return resolveConfig({
    issuer: ISSUER,
    clientId: 'lyness-web',
    secret: 'OIDC_CLIENT_SECRET',
    ...over,
  })
}

describe('where discovery is read from', () => {
  it.each([
    ['an issuer without a trailing slash', ISSUER],
    ['an issuer with one', `${ISSUER}/`],
  ])('asks the well-known path of %s', (_case, issuer) => {
    expect(discoveryUrl(issuer).toString()).toBe(`${ISSUER}/.well-known/openid-configuration`)
  })

  it('keeps a path the issuer carries, which a multi-tenant provider uses', () => {
    expect(discoveryUrl(`${ISSUER}/realms/acme`).toString())
      .toBe(`${ISSUER}/realms/acme/.well-known/openid-configuration`)
  })
})

describe('the PKCE pair', () => {
  it('produces a fresh 43-character verifier whose challenge is its S256 digest', () => {
    const first = newVerifier()
    const second = newVerifier()
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/u)
    expect(first).not.toBe(second)
    expect(challengeOf(first)).toMatch(/^[A-Za-z0-9_-]{43}$/u)
    expect(challengeOf(first)).toBe(challengeOf(first))
    expect(challengeOf(first)).not.toBe(challengeOf(second))
  })
})

describe('the authorization request', () => {
  it('carries the code flow, the client, the callback, the state and the challenge', () => {
    const url = authorizeUrl(DISCOVERY, config(), 'the-state', 'the-challenge', 'https://lyn.example/cb')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: 'code',
      client_id: 'lyness-web',
      redirect_uri: 'https://lyn.example/cb',
      scope: 'openid profile email',
      state: 'the-state',
      code_challenge: 'the-challenge',
      code_challenge_method: 'S256',
    })
  })

  it.each([
    ['neither', {}, false],
    ['only the parameter name', { organizationParameter: 'organization_id' }, false],
    ['only the organization', { organization: 'acme' }, false],
    ['both', { organization: 'acme', organizationParameter: 'organization_id' }, true],
  ])('asks for an organization page with %s', (_case, over, asked) => {
    const url = authorizeUrl(DISCOVERY, config(over), 's', 'c', 'https://lyn.example/cb')
    expect(url.searchParams.has('organization_id')).toBe(asked)
  })
})

describe('the token exchange and the person read', () => {
  it('authenticates the client in the body and repeats the callback and verifier', () => {
    const request = tokenRequest(DISCOVERY, config(), 'the-secret', 'the-code', 'the-verifier', 'https://lyn.example/cb')
    expect(request.url.toString()).toBe(`${ISSUER}/token`)
    expect(Object.fromEntries(request.body)).toEqual({
      grant_type: 'authorization_code',
      code: 'the-code',
      redirect_uri: 'https://lyn.example/cb',
      client_id: 'lyness-web',
      client_secret: 'the-secret',
      code_verifier: 'the-verifier',
    })
  })

  it('reads the person with a bearer header', () => {
    const request = userinfoRequest(DISCOVERY, 'tok')
    expect(request.url.toString()).toBe(`${ISSUER}/userinfo`)
    expect(request.headers).toEqual({ authorization: 'Bearer tok' })
  })
})

describe('the organization a reply names', () => {
  it.each([
    ['a top-level claim', { org: 'acme' }, 'org', 'acme'],
    ['a nested claim', { org: { id: 'acme' } }, 'org.id', 'acme'],
    ['no claim configured', { org: 'acme' }, undefined, undefined],
    ['a claim the reply omits', { other: 'x' }, 'org', undefined],
    ['a claim whose value is not a string', { org: { id: 7 } }, 'org.id', undefined],
    ['a claim whose value is empty', { org: '' }, 'org', undefined],
    ['a path through a non-object', { org: 'acme' }, 'org.id', undefined],
    ['a path through an array', { org: ['acme'] }, 'org.id', undefined],
    ['a path through null', { org: null }, 'org.id', undefined],
  ])('reads %s', (_case, reply, claim, expected) => {
    expect(organizationOf(reply, claim)).toBe(expected)
  })

  it('reads nothing from a reply that is not an object at all', () => {
    expect(organizationOf('not an object', 'org')).toBeUndefined()
  })
})

describe('resolving a configuration', () => {
  it('refuses a secret that is not a credential reference', () => {
    expect(() => resolveConfig({ issuer: ISSUER, clientId: 'c', secret: 'not a ref!' }))
      .toThrow('is not a credential reference')
  })

  it('refuses an issuer that is not a URL', () => {
    expect(() => resolveConfig({ issuer: 'not-a-url', clientId: 'c', secret: 'OIDC_SECRET' }))
      .toThrow('is not a URL')
  })

  it('keeps every explicit value and fills in the rest', () => {
    const resolved = resolveConfig({
      issuer: ISSUER,
      clientId: 'c',
      secret: 'OIDC_SECRET',
      scope: 'openid',
      redirectPath: '/cb/sso',
      organizationClaim: 'org.id',
      organization: 'acme',
      organizationParameter: 'organization_id',
      discoveryTtlMs: 60_000,
      attemptTtlMs: 30_000,
      requestTimeoutMs: 1000,
    })
    expect(resolved).toEqual({
      issuer: ISSUER,
      clientId: 'c',
      secret: 'OIDC_SECRET',
      scope: 'openid',
      redirectPath: '/cb/sso',
      organizationClaim: 'org.id',
      organization: 'acme',
      organizationParameter: 'organization_id',
      discoveryTtlMs: 60_000,
      attemptTtlMs: 30_000,
      requestTimeoutMs: 1000,
    })
  })

  it('defaults the scopes, the callback, the discovery reuse and the two bounds', () => {
    const resolved = resolveConfig({ issuer: ISSUER, clientId: 'c', secret: 'OIDC_SECRET' })
    expect(resolved).toMatchObject({
      scope: 'openid profile email',
      redirectPath: '/oauth/callback/oidc',
      discoveryTtlMs: 3_600_000,
      attemptTtlMs: 600_000,
      requestTimeoutMs: 20_000,
      organizationClaim: undefined,
    })
  })
})
