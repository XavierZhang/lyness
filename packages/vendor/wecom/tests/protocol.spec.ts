/**
 * The request shapes this integration sends, and how it reads a corporation's
 * answers — checkable without a network or a browser.
 */

import { describe, expect, it } from 'vitest'
import {
  OK,
  authorizeUrl,
  resolveConfig,
  tokenReplySchema,
  tokenUrl,
  userDetailReplySchema,
  userDetailUrl,
  userInfoReplySchema,
  userInfoUrl,
} from '../src/index.ts'
import type { Config as WecomConfig } from '../src/index.ts'

/** Overrides a test may make to the fixture corporation's configuration. */
interface Over {
  loginHost?: string
  apiOrigin?: string
  secret?: string
  readDetail?: boolean
  attemptTtlMs?: number
}

/**
 * The fixture corporation's configuration.
 *
 * Built field by field rather than spread over a base, because `Config` is a
 * merged type-and-schema name and spreading it reads as spreading a class.
 * @param over - what this test changes.
 * @returns the configuration to resolve or mount.
 */
function config(over: Over = {}): WecomConfig {
  return {
    corpId: 'ww-acme',
    agentId: '1000002',
    secret: over.secret ?? 'WECOM_APP_SECRET',
    ...over.loginHost === undefined ? {} : { loginHost: over.loginHost },
    ...over.apiOrigin === undefined ? {} : { apiOrigin: over.apiOrigin },
    ...over.readDetail === undefined ? {} : { readDetail: over.readDetail },
    ...over.attemptTtlMs === undefined ? {} : { attemptTtlMs: over.attemptTtlMs },
  }
}

const resolved = resolveConfig(config())

describe('the page a sign-in sends the browser to', () => {
  it('names the corporation, the application, the callback, and the attempt', () => {
    const url = authorizeUrl(resolved, 'attempt-1', 'https://dsh.example/oauth/callback/wecom')
    expect(url.origin).toBe('https://login.work.weixin.qq.com')
    expect(url.pathname).toBe('/wwlogin/sso/login')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      login_type: 'CorpApp',
      appid: 'ww-acme',
      agentid: '1000002',
      redirect_uri: 'https://dsh.example/oauth/callback/wecom',
      state: 'attempt-1',
    })
  })

  it('goes to the host a private deployment names instead', () => {
    const own = resolveConfig(config({ loginHost: 'login.wecom.acme.internal' }))
    expect(authorizeUrl(own, 's', 'https://dsh.example/cb').origin).toBe('https://login.wecom.acme.internal')
  })
})

describe('the requests it makes of the corporation', () => {
  it('asks for an application token with the corporation id and the secret', () => {
    const url = tokenUrl(resolved, 'the-secret')
    expect(url.origin).toBe('https://qyapi.weixin.qq.com')
    expect(url.pathname).toBe('/cgi-bin/gettoken')
    expect(Object.fromEntries(url.searchParams)).toEqual({ corpid: 'ww-acme', corpsecret: 'the-secret' })
  })

  it('asks who one authorization code belongs to', () => {
    const url = userInfoUrl(resolved, 'tok', 'the-code')
    expect(url.pathname).toBe('/cgi-bin/auth/getuserinfo')
    expect(Object.fromEntries(url.searchParams)).toEqual({ access_token: 'tok', code: 'the-code' })
  })

  it('asks for member detail against the same token', () => {
    const url = userDetailUrl(resolved, 'tok')
    expect(url.pathname).toBe('/cgi-bin/auth/getuserdetail')
    expect(Object.fromEntries(url.searchParams)).toEqual({ access_token: 'tok' })
  })

  it('reaches the API origin a private deployment names instead', () => {
    const own = resolveConfig(config({ apiOrigin: 'https://qyapi.acme.internal' }))
    expect(tokenUrl(own, 's').origin).toBe('https://qyapi.acme.internal')
  })
})

describe('the answers it accepts', () => {
  it('reads a token reply, and keeps the fields it does not use', () => {
    const reply = tokenReplySchema.parse({ errcode: OK, errmsg: 'ok', access_token: 'tok', expires_in: 7200 })
    expect(reply.access_token).toBe('tok')
  })

  it('reads a refusal, which arrives with HTTP 200 and a non-zero code', () => {
    const reply = tokenReplySchema.parse({ errcode: 40_001, errmsg: 'invalid credential' })
    expect(reply.errcode).not.toBe(OK)
    expect(reply.access_token).toBeUndefined()
  })

  it('tells a member of the corporation from somebody who only has a WeChat identity', () => {
    const member = userInfoReplySchema.parse({ errcode: OK, errmsg: 'ok', userid: 'ada', user_ticket: 'tkt' })
    expect(member.userid).toBe('ada')
    const outsider = userInfoReplySchema.parse({ errcode: OK, errmsg: 'ok', openid: 'o-123' })
    expect(outsider.userid).toBeUndefined()
  })

  it('reads member detail, with the work mailbox as an address of its own', () => {
    const detail = userDetailReplySchema.parse({
      errcode: OK, errmsg: 'ok', userid: 'ada', name: 'Ada', biz_mail: 'ada@acme.example',
    })
    expect(detail.name).toBe('Ada')
    expect(detail.biz_mail).toBe('ada@acme.example')
  })

  it('refuses an answer that is not a reply at all', () => {
    expect(() => tokenReplySchema.parse({ nope: true })).toThrow()
  })
})

describe('the configuration it resolves', () => {
  it('fills in the public service and the conservative defaults', () => {
    expect(resolved).toMatchObject({
      loginHost: 'login.work.weixin.qq.com',
      apiOrigin: 'https://qyapi.weixin.qq.com',
      redirectPath: '/oauth/callback/wecom',
      readDetail: false,
      attemptTtlMs: 600_000,
      requestTimeoutMs: 20_000,
    })
  })

  it('refuses a secret written in place of a credential reference', () => {
    expect(() => resolveConfig(config({ secret: 'the actual secret value' })))
      .toThrow('is not a credential reference')
  })
})
