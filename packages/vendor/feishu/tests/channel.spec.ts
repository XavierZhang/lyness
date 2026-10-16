/**
 * One sign-in round trip against a stubbed tenant: what start hands the
 * browser, what complete makes of the return across the two-legged exchange,
 * and every way a return does not produce a person.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@lyness/cordis'
import { brandString } from '@lyness/lyn-brand'
import { CHANNEL_ID, FeishuChannel, FeishuSignInError, asExternalSubject } from '../src/index.ts'
import type { Config as FeishuConfig } from '../src/index.ts'
import type { FeishuTenantKey, FeishuUnionId } from '../src/types.ts'

const RETURN_TO = 'https://lyn.example/oauth/callback/feishu'

/** Overrides a test may make to the fixture application's configuration. */
interface Over {
  secret?: string
}

/**
 * The fixture application's configuration.
 * @param over - what this test changes.
 * @returns the configuration to mount.
 */
function config(over: Over = {}): FeishuConfig {
  return { appId: 'cli-app-id', secret: over.secret ?? 'FEISHU_APP_SECRET' }
}

/** One stubbed tenant: a reply per path. */
interface Tenant {
  readonly calls: string[]
  reply: (path: string) => { status?: number; body?: unknown; throws?: string }
}

const live: Context[] = []
let tenant: Tenant

/** The tenant's ordinary answers, which sign Ada in. */
function answers(path: string): { body: unknown } {
  if (path.endsWith('/app_access_token_internal')) {
    return { body: { code: 0, msg: 'ok', app_access_token: 'app-tok' } }
  }
  if (path.endsWith('/oidc/access_token')) {
    return { body: { code: 0, msg: 'ok', data: { access_token: 'user-tok' } } }
  }
  return {
    body: {
      code: 0,
      msg: 'ok',
      data: { union_id: 'u-1', tenant_key: 't-1', name: 'Ada', enterprise_email: 'ada@acme.example' },
    },
  }
}

beforeEach(() => {
  tenant = { calls: [], reply: answers }
  vi.stubGlobal('fetch', (input: URL | string) => {
    const url = new URL(String(input))
    tenant.calls.push(url.pathname)
    const answer = tenant.reply(url.pathname)
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
function channel(secret: string | null = 'the-secret', over: Over = {}): FeishuChannel {
  const ctx = new Context()
  live.push(ctx)
  ctx.provide('credentials', {
    resolve: () => Promise.resolve(secret === null ? undefined : { value: secret }),
  })
  return new FeishuChannel(ctx, config(over))
}

/** Start one sign-in and return the attempt it issued. */
async function started(subject: FeishuChannel): Promise<{ to: string; attempt: string }> {
  const start = await subject.start(RETURN_TO)
  return { to: start.to, attempt: start.attempt }
}

describe('starting one sign-in', () => {
  it('sends the browser to the tenant with the attempt it issued', async () => {
    const subject = channel()
    const { to, attempt } = await started(subject)
    expect(new URL(to).searchParams.get('state')).toBe(attempt)
    expect(new URL(to).searchParams.get('redirect_uri')).toBe(RETURN_TO)
  })
})

describe('finishing one sign-in', () => {
  it('reports the person after both legs of the exchange', async () => {
    const subject = channel()
    const { attempt } = await started(subject)
    expect(await subject.complete(new URLSearchParams({ state: attempt, code: 'the-code' }))).toEqual({
      channel: CHANNEL_ID,
      issuer: 't-1',
      subject: 'u-1',
      displayName: 'Ada',
      address: 'ada@acme.example',
    })
    expect(tenant.calls).toEqual([
      '/open-apis/auth/v3/app_access_token_internal',
      '/open-apis/authen/v1/oidc/access_token',
      '/open-apis/authen/v1/user_info',
    ])
  })

  it('prefers the address the tenant issued over a personal one', async () => {
    tenant.reply = path => path.endsWith('/user_info')
      ? { body: { code: 0, msg: 'ok', data: { union_id: 'u-1', tenant_key: 't-1', email: 'ada@personal.example' } } }
      : answers(path)
    const subject = channel()
    const { attempt } = await started(subject)
    expect(await subject.complete(new URLSearchParams({ state: attempt, code: 'c' })))
      .toMatchObject({ address: 'ada@personal.example' })
  })

  it('reports a person the directory publishes no name or address for', async () => {
    tenant.reply = path => path.endsWith('/user_info')
      ? { body: { code: 0, msg: 'ok', data: { union_id: 'u-1', tenant_key: 't-1' } } }
      : answers(path)
    const subject = channel()
    const { attempt } = await started(subject)
    expect(await subject.complete(new URLSearchParams({ state: attempt, code: 'c' })))
      .toEqual({ channel: CHANNEL_ID, issuer: 't-1', subject: 'u-1' })
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
    expect(await subject.complete(new URLSearchParams({ code: 'c' }))).toBeUndefined()
  })

  it('completes no sign-in for a state this process never issued', async () => {
    const subject = channel()
    await started(subject)
    expect(await subject.complete(new URLSearchParams({ state: 'elsewhere', code: 'c' }))).toBeUndefined()
  })

  it('completes no sign-in for a personal account no tenant holds', async () => {
    tenant.reply = path => path.endsWith('/user_info')
      ? { body: { code: 0, msg: 'ok', data: { union_id: 'u-1' } } }
      : answers(path)
    const subject = channel()
    const { attempt } = await started(subject)
    expect(await subject.complete(new URLSearchParams({ state: attempt, code: 'c' }))).toBeUndefined()
  })
})

describe('what it refuses', () => {
  /** Complete one sign-in and return whatever it threw. */
  async function failing(subject: FeishuChannel): Promise<unknown> {
    const { attempt } = await started(subject)
    return subject.complete(new URLSearchParams({ state: attempt, code: 'c' })).catch((error: unknown) => error)
  }

  it('names the credential when it holds no secret', async () => {
    const error = await failing(channel(null))
    expect(error).toBeInstanceOf(FeishuSignInError)
    expect((error as Error).message).toContain('FEISHU_APP_SECRET')
  })

  it('carries the tenant’s own code when it refuses', async () => {
    tenant.reply = () => ({ body: { code: 10_003, msg: 'invalid app_secret' } })
    const error = await failing(channel())
    expect((error as FeishuSignInError).code).toBe(10_003)
    expect((error as Error).message).toContain('invalid app_secret')
  })

  it('refuses a success that carried no application token', async () => {
    tenant.reply = () => ({ body: { code: 0, msg: 'ok' } })
    expect(((await failing(channel())) as Error).message).toContain('without an application token')
  })

  it('refuses a success that carried no person token', async () => {
    tenant.reply = path => path.endsWith('/oidc/access_token')
      ? { body: { code: 0, msg: 'ok' } }
      : answers(path)
    expect(((await failing(channel())) as Error).message).toContain('without a person token')
  })

  it('refuses a success that carried no person', async () => {
    tenant.reply = path => path.endsWith('/user_info')
      ? { body: { code: 0, msg: 'ok' } }
      : answers(path)
    expect(((await failing(channel())) as Error).message).toContain('without a person')
  })

  it('reports a tenant it could not reach, whatever the failure was', async () => {
    tenant.reply = () => ({ throws: 'offline' })
    expect(((await failing(channel())) as Error).message).toContain('offline')
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
    vi.stubGlobal('fetch', () => Promise.reject('socket closed'))
    expect(((await failing(channel())) as Error).message).toContain('socket closed')
  })

  it('reports an HTTP failure by its status', async () => {
    tenant.reply = () => ({ status: 503, body: {} })
    expect(((await failing(channel())) as Error).message).toContain('503')
  })

  it('reports an answer that was not JSON', async () => {
    tenant.reply = () => ({})
    expect(((await failing(channel())) as Error).message).toContain('not JSON')
  })

  it('reports an answer it cannot read', async () => {
    tenant.reply = () => ({ body: { nope: true } })
    expect(((await failing(channel())) as Error).message).toContain('unreadable answer')
  })
})

describe('the subject it hands a sign-in', () => {
  it('binds on the tenant key and the union id', () => {
    expect(asExternalSubject({
      tenantKey: brandString<FeishuTenantKey>('t-1'),
      unionId: brandString<FeishuUnionId>('u-1'),
    })).toEqual({ channel: CHANNEL_ID, issuer: 't-1', subject: 'u-1' })
  })
})
