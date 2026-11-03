/**
 * The request shapes this integration sends, and how it reads a tenant's
 * answers — checkable without a network or a browser.
 */

import { describe, expect, it } from 'vitest'
import {
  OK,
  appTokenReplySchema,
  appTokenRequest,
  authorizeUrl,
  resolveConfig,
  userInfoReplySchema,
  userInfoRequest,
  userTokenReplySchema,
  userTokenRequest,
} from '../src/index.ts'
import type { Config as FeishuConfig } from '../src/index.ts'

/** Overrides a test may make to the fixture application's configuration. */
interface Over {
  apiOrigin?: string
  secret?: string
}

/**
 * The fixture application's configuration.
 *
 * Built field by field rather than spread over a base, because `Config` is a
 * merged type-and-schema name and spreading it reads as spreading a class.
 * @param over - what this test changes.
 * @returns the configuration to resolve.
 */
function config(over: Over = {}): FeishuConfig {
  return {
    appId: 'cli-app-id',
    secret: over.secret ?? 'FEISHU_APP_SECRET',
    ...over.apiOrigin === undefined ? {} : { apiOrigin: over.apiOrigin },
  }
}

const resolved = resolveConfig(config())

describe('the page a sign-in sends the browser to', () => {
  it('names the application, the callback, and the attempt', () => {
    const url = authorizeUrl(resolved, 'attempt-1', 'https://lyn.example/oauth/callback/feishu')
    expect(url.origin).toBe('https://open.feishu.cn')
    expect(url.pathname).toBe('/open-apis/authen/v1/authorize')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      app_id: 'cli-app-id',
      redirect_uri: 'https://lyn.example/oauth/callback/feishu',
      state: 'attempt-1',
    })
  })

  it('goes to the origin an international deployment names instead', () => {
    const lark = resolveConfig(config({ apiOrigin: 'https://open.larksuite.com' }))
    expect(authorizeUrl(lark, 's', 'https://lyn.example/cb').origin).toBe('https://open.larksuite.com')
  })
})

describe('the requests it makes of the tenant', () => {
  it('asks for an application token with the internal form', () => {
    const request = appTokenRequest(resolved, 'the-secret')
    expect(request.url.pathname).toBe('/open-apis/auth/v3/app_access_token_internal')
    expect(request.body).toEqual({ app_id: 'cli-app-id', app_secret: 'the-secret' })
  })

  it('buys the person’s token with the application’s own', () => {
    const request = userTokenRequest(resolved, 'app-tok', 'the-code')
    expect(request.url.pathname).toBe('/open-apis/authen/v1/oidc/access_token')
    expect(request.headers).toEqual({ authorization: 'Bearer app-tok' })
    expect(request.body).toEqual({ grant_type: 'authorization_code', code: 'the-code' })
  })

  it('reads who the person’s token belongs to, naming nobody', () => {
    const request = userInfoRequest(resolved, 'user-tok')
    expect(request.url.pathname).toBe('/open-apis/authen/v1/user_info')
    expect(request.headers).toEqual({ authorization: 'Bearer user-tok' })
  })
})

describe('the answers it accepts', () => {
  it('reads an application token beside the envelope', () => {
    const reply = appTokenReplySchema.parse({ code: OK, msg: 'ok', app_access_token: 'app-tok', expire: 7200 })
    expect(reply.app_access_token).toBe('app-tok')
  })

  it('reads a person token nested under data', () => {
    const reply = userTokenReplySchema.parse({ code: OK, msg: 'ok', data: { access_token: 'user-tok', expires_in: 7200 } })
    expect(reply.data?.access_token).toBe('user-tok')
  })

  it('reads a person by the id that survives a second application', () => {
    const reply = userInfoReplySchema.parse({
      code: OK,
      msg: 'ok',
      data: { union_id: 'u-1', open_id: 'o-1', tenant_key: 't-1', name: 'Ada', enterprise_email: 'ada@acme.example' },
    })
    expect(reply.data?.union_id).toBe('u-1')
    expect(reply.data?.tenant_key).toBe('t-1')
  })

  it('reads a refusal, which arrives with HTTP 200 and a non-zero code', () => {
    const reply = appTokenReplySchema.parse({ code: 10_003, msg: 'invalid app_secret' })
    expect(reply.code).not.toBe(OK)
    expect(reply.app_access_token).toBeUndefined()
  })

  it('refuses an answer that is not a reply at all', () => {
    expect(() => appTokenReplySchema.parse({ nope: true })).toThrow()
    expect(() => userInfoReplySchema.parse({ code: OK, msg: 'ok', data: { open_id: 'o-1' } })).toThrow()
  })
})

describe('the configuration it resolves', () => {
  it('fills in the public service and the conservative defaults', () => {
    expect(resolved).toMatchObject({
      apiOrigin: 'https://open.feishu.cn',
      redirectPath: '/oauth/callback/feishu',
      attemptTtlMs: 600_000,
      requestTimeoutMs: 20_000,
    })
  })

  it('refuses a secret written in place of a credential reference', () => {
    expect(() => resolveConfig(config({ secret: 'the actual secret value' })))
      .toThrow('is not a credential reference')
  })
})
