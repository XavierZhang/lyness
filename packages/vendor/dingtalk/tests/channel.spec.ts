/**
 * One sign-in round trip against a stubbed organization: what start hands the
 * browser, what complete makes of the return, and every way a return does not
 * produce a person.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { brandString } from '@deepseek-ai/dsh-brand'
import { CHANNEL_ID, DingtalkChannel, DingtalkSignInError, asExternalSubject } from '../src/index.ts'
import type { Config as DingtalkConfig } from '../src/index.ts'
import type { DingtalkCorpId, DingtalkUnionId } from '../src/types.ts'

const RETURN_TO = 'https://dsh.example/oauth/callback/dingtalk'

/** Overrides a test may make to the fixture organization's configuration. */
interface Over {
  secret?: string
}

/**
 * The fixture organization's configuration.
 * @param over - what this test changes.
 * @returns the configuration to mount.
 */
function config(over: Over = {}): DingtalkConfig {
  return { appKey: 'ding-app-key', secret: over.secret ?? 'DINGTALK_APP_SECRET' }
}

/** One stubbed organization: a reply per path. */
interface Organization {
  readonly calls: string[]
  reply: (path: string) => { status?: number; body?: unknown; throws?: string }
}

const live: Context[] = []
let organization: Organization

beforeEach(() => {
  organization = {
    calls: [],
    reply: path => path.endsWith('/userAccessToken')
      ? { body: { accessToken: 'tok', expireIn: 7200, corpId: 'ding-corp' } }
      : { body: { unionId: 'u-1', openId: 'o-1', nick: 'Ada', email: 'ada@acme.example' } },
  }
  vi.stubGlobal('fetch', (input: URL | string) => {
    const url = new URL(String(input))
    organization.calls.push(url.pathname)
    const answer = organization.reply(url.pathname)
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
function channel(secret: string | null = 'the-secret', over: Over = {}): DingtalkChannel {
  const ctx = new Context()
  live.push(ctx)
  ctx.provide('credentials', {
    resolve: () => Promise.resolve(secret === null ? undefined : { value: secret }),
  })
  return new DingtalkChannel(ctx, config(over))
}

/** Start one sign-in and return the attempt it issued. */
async function started(subject: DingtalkChannel): Promise<{ to: string; attempt: string }> {
  const start = await subject.start(RETURN_TO)
  return { to: start.to, attempt: start.attempt }
}

describe('starting one sign-in', () => {
  it('sends the browser to the organization with the attempt it issued', async () => {
    const subject = channel()
    const { to, attempt } = await started(subject)
    expect(new URL(to).searchParams.get('state')).toBe(attempt)
    expect(new URL(to).searchParams.get('redirect_uri')).toBe(RETURN_TO)
  })
})

describe('finishing one sign-in', () => {
  it('reports the person, by the organization and the id that survive a rename', async () => {
    const subject = channel()
    const { attempt } = await started(subject)
    expect(await subject.complete(new URLSearchParams({ state: attempt, authCode: 'the-code' }))).toEqual({
      channel: CHANNEL_ID,
      issuer: 'ding-corp',
      subject: 'u-1',
      displayName: 'Ada',
      address: 'ada@acme.example',
    })
    expect(organization.calls).toEqual(['/v1.0/oauth2/userAccessToken', '/v1.0/contact/users/me'])
  })

  it('reads the code under either name the callback may carry it', async () => {
    const subject = channel()
    const { attempt } = await started(subject)
    expect(await subject.complete(new URLSearchParams({ state: attempt, code: 'the-code' }))).toBeDefined()
  })

  it('reports a person the directory publishes no nickname or address for', async () => {
    organization.reply = path => path.endsWith('/userAccessToken')
      ? { body: { accessToken: 'tok', corpId: 'ding-corp' } }
      : { body: { unionId: 'u-1' } }
    const subject = channel()
    const { attempt } = await started(subject)
    expect(await subject.complete(new URLSearchParams({ state: attempt, authCode: 'c' })))
      .toEqual({ channel: CHANNEL_ID, issuer: 'ding-corp', subject: 'u-1' })
  })

  it('spends one callback once, so a replayed link finds nothing waiting', async () => {
    const subject = channel()
    const { attempt } = await started(subject)
    const query = new URLSearchParams({ state: attempt, authCode: 'the-code' })
    expect(await subject.complete(query)).toBeDefined()
    expect(await subject.complete(query)).toBeUndefined()
  })

  it('completes no sign-in for a return missing either value', async () => {
    const subject = channel()
    const { attempt } = await started(subject)
    expect(await subject.complete(new URLSearchParams({ state: attempt }))).toBeUndefined()
    expect(await subject.complete(new URLSearchParams({ authCode: 'c' }))).toBeUndefined()
  })

  it('completes no sign-in for a state this process never issued', async () => {
    const subject = channel()
    await started(subject)
    expect(await subject.complete(new URLSearchParams({ state: 'elsewhere', authCode: 'c' }))).toBeUndefined()
  })

  it('completes no sign-in for a personal account that is in nobody’s directory', async () => {
    organization.reply = () => ({ body: { accessToken: 'tok' } })
    const subject = channel()
    const { attempt } = await started(subject)
    expect(await subject.complete(new URLSearchParams({ state: attempt, authCode: 'c' }))).toBeUndefined()
    // It never asks who they are: there is no organization to bind them in.
    expect(organization.calls).not.toContain('/v1.0/contact/users/me')
  })
})

describe('what it refuses', () => {
  /** Complete one sign-in and return whatever it threw. */
  async function failing(subject: DingtalkChannel): Promise<unknown> {
    const { attempt } = await started(subject)
    return subject.complete(new URLSearchParams({ state: attempt, authCode: 'c' })).catch((error: unknown) => error)
  }

  it('names the credential when it holds no secret', async () => {
    const error = await failing(channel(null))
    expect(error).toBeInstanceOf(DingtalkSignInError)
    expect((error as Error).message).toContain('DINGTALK_APP_SECRET')
  })

  it('carries the organization’s own code and message when it refuses', async () => {
    organization.reply = () => ({ status: 400, body: { code: 'Forbidden.AccessDenied', message: 'the app is not installed' } })
    const error = await failing(channel())
    expect((error as DingtalkSignInError).code).toBe('Forbidden.AccessDenied')
    expect((error as Error).message).toContain('the app is not installed')
  })

  it('falls back to the status when a refusal says nothing', async () => {
    organization.reply = () => ({ status: 500, body: {} })
    expect(((await failing(channel())) as Error).message).toContain('500')
  })

  it('reports a refusal whose body was not JSON at all', async () => {
    organization.reply = () => ({ status: 502 })
    expect(((await failing(channel())) as Error).message).toContain('502')
  })

  it('reports a refusal whose body was not a reply either', async () => {
    organization.reply = () => ({ status: 403, body: 'forbidden' })
    const error = await failing(channel())
    expect((error as DingtalkSignInError).code).toBeUndefined()
    expect((error as Error).message).toContain('403')
  })

  it('reports an organization it could not reach, whatever the failure was', async () => {
    organization.reply = () => ({ throws: 'offline' })
    expect(((await failing(channel())) as Error).message).toContain('offline')
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
    vi.stubGlobal('fetch', () => Promise.reject('socket closed'))
    expect(((await failing(channel())) as Error).message).toContain('socket closed')
  })

  it('reports a success whose answer was not JSON', async () => {
    organization.reply = () => ({})
    expect(((await failing(channel())) as Error).message).toContain('not JSON')
  })

  it('reports an answer it cannot read', async () => {
    organization.reply = () => ({ body: { nope: true } })
    expect(((await failing(channel())) as Error).message).toContain('unreadable answer')
  })
})

describe('the subject it hands a sign-in', () => {
  it('binds on the organization and the union id', () => {
    expect(asExternalSubject({
      corpId: brandString<DingtalkCorpId>('ding-corp'),
      unionId: brandString<DingtalkUnionId>('u-1'),
    })).toEqual({ channel: CHANNEL_ID, issuer: 'ding-corp', subject: 'u-1' })
  })
})
