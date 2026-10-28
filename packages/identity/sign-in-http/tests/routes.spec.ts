/**
 * REAL-composition coverage: a test-only cordis.yml booted through the
 * vendored Loader mounts the server, the sign-in flow, an admission roster and
 * one test channel, and every assertion observes the HTTP surface a browser
 * sees — the redirect, the cookies, the refusals, and signing out.
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import HttpServer from '@deepseek-ai/dsh-host-webserver'
import Storage from '@deepseek-ai/dsh-storage'
import * as StorageJson from '@deepseek-ai/dsh-storage-json'
import * as StorageDomain from '@deepseek-ai/dsh-storage-domain'
import * as StoredAuthSessions from '@deepseek-ai/dsh-auth-session/store'
import * as SignIn from '@deepseek-ai/dsh-sign-in'
import { channelId } from '@deepseek-ai/dsh-sign-in'
import type { ExternalSubject, RedirectChannel } from '@deepseek-ai/dsh-sign-in'
import * as RosterAdmission from '@deepseek-ai/dsh-sign-in/admission-roster'
import * as SignInHttp from '../src/index.ts'
import { ATTEMPT_COOKIE, SESSION_COOKIE, readCookie } from '../src/cookie.ts'

const CHANNEL = channelId('test-directory')
const ISSUER = 'directory.example'
const ORIGIN = 'http://127.0.0.1:0'

let root: string | undefined
let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

/** A channel that issues a predictable state, so a test can replay the callback. */
const TestChannel = {
  name: 'test-directory-channel',
  inject: ['signIn'],
  apply(ctx: Context): void {
    let issued = 0
    const channel: RedirectChannel = {
      kind: 'redirect',
      id: CHANNEL,
      displayName: 'Test Directory',
      start: (returnTo: string) => {
        issued += 1
        const attempt = `state-${String(issued)}`
        return Promise.resolve({ to: `https://${ISSUER}/authorize?state=${attempt}&r=${returnTo}`, attempt })
      },
      complete: (parameters: URLSearchParams): Promise<ExternalSubject | undefined> => {
        if (parameters.get('code') !== 'good') return Promise.resolve(undefined)
        return Promise.resolve({ channel: CHANNEL, issuer: ISSUER, subject: 'person-1' })
      },
    }
    ctx.effect(() => channel.id === CHANNEL ? ctx.signIn.register(channel) : () => undefined)
  },
}

/** Boot the whole composition and answer the port it listens on. */
async function compose(options: { admits?: boolean } = {}): Promise<number> {
  root = await mkdtemp(join(tmpdir(), 'dsh-sign-in-http-'))
  const configPath = join(root, 'cordis.yml')
  const bindings = options.admits === false
    ? []
    : [`      - { channel: ${CHANNEL}, issuer: ${ISSUER}, subject: person-1, person: ada }`]
  await writeFile(configPath, [
    "- name: '@deepseek-ai/dsh-host-webserver'",
    '  config:',
    "    host: '127.0.0.1'",
    '    port: 0',
    "- name: '@deepseek-ai/dsh-storage'",
    "- name: '@deepseek-ai/dsh-storage-json'",
    '  config:',
    `    root: ${JSON.stringify(join(root, 'state'))}`,
    "- name: '@deepseek-ai/dsh-storage-domain'",
    '  config:',
    '    backend: json',
    "- name: '@deepseek-ai/dsh-auth-session/store'",
    "- name: '@deepseek-ai/dsh-sign-in/admission-roster'",
    '  config:',
    '    bindings:',
    ...(bindings.length > 0 ? bindings : ['      []']),
    "- name: '@deepseek-ai/dsh-sign-in'",
    "- name: 'test-directory-channel'",
    "- name: '@deepseek-ai/dsh-sign-in-http'",
    '  config:',
    `    publicOrigin: '${ORIGIN}'`,
    '    secureCookies: false',
    "    landingPath: '/app'",
    '',
  ].join('\n'))

  context = new Context()
  context.baseUrl = pathToFileURL(root).href + '/'
  await context.plugin(Loader)
  context.loader.builtins.include = Include
  const modules = new Map<string, unknown>([
    ['@deepseek-ai/dsh-host-webserver', HttpServer],
    ['@deepseek-ai/dsh-storage', Storage],
    ['@deepseek-ai/dsh-storage-json', StorageJson],
    ['@deepseek-ai/dsh-storage-domain', StorageDomain],
    ['@deepseek-ai/dsh-auth-session/store', StoredAuthSessions],
    ['@deepseek-ai/dsh-sign-in', SignIn],
    ['@deepseek-ai/dsh-sign-in/admission-roster', RosterAdmission],
    ['test-directory-channel', TestChannel],
    ['@deepseek-ai/dsh-sign-in-http', SignInHttp],
  ])
  const base = context.loader.internal
  if (base === undefined) throw new Error('this Node build exposes no internal module loader')
  // A copy with `import` replaced, rather than a mutation: the internal
  // loader is cached process-wide, so changing it would reroute every other
  // spec in this worker. Nothing else on it is called during the boot.
  context.loader.internal = {
    ...base,
    import: (specifier: string) => {
      const found = modules.get(specifier)
      if (found === undefined) throw new Error(`unexpected Loader import: ${specifier}`)
      return Promise.resolve(found)
    },
  }
  await context.loader.create({
    name: 'cordis:include',
    config: { path: pathToFileURL(configPath).href },
  })
  await context.loader.await()
  return context.webServer.port
}

/** One request against the running server, never following a redirect. */
async function call(
  port: number,
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; body: string; headers: Headers }> {
  const response = await fetch(`http://127.0.0.1:${String(port)}${path}`, { redirect: 'manual', ...init })
  return { status: response.status, body: await response.text(), headers: response.headers }
}

/** Every `Set-Cookie` the response carried, joined the way a browser would read them. */
function cookies(headers: Headers): string {
  return headers.getSetCookie().map(value => value.split(';')[0]).join('; ')
}

describe('the channel list', () => {
  it('offers each mounted channel with the shape it signs in with', async () => {
    const port = await compose()
    const { status, body } = await call(port, '/auth/channels')
    expect(status).toBe(200)
    expect(JSON.parse(body)).toEqual({
      channels: [{ id: CHANNEL, displayName: 'Test Directory', kind: 'redirect' }],
    })
  })

  it('refuses a method that is not a read', async () => {
    const port = await compose()
    expect((await call(port, '/auth/channels', { method: 'POST' })).status).toBe(405)
  })
})

describe('starting a sign-in', () => {
  it('sends the browser to the directory', async () => {
    const port = await compose()
    const { status, headers } = await call(port, `/auth/sign-in/${CHANNEL}`)
    expect(status).toBe(302)
    expect(headers.get('location')).toContain(`https://${ISSUER}/authorize`)
  })

  it('tells the channel where the directory should return', async () => {
    const port = await compose()
    const { headers } = await call(port, `/auth/sign-in/${CHANNEL}`)
    expect(headers.get('location')).toContain(`r=${ORIGIN}/auth/callback/${CHANNEL}`)
  })

  it('remembers the attempt in this browser, and nowhere else', async () => {
    const port = await compose()
    const { headers } = await call(port, `/auth/sign-in/${CHANNEL}`)
    expect(readCookie(cookies(headers), ATTEMPT_COOKIE)).toBe('state-1')
    expect(headers.getSetCookie()[0]).toContain('Max-Age=600')
  })

  it('answers 404 for a channel nobody mounted', async () => {
    const port = await compose()
    const { status, body } = await call(port, '/auth/sign-in/absent')
    expect(status).toBe(404)
    expect(JSON.parse(body)).toEqual({ error: 'channel-unknown' })
  })

  it('answers 404 when the path names no channel at all', async () => {
    const port = await compose()
    expect((await call(port, '/auth/sign-in')).status).toBe(404)
  })

  it('refuses a method that is not a read', async () => {
    const port = await compose()
    expect((await call(port, `/auth/sign-in/${CHANNEL}`, { method: 'POST' })).status).toBe(405)
  })
})

describe('returning from the directory', () => {
  it('signs the person in and hands the browser the session', async () => {
    const port = await compose()
    const started = await call(port, `/auth/sign-in/${CHANNEL}`)
    const { status, headers } = await call(
      port,
      `/auth/callback/${CHANNEL}?state=state-1&code=good`,
      { headers: { cookie: cookies(started.headers) } },
    )
    expect(status).toBe(302)
    expect(headers.get('location')).toBe(`${ORIGIN}/app`)
    expect(readCookie(cookies(headers), SESSION_COOKIE)).toMatch(/.+/u)
  })

  it('gives the session cookie the session own lifetime', async () => {
    const port = await compose()
    const started = await call(port, `/auth/sign-in/${CHANNEL}`)
    const { headers } = await call(
      port,
      `/auth/callback/${CHANNEL}?state=state-1&code=good`,
      { headers: { cookie: cookies(started.headers) } },
    )
    const session = headers.getSetCookie().find(value => value.startsWith(SESSION_COOKIE)) ?? ''
    expect(session).toMatch(/Max-Age=4\d{4}/u)
  })

  it('forgets the attempt once it is spent', async () => {
    const port = await compose()
    const started = await call(port, `/auth/sign-in/${CHANNEL}`)
    const { headers } = await call(
      port,
      `/auth/callback/${CHANNEL}?state=state-1&code=good`,
      { headers: { cookie: cookies(started.headers) } },
    )
    const attempt = headers.getSetCookie().find(value => value.startsWith(ATTEMPT_COOKIE)) ?? ''
    expect(attempt).toContain('Max-Age=0')
  })

  it('refuses a callback the browser never started', async () => {
    const port = await compose()
    await call(port, `/auth/sign-in/${CHANNEL}`)
    // No attempt cookie: this is the link-handed-to-someone-else case, and
    // completing it would sign that person in as whoever started the attempt.
    const { status, body } = await call(port, `/auth/callback/${CHANNEL}?state=state-1&code=good`)
    expect(status).toBe(400)
    expect(JSON.parse(body)).toEqual({ error: 'attempt-not-this-browser' })
  })

  it('refuses a callback whose state is not the one this browser holds', async () => {
    const port = await compose()
    const started = await call(port, `/auth/sign-in/${CHANNEL}`)
    const { status } = await call(
      port,
      `/auth/callback/${CHANNEL}?state=state-2&code=good`,
      { headers: { cookie: cookies(started.headers) } },
    )
    expect(status).toBe(400)
  })

  it('reports a sign-in the directory did not complete', async () => {
    const port = await compose()
    const started = await call(port, `/auth/sign-in/${CHANNEL}`)
    const { status, body } = await call(
      port,
      `/auth/callback/${CHANNEL}?state=state-1&error=access_denied`,
      { headers: { cookie: cookies(started.headers) } },
    )
    expect(status).toBe(400)
    expect(JSON.parse(body)).toEqual({ error: 'not-authenticated' })
  })

  it('answers 403 for a verified person this deployment admits as nobody', async () => {
    const port = await compose({ admits: false })
    const started = await call(port, `/auth/sign-in/${CHANNEL}`)
    const { status, body } = await call(
      port,
      `/auth/callback/${CHANNEL}?state=state-1&code=good`,
      { headers: { cookie: cookies(started.headers) } },
    )
    expect(status).toBe(403)
    expect(JSON.parse(body)).toEqual({ error: 'not-admitted' })
  })

  it('checks the browser before it says whether a channel exists', async () => {
    const port = await compose()
    // The binding check runs first on purpose: a request that started no
    // sign-in learns nothing about which directories this deployment offers.
    const { status, body } = await call(port, '/auth/callback/absent?state=s&code=good')
    expect(status).toBe(400)
    expect(JSON.parse(body)).toEqual({ error: 'attempt-not-this-browser' })
  })

  it('answers 404 once the browser is known and the channel is not', async () => {
    const port = await compose()
    const started = await call(port, `/auth/sign-in/${CHANNEL}`)
    const { status, body } = await call(
      port,
      '/auth/callback/absent?state=state-1&code=good',
      { headers: { cookie: cookies(started.headers) } },
    )
    expect(status).toBe(404)
    expect(JSON.parse(body)).toEqual({ error: 'channel-unknown' })
  })

  it('refuses a method that is not a read', async () => {
    const port = await compose()
    expect((await call(port, `/auth/callback/${CHANNEL}`, { method: 'POST' })).status).toBe(405)
  })
})

describe('signing out', () => {
  it('ends the session and clears the cookie', async () => {
    const port = await compose()
    const started = await call(port, `/auth/sign-in/${CHANNEL}`)
    const signedIn = await call(
      port,
      `/auth/callback/${CHANNEL}?state=state-1&code=good`,
      { headers: { cookie: cookies(started.headers) } },
    )
    const { status, headers } = await call(port, '/auth/sign-out', {
      method: 'POST',
      headers: { cookie: cookies(signedIn.headers) },
    })
    expect(status).toBe(204)
    expect(headers.get('set-cookie')).toContain('Max-Age=0')
  })

  it('clears the cookie even when no session was presented', async () => {
    const port = await compose()
    const { status, headers } = await call(port, '/auth/sign-out', { method: 'POST' })
    expect(status).toBe(204)
    expect(headers.get('set-cookie')).toContain(`${SESSION_COOKIE}=`)
  })

  it('refuses a GET, so a link cannot sign someone out', async () => {
    const port = await compose()
    expect((await call(port, '/auth/sign-out')).status).toBe(405)
  })
})
