/**
 * REAL-composition coverage: the store and the namespace booted through the
 * vendored Loader beside the directory and the request principal, so what is
 * asserted is the answer a surface actually receives — including that one
 * person's call never reaches another's record.
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
import * as StoredAuthSessions from '@lyness/lyn-auth-session/store'
import * as RequestPrincipal from '@lyness/lyn-request-principal'
import { IDENTITY_COOKIE } from '@lyness/lyn-request-principal'
import Storage from '@lyness/lyn-storage'
import * as StorageJson from '@lyness/lyn-storage-json'
import * as StorageDomain from '@lyness/lyn-storage-domain'
import * as PersonalInstructions from '@lyness/lyn-personal-instructions'
import AgentRegistry from '@lyness/lyn-agent'
import SessionStore from '@lyness/lyn-session'
import SessionProjectionRegistry from '@lyness/lyn-session-projection'
import SystemPrompt from '@lyness/lyn-system-prompt'
import { brandString } from '@lyness/lyn-brand'
import type { PersonId } from '@lyness/lyn-people'
import PersonalInstructionsController from '../src/index.ts'

const ADA = brandString<PersonId>('ada')
const BO = brandString<PersonId>('bo')

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
  root = await mkdtemp(join(tmpdir(), 'lyn-personal-instructions-'))
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
    '      - id: bo',
    '        displayName: Bo',
    "- name: '@lyness/lyn-auth-session/store'",
    "- name: '@lyness/lyn-request-principal'",
    "- name: '@lyness/lyn-session'",
    "- name: '@lyness/lyn-session-projection'",
    "- name: '@lyness/lyn-agent'",
    "- name: '@lyness/lyn-system-prompt'",
    "- name: '@lyness/lyn-personal-instructions'",
    "- name: '@lyness/lyn-api-personal-instructions-controller'",
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
    ['@lyness/lyn-request-principal', RequestPrincipal],
    ['@lyness/lyn-session', SessionStore],
    ['@lyness/lyn-session-projection', SessionProjectionRegistry],
    ['@lyness/lyn-agent', AgentRegistry],
    ['@lyness/lyn-system-prompt', SystemPrompt],
    ['@lyness/lyn-personal-instructions', PersonalInstructions],
    ['@lyness/lyn-api-personal-instructions-controller', PersonalInstructionsController],
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

/** Run one call inside the request scope the presented identity session opens. */
async function asPerson<T>(
  ctx: Context, scopes: readonly Scope[], person: PersonId, run: () => Promise<T>,
): Promise<T | undefined> {
  const established = await ctx.authSessions.establish({ person, method: 'test' })
  const request = new Request('http://127.0.0.1/api', {
    headers: { cookie: `${IDENTITY_COOKIE}=${established.id}` },
  })
  let seen: T | undefined
  for (const scope of scopes) {
    await scope(request, async () => { seen = await run() })
  }
  return seen
}

it('tells a call that presented no identity that it owns nothing', async () => {
  const { ctx } = await compose()
  expect(ctx.personalInstructionsController.describe()).toMatchObject({ owned: false, text: '' })
})

it('keeps one person\'s instructions out of another\'s read', async () => {
  const { ctx, scopes } = await compose()
  await asPerson(ctx, scopes, ADA, () => ctx.personalInstructionsController.save('Call me Sam.'))
  expect(await asPerson(ctx, scopes, ADA, () =>
    Promise.resolve(ctx.personalInstructionsController.describe()))).toMatchObject({
    owned: true, text: 'Call me Sam.',
  })
  // The other person's call answers their own record, which is empty: whose
  // instructions a call acts on is never a parameter it could change.
  expect(await asPerson(ctx, scopes, BO, () =>
    Promise.resolve(ctx.personalInstructionsController.describe()))).toMatchObject({
    owned: true, text: '',
  })
})

it('refuses a write from a call that presented no identity', async () => {
  const { ctx } = await compose()
  await expect(ctx.personalInstructionsController.save('Call me Sam.')).rejects.toThrow(/speaks for nobody/u)
})
