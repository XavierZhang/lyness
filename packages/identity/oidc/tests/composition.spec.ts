/**
 * REAL-composition coverage: the channel booted through the vendored Loader
 * beside the sign-in registry, its admission rule and the session store, so
 * what is asserted is a sign-in a deployment could actually serve.
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import SignIn from '@deepseek-ai/dsh-sign-in'
import * as AdmissionRoster from '@deepseek-ai/dsh-sign-in/admission-roster'
import * as StoredAuthSessions from '@deepseek-ai/dsh-auth-session/store'
import Storage from '@deepseek-ai/dsh-storage'
import * as StorageJson from '@deepseek-ai/dsh-storage-json'
import * as StorageDomain from '@deepseek-ai/dsh-storage-domain'
import * as Oidc from '../src/index.ts'
import { CHANNEL_ID } from '../src/index.ts'

const ISSUER = 'https://idp.example'

let root: string | undefined
let context: Context | undefined

/** Whether the stubbed provider answers discovery, so a mount failure can be exercised. */
let reachable = true

beforeEach(() => {
  reachable = true
  vi.stubGlobal('fetch', (input: URL | string) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/.well-known/openid-configuration')) {
      if (!reachable) return Promise.reject(new Error('ECONNREFUSED'))
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          issuer: ISSUER,
          authorization_endpoint: `${ISSUER}/authorize`,
          token_endpoint: `${ISSUER}/token`,
          userinfo_endpoint: `${ISSUER}/userinfo`,
        }),
      } as Response)
    }
    const body = url.pathname.endsWith('/token')
      ? { access_token: 'tok' }
      : { sub: 'person-1', name: 'Ada' }
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response)
  })
})

afterEach(async () => {
  vi.unstubAllGlobals()
  await context?.fiber.dispose()
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  context = undefined
  root = undefined
})

/** Boot the rows through the real Loader. */
async function compose(): Promise<Context> {
  root = await mkdtemp(join(tmpdir(), 'dsh-oidc-'))
  const configPath = join(root, 'cordis.yml')
  await writeFile(configPath, [
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
    '      - channel: oidc',
    `        issuer: ${ISSUER}`,
    '        subject: person-1',
    '        person: ada',
    "- name: '@deepseek-ai/dsh-sign-in'",
    "- name: '@deepseek-ai/dsh-oidc'",
    '  config:',
    `    issuer: ${ISSUER}`,
    '    clientId: deepseek-harness-web',
    '    secret: OIDC_CLIENT_SECRET',
    '',
  ].join('\n'))

  const ctx = new Context()
  context = ctx
  ctx.provide('credentials', { resolve: () => Promise.resolve({ value: 'the-secret' }) })
  ctx.baseUrl = `${pathToFileURL(root).href}/`
  await ctx.plugin(Loader)
  ctx.loader.builtins.include = Include
  const modules = new Map<string, unknown>([
    ['@deepseek-ai/dsh-storage', Storage],
    ['@deepseek-ai/dsh-storage-json', StorageJson],
    ['@deepseek-ai/dsh-storage-domain', StorageDomain],
    ['@deepseek-ai/dsh-auth-session/store', StoredAuthSessions],
    ['@deepseek-ai/dsh-sign-in/admission-roster', AdmissionRoster],
    ['@deepseek-ai/dsh-sign-in', SignIn],
    ['@deepseek-ai/dsh-oidc', Oidc],
  ])
  const base = ctx.loader.internal
  if (base === undefined) throw new Error('this Node build exposes no internal module loader')
  ctx.loader.internal = {
    ...base,
    import: (specifier: string) => {
      const found = modules.get(specifier)
      if (found === undefined) throw new Error(`unexpected Loader import: ${specifier}`)
      return Promise.resolve(found)
    },
  }
  await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(configPath).href } })
  await ctx.loader.await()
  return ctx
}

it('offers itself as a redirect channel a surface can put on a button', async () => {
  const ctx = await compose()
  expect(ctx.signIn.available()).toEqual([
    { id: CHANNEL_ID, displayName: 'Single sign-on', kind: 'redirect' },
  ])
})

it('signs a bound person in, end to end through the registry', async () => {
  const ctx = await compose()
  const begun = await ctx.signIn.begin(CHANNEL_ID, 'https://dsh.example/oauth/callback/oidc')
  if (begun.kind !== 'redirect') throw new Error('a redirect channel began something else')
  expect(begun.start.to).toContain(`${ISSUER}/authorize`)

  const session = await ctx.signIn.resume(
    CHANNEL_ID,
    new URLSearchParams({ state: begun.start.attempt, code: 'the-code' }),
  )
  const established = await ctx.authSessions.read(session)
  expect(established?.person).toBe('ada')
})

it('mounts and still signs in when the provider was unreachable at boot', async () => {
  // A provider that is merely down must not leave the channel permanently
  // broken: the mount logs and the first sign-in reads discovery again.
  reachable = false
  const ctx = await compose()
  expect(ctx.signIn.available()).toHaveLength(1)
  reachable = true
  const begun = await ctx.signIn.begin(CHANNEL_ID, 'https://dsh.example/oauth/callback/oidc')
  if (begun.kind !== 'redirect') throw new Error('a redirect channel began something else')
  expect(begun.start.to).toContain(`${ISSUER}/authorize`)
})

it('stops offering the channel once its row unloads', async () => {
  const ctx = await compose()
  const entry = [...ctx.loader.entries()].find(one => one.options.name === '@deepseek-ai/dsh-oidc')
  if (entry === undefined) throw new Error('the oidc row did not mount')
  await entry.fiber?.dispose()
  expect(ctx.signIn.available()).toEqual([])
})
