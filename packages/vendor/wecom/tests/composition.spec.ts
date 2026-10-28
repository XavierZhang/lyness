/**
 * REAL-composition coverage: the channel booted through the vendored Loader
 * beside the sign-in registry, its admission rule, and the session store, so
 * what is asserted is a sign-in a deployment could actually serve.
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import SignIn from '@deepseek-ai/dsh-sign-in'
import * as AdmissionRoster from '@deepseek-ai/dsh-sign-in/admission-roster'
import * as StoredAuthSessions from '@deepseek-ai/dsh-auth-session/store'
import Storage from '@deepseek-ai/dsh-storage'
import * as StorageJson from '@deepseek-ai/dsh-storage-json'
import * as StorageDomain from '@deepseek-ai/dsh-storage-domain'
import * as Wecom from '../src/index.ts'
import { CHANNEL_ID } from '../src/index.ts'

let root: string | undefined
let context: Context | undefined

afterEach(async () => {
  vi.unstubAllGlobals()
  await context?.fiber.dispose()
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  context = undefined
  root = undefined
})

/** Boot the rows through the real Loader. */
async function compose(): Promise<Context> {
  root = await mkdtemp(join(tmpdir(), 'dsh-wecom-'))
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
    '      - channel: wecom',
    '        issuer: ww-acme',
    '        subject: ada',
    '        person: ada',
    "- name: '@deepseek-ai/dsh-sign-in'",
    "- name: '@deepseek-ai/dsh-wecom'",
    '  config:',
    '    corpId: ww-acme',
    '    agentId: "1000002"',
    '    secret: WECOM_APP_SECRET',
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
    ['@deepseek-ai/dsh-wecom', Wecom],
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
    { id: CHANNEL_ID, displayName: '企业微信', kind: 'redirect' },
  ])
})

it('signs a bound member in, end to end through the registry', async () => {
  const ctx = await compose()
  vi.stubGlobal('fetch', (input: URL | string) => {
    const url = new URL(String(input))
    const body = url.pathname.endsWith('/gettoken')
      ? { errcode: 0, errmsg: 'ok', access_token: 'tok' }
      : { errcode: 0, errmsg: 'ok', userid: 'ada' }
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response)
  })

  const begun = await ctx.signIn.begin(CHANNEL_ID, 'https://dsh.example/oauth/callback/wecom')
  if (begun.kind !== 'redirect') throw new Error('a redirect channel began something else')
  expect(begun.start.to).toContain('login.work.weixin.qq.com')

  const session = await ctx.signIn.resume(
    CHANNEL_ID,
    new URLSearchParams({ state: begun.start.attempt, code: 'the-code' }),
  )
  const established = await ctx.authSessions.read(session)
  expect(established?.person).toBe('ada')
})

it('refuses a member this deployment binds nobody to', async () => {
  const ctx = await compose()
  vi.stubGlobal('fetch', (input: URL | string) => {
    const url = new URL(String(input))
    const body = url.pathname.endsWith('/gettoken')
      ? { errcode: 0, errmsg: 'ok', access_token: 'tok' }
      : { errcode: 0, errmsg: 'ok', userid: 'somebody-else' }
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response)
  })

  const begun = await ctx.signIn.begin(CHANNEL_ID, 'https://dsh.example/oauth/callback/wecom')
  if (begun.kind !== 'redirect') throw new Error('a redirect channel began something else')
  const refused = await ctx.signIn
    .resume(CHANNEL_ID, new URLSearchParams({ state: begun.start.attempt, code: 'c' }))
    .catch((error: unknown) => error)
  expect((refused as { code?: string }).code).toBe('not-admitted')
})

it('stops offering the channel when its plugin is unloaded', async () => {
  const ctx = await compose()
  const registered = ctx.signIn.available()
  expect(registered).toHaveLength(1)
  // The registration is an effect of the channel's own fiber, so unloading
  // that row — an HMR edit, a disabled entry — takes the button with it.
  const entry = [...ctx.loader.entries()].find(one => one.options.name === '@deepseek-ai/dsh-wecom')
  if (entry?.fiber === undefined) throw new Error('the Loader kept no live entry for the channel')
  await entry.fiber.dispose()
  expect(ctx.signIn.available()).toEqual([])
})
