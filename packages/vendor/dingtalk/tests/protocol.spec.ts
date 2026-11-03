/**
 * The request shapes this integration sends, and how it reads an
 * organization's answers — checkable without a network or a browser.
 */

import { describe, expect, it } from 'vitest'
import {
  authorizeUrl,
  failureSchema,
  resolveConfig,
  tokenReplySchema,
  tokenRequest,
  userReplySchema,
  userRequest,
} from '../src/index.ts'
import type { Config as DingtalkConfig } from '../src/index.ts'

/** Overrides a test may make to the fixture organization's configuration. */
interface Over {
  loginHost?: string
  apiOrigin?: string
  secret?: string
  scope?: string
}

/**
 * The fixture organization's configuration.
 *
 * Built field by field rather than spread over a base, because `Config` is a
 * merged type-and-schema name and spreading it reads as spreading a class.
 * @param over - what this test changes.
 * @returns the configuration to resolve.
 */
function config(over: Over = {}): DingtalkConfig {
  return {
    appKey: 'ding-app-key',
    secret: over.secret ?? 'DINGTALK_APP_SECRET',
    ...over.loginHost === undefined ? {} : { loginHost: over.loginHost },
    ...over.apiOrigin === undefined ? {} : { apiOrigin: over.apiOrigin },
    ...over.scope === undefined ? {} : { scope: over.scope },
  }
}

const resolved = resolveConfig(config())

describe('the page a sign-in sends the browser to', () => {
  it('names the application, the scope, the callback, and the attempt', () => {
    const url = authorizeUrl(resolved, 'attempt-1', 'https://dsh.example/oauth/callback/dingtalk')
    expect(url.origin).toBe('https://login.dingtalk.com')
    expect(url.pathname).toBe('/oauth2/auth')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: 'ding-app-key',
      response_type: 'code',
      scope: 'openid',
      redirect_uri: 'https://dsh.example/oauth/callback/dingtalk',
      state: 'attempt-1',
      prompt: 'consent',
    })
  })

  it('goes to the host and scope a deployment names instead', () => {
    const own = resolveConfig(config({ loginHost: 'login.dingtalk.acme.internal', scope: 'openid corpid' }))
    const url = authorizeUrl(own, 's', 'https://dsh.example/cb')
    expect(url.origin).toBe('https://login.dingtalk.acme.internal')
    expect(url.searchParams.get('scope')).toBe('openid corpid')
  })
})

describe('the requests it makes of the organization', () => {
  it('exchanges the code for the person’s own token', () => {
    const request = tokenRequest(resolved, 'the-secret', 'the-code')
    expect(request.url.origin).toBe('https://api.dingtalk.com')
    expect(request.url.pathname).toBe('/v1.0/oauth2/userAccessToken')
    expect(request.body).toEqual({
      clientId: 'ding-app-key',
      clientSecret: 'the-secret',
      code: 'the-code',
      grantType: 'authorization_code',
    })
  })

  it('reads who that token belongs to, naming nobody', () => {
    const request = userRequest(resolved, 'tok')
    expect(request.url.pathname).toBe('/v1.0/contact/users/me')
    expect(request.headers).toEqual({ 'x-acs-dingtalk-access-token': 'tok' })
  })

  it('reaches the API origin a deployment names instead', () => {
    const own = resolveConfig(config({ apiOrigin: 'https://api.dingtalk.acme.internal' }))
    expect(tokenRequest(own, 's', 'c').url.origin).toBe('https://api.dingtalk.acme.internal')
  })
})

describe('the answers it accepts', () => {
  it('reads a token reply, keeping the organization it names', () => {
    const reply = tokenReplySchema.parse({ accessToken: 'tok', expireIn: 7200, corpId: 'ding-corp' })
    expect(reply.corpId).toBe('ding-corp')
  })

  it('reads a token reply that names no organization', () => {
    expect(tokenReplySchema.parse({ accessToken: 'tok' }).corpId).toBeUndefined()
  })

  it('reads a person by the id that survives a second application', () => {
    const reply = userReplySchema.parse({ unionId: 'u-1', openId: 'o-1', nick: 'Ada', email: 'ada@acme.example' })
    expect(reply.unionId).toBe('u-1')
    expect(reply.nick).toBe('Ada')
  })

  it('reads a refusal for what to say about it', () => {
    const failure = failureSchema.parse({ code: 'Forbidden.AccessDenied', message: 'the app is not installed' })
    expect(failure.message).toBe('the app is not installed')
  })

  it('refuses an answer that is not a reply at all', () => {
    expect(() => tokenReplySchema.parse({ nope: true })).toThrow()
    expect(() => userReplySchema.parse({ openId: 'o-1' })).toThrow()
  })
})

describe('the configuration it resolves', () => {
  it('fills in the public service and the conservative defaults', () => {
    expect(resolved).toMatchObject({
      loginHost: 'login.dingtalk.com',
      apiOrigin: 'https://api.dingtalk.com',
      scope: 'openid',
      redirectPath: '/oauth/callback/dingtalk',
      attemptTtlMs: 600_000,
      requestTimeoutMs: 20_000,
    })
  })

  it('refuses a secret written in place of a credential reference', () => {
    expect(() => resolveConfig(config({ secret: 'the actual secret value' })))
      .toThrow('is not a credential reference')
  })
})
