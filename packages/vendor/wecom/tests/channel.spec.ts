/**
 * One sign-in round trip against a stubbed corporation: what start hands the
 * browser, what complete makes of the return, and every way a return does not
 * produce a member.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@lyness/cordis'
import { CHANNEL_ID, WecomChannel, WecomSignInError, asExternalSubject } from '../src/index.ts'
import type { Config as WecomConfig } from '../src/index.ts'
import type { WecomCorpId, WecomUserId } from '../src/types.ts'
import { brandString } from '@lyness/lyn-brand'

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


const RETURN_TO = 'https://lyn.example/oauth/callback/wecom'

/** One stubbed corporation: a reply per path, in the order the channel asks. */
interface Corporation {
  readonly calls: string[]
  reply: (path: string) => { status?: number; body?: unknown; throws?: string }
}

const live: Context[] = []
let corporation: Corporation

beforeEach(() => {
  corporation = {
    calls: [],
    reply: path => path.endsWith('/gettoken')
      ? { body: { errcode: 0, errmsg: 'ok', access_token: 'tok' } }
      : path.endsWith('/auth/getuserinfo')
        ? { body: { errcode: 0, errmsg: 'ok', userid: 'ada', user_ticket: 'tkt' } }
        : { body: { errcode: 0, errmsg: 'ok', userid: 'ada', name: 'Ada', biz_mail: 'ada@acme.example' } },
  }
  vi.stubGlobal('fetch', (input: URL | string) => {
    const url = new URL(String(input))
    corporation.calls.push(url.pathname)
    const answer = corporation.reply(url.pathname)
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
function channel(secret: string | null = 'the-secret', over: Over = { readDetail: true }): WecomChannel {
  const ctx = new Context()
  live.push(ctx)
  ctx.provide('credentials', {
    resolve: () => Promise.resolve(secret === null ? undefined : { value: secret }),
  })
  return new WecomChannel(ctx, config(over))
}

/** Start one sign-in and return the attempt it issued. */
async function started(subject: WecomChannel): Promise<{ to: string; attempt: string }> {
  const start = await subject.start(RETURN_TO)
  return { to: start.to, attempt: start.attempt }
}

describe('starting one sign-in', () => {
  it('sends the browser to the corporation with the attempt it issued', async () => {
    const subject = channel()
    const { to, attempt } = await started(subject)
    expect(new URL(to).searchParams.get('state')).toBe(attempt)
    expect(new URL(to).searchParams.get('redirect_uri')).toBe(RETURN_TO)
  })

  it('issues a different attempt each time', async () => {
    const subject = channel()
    const first = await started(subject)
    const second = await started(subject)
    expect(first.attempt).not.toBe(second.attempt)
  })
})

describe('finishing one sign-in', () => {
  it('reports the member, and reads detail when the deployment asked for it', async () => {
    const subject = channel()
    const { attempt } = await started(subject)
    const found = await subject.complete(new URLSearchParams({ state: attempt, code: 'the-code' }))
    expect(found).toEqual({
      channel: CHANNEL_ID,
      issuer: 'ww-acme',
      subject: 'ada',
      displayName: 'Ada',
      address: 'ada@acme.example',
    })
    expect(corporation.calls).toEqual(['/cgi-bin/gettoken', '/cgi-bin/auth/getuserinfo', '/cgi-bin/auth/getuserdetail'])
  })

  it('leaves detail alone when the deployment did not ask', async () => {
    const subject = channel('the-secret', { readDetail: false })
    const { attempt } = await started(subject)
    const found = await subject.complete(new URLSearchParams({ state: attempt, code: 'the-code' }))
    expect(found).toEqual({ channel: CHANNEL_ID, issuer: 'ww-acme', subject: 'ada' })
    expect(corporation.calls).not.toContain('/cgi-bin/auth/getuserdetail')
  })

  it('leaves detail alone when the member granted no ticket for it', async () => {
    corporation.reply = path => path.endsWith('/gettoken')
      ? { body: { errcode: 0, errmsg: 'ok', access_token: 'tok' } }
      : { body: { errcode: 0, errmsg: 'ok', userid: 'ada' } }
    const subject = channel()
    const { attempt } = await started(subject)
    expect(await subject.complete(new URLSearchParams({ state: attempt, code: 'c' })))
      .toEqual({ channel: CHANNEL_ID, issuer: 'ww-acme', subject: 'ada' })
  })

  it('spends one callback once, so a replayed link finds nothing waiting', async () => {
    const subject = channel()
    const { attempt } = await started(subject)
    const query = new URLSearchParams({ state: attempt, code: 'the-code' })
    expect(await subject.complete(query)).toBeDefined()
    expect(await subject.complete(query)).toBeUndefined()
  })

  it('completes no sign-in for a return missing either value', async () => {
    const subject = channel()
    const { attempt } = await started(subject)
    expect(await subject.complete(new URLSearchParams({ state: attempt }))).toBeUndefined()
    expect(await subject.complete(new URLSearchParams({ code: 'the-code' }))).toBeUndefined()
  })

  it('completes no sign-in for a state this process never issued', async () => {
    const subject = channel()
    await started(subject)
    expect(await subject.complete(new URLSearchParams({ state: 'elsewhere', code: 'c' }))).toBeUndefined()
  })

  it('completes no sign-in for somebody who is not in the directory', async () => {
    corporation.reply = path => path.endsWith('/gettoken')
      ? { body: { errcode: 0, errmsg: 'ok', access_token: 'tok' } }
      : { body: { errcode: 0, errmsg: 'ok', openid: 'o-123' } }
    const subject = channel()
    const { attempt } = await started(subject)
    expect(await subject.complete(new URLSearchParams({ state: attempt, code: 'c' }))).toBeUndefined()
  })
})

it('reports a member whose detail carries neither a name nor an address', async () => {
  corporation.reply = path => path.endsWith('/gettoken')
    ? { body: { errcode: 0, errmsg: 'ok', access_token: 'tok' } }
    : path.endsWith('/auth/getuserinfo')
      ? { body: { errcode: 0, errmsg: 'ok', userid: 'ada', user_ticket: 'tkt' } }
      : { body: { errcode: 0, errmsg: 'ok', userid: 'ada' } }
  const subject = channel()
  const { attempt } = await started(subject)
  expect(await subject.complete(new URLSearchParams({ state: attempt, code: 'c' })))
    .toEqual({ channel: CHANNEL_ID, issuer: 'ww-acme', subject: 'ada' })
})

describe('what it refuses', () => {
  /** Complete one sign-in and return whatever it threw. */
  async function failing(subject: WecomChannel): Promise<unknown> {
    const { attempt } = await started(subject)
    return subject.complete(new URLSearchParams({ state: attempt, code: 'c' })).catch((error: unknown) => error)
  }

  it('names the credential when it holds no secret', async () => {
    const error = await failing(channel(null))
    expect(error).toBeInstanceOf(WecomSignInError)
    expect((error as Error).message).toContain('WECOM_APP_SECRET')
  })

  it('carries the corporation’s own code when it refuses', async () => {
    corporation.reply = () => ({ body: { errcode: 40_001, errmsg: 'invalid credential' } })
    const error = await failing(channel())
    expect((error as WecomSignInError).errcode).toBe(40_001)
    expect((error as Error).message).toContain('invalid credential')
  })

  it('refuses a success that carried no token', async () => {
    corporation.reply = () => ({ body: { errcode: 0, errmsg: 'ok' } })
    expect(((await failing(channel())) as Error).message).toContain('without an application token')
  })

  it('reports a corporation it could not reach, whatever the failure was', async () => {
    corporation.reply = () => ({ throws: 'offline' })
    expect(((await failing(channel())) as Error).message).toContain('offline')
    // A rejection that is not an Error at all still has to say something.
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
    vi.stubGlobal('fetch', () => Promise.reject('socket closed'))
    expect(((await failing(channel())) as Error).message).toContain('socket closed')
  })

  it('reports an HTTP failure by its status', async () => {
    corporation.reply = () => ({ status: 503, body: {} })
    expect(((await failing(channel())) as Error).message).toContain('503')
  })

  it('reports an answer that was not JSON', async () => {
    corporation.reply = () => ({})
    expect(((await failing(channel())) as Error).message).toContain('not JSON')
  })

  it('reports an answer it cannot read', async () => {
    corporation.reply = () => ({ body: { nope: true } })
    expect(((await failing(channel())) as Error).message).toContain('unreadable answer')
  })
})

describe('the subject it hands a sign-in', () => {
  it('binds on the two values a rename does not change', () => {
    expect(asExternalSubject({
      corpId: brandString<WecomCorpId>('ww-acme'),
      userId: brandString<WecomUserId>('ada'),
    })).toEqual({ channel: CHANNEL_ID, issuer: 'ww-acme', subject: 'ada' })
  })
})
