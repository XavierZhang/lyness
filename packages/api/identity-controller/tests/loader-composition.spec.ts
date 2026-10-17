/**
 * REAL-composition coverage: the namespace booted through the vendored Loader
 * beside the directory, the sign-in registry and the request principal, so
 * what is asserted is the answer a surface actually receives.
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, expect, it } from 'vitest'
import { Context } from '@lyness/cordis'
import Loader from '@lyness/cordis-plugin-loader'
import Include from '@lyness/cordis-plugin-include'
import { StaticPeopleDirectory } from '@lyness/lyn-people/static'
import SignIn from '@lyness/lyn-sign-in'
import * as AdmissionRoster from '@lyness/lyn-sign-in/admission-roster'
import * as StoredAuthSessions from '@lyness/lyn-auth-session/store'
import * as RequestPrincipal from '@lyness/lyn-request-principal'
import { IDENTITY_COOKIE } from '@lyness/lyn-request-principal'
import Storage from '@lyness/lyn-storage'
import * as StorageJson from '@lyness/lyn-storage-json'
import * as StorageDomain from '@lyness/lyn-storage-domain'
import { brandString } from '@lyness/lyn-brand'
import type { PersonId } from '@lyness/lyn-people'
import IdentityController from '../src/index.ts'

const ADA = brandString<PersonId>('ada')

let root: string | undefined
let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  context = undefined
  root = undefined
})

/** One registered request scope, captured from the connection double. */
type Scope = (request: Request, run: () => Promise<unknown>) => Promise<unknown>

/** Boot the rows through the real Loader, and keep the request scope they registered. */
async function compose(): Promise<{ ctx: Context; scopes: Scope[] }> {
  root = await mkdtemp(join(tmpdir(), 'lyn-identity-controller-'))
  const configPath = join(root, 'cordis.yml')
  await writeFile(configPath, [
    "- name: '@lyness/lyn-storage'",
    "- name: '@lyness/lyn-storage-json'",
    '  config:',
    `    root: ${JSON.stringify(join(root, 'state'))}`,
    "- name: '@lyness/lyn-storage-domain'",
    '  config:',
    '    backend: json',
    "- name: '@lyness/lyn-people/static'",
    '  config:',
    '    people:',
    '      - id: ada',
    '        displayName: Ada',
    '        role: tenant-administrator',
    '        organization: acme',
    "- name: '@lyness/lyn-auth-session/store'",
    "- name: '@lyness/lyn-sign-in/admission-roster'",
    '  config:',
    '    bindings: []',
    "- name: '@lyness/lyn-sign-in'",
    "- name: '@lyness/lyn-request-principal'",
    "- name: '@lyness/lyn-api-identity-controller'",
    '',
  ].join('\n'))

  const ctx = new Context()
  context = ctx
  const scopes: Scope[] = []
  ctx.provide('connection', {
    rpc: { scope: (scope: Scope) => { scopes.push(scope); return () => Promise.resolve() } },
  })
  ctx.baseUrl = `${pathToFileURL(root).href}/`
  await ctx.plugin(Loader)
  ctx.loader.builtins.include = Include
  const modules = new Map<string, unknown>([
    ['@lyness/lyn-storage', Storage],
    ['@lyness/lyn-storage-json', StorageJson],
    ['@lyness/lyn-storage-domain', StorageDomain],
    ['@lyness/lyn-people/static', StaticPeopleDirectory],
    ['@lyness/lyn-auth-session/store', StoredAuthSessions],
    ['@lyness/lyn-sign-in/admission-roster', AdmissionRoster],
    ['@lyness/lyn-sign-in', SignIn],
    ['@lyness/lyn-request-principal', RequestPrincipal],
    ['@lyness/lyn-api-identity-controller', IdentityController],
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
  return { ctx, scopes }
}

it('tells a signed-out viewer that this deployment has accounts and offers no channel yet', async () => {
  const { ctx } = await compose()
  expect(await ctx.identityController.viewer()).toEqual({
    accounts: true,
    channels: [],
    signInPrefix: '/auth/sign-in',
    signOutPath: '/auth/sign-out',
  })
})

it('names the person and the standing inside the request scope their session opens', async () => {
  const { ctx, scopes } = await compose()
  const established = await ctx.authSessions.establish({ person: ADA, method: 'test' })
  const request = new Request('http://127.0.0.1/api', {
    headers: { cookie: `${IDENTITY_COOKIE}=${established.id}` },
  })
  let seen: Awaited<ReturnType<typeof ctx.identityController.viewer>> | undefined
  for (const scope of scopes) {
    await scope(request, async () => { seen = await ctx.identityController.viewer() })
  }
  expect(seen).toMatchObject({ accounts: true, person: { id: 'ada', displayName: 'Ada' } })
})
