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
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import { StaticPeopleDirectory } from '@deepseek-ai/dsh-people/static'
import * as StoredAuthSessions from '@deepseek-ai/dsh-auth-session/store'
import * as RequestPrincipal from '@deepseek-ai/dsh-request-principal'
import { IDENTITY_COOKIE } from '@deepseek-ai/dsh-request-principal'
import Storage from '@deepseek-ai/dsh-storage'
import * as StorageJson from '@deepseek-ai/dsh-storage-json'
import * as StorageDomain from '@deepseek-ai/dsh-storage-domain'
import * as PersonalInstructions from '@deepseek-ai/dsh-personal-instructions'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import SessionStore from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { PersonId } from '@deepseek-ai/dsh-people'
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
  root = await mkdtemp(join(tmpdir(), 'dsh-personal-instructions-'))
  const configPath = join(root, 'cordis.yml')
  await writeFile(configPath, [
    "- name: '@deepseek-ai/dsh-storage'",
    "- name: '@deepseek-ai/dsh-storage-json'",
    '  config:',
    `    root: ${JSON.stringify(join(root, 'state'))}`,
    "- name: '@deepseek-ai/dsh-storage-domain'",
    '  config:',
    '    backend: json',
    "- name: '@deepseek-ai/dsh-people/static'",
    '  config:',
    '    people:',
    '      - id: ada',
    '        displayName: Ada',
    '      - id: bo',
    '        displayName: Bo',
    "- name: '@deepseek-ai/dsh-auth-session/store'",
    "- name: '@deepseek-ai/dsh-request-principal'",
    "- name: '@deepseek-ai/dsh-session'",
    "- name: '@deepseek-ai/dsh-session-projection'",
    "- name: '@deepseek-ai/dsh-agent'",
    "- name: '@deepseek-ai/dsh-system-prompt'",
    "- name: '@deepseek-ai/dsh-personal-instructions'",
    "- name: '@deepseek-ai/dsh-api-personal-instructions-controller'",
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
    ['@deepseek-ai/dsh-storage', Storage],
    ['@deepseek-ai/dsh-storage-json', StorageJson],
    ['@deepseek-ai/dsh-storage-domain', StorageDomain],
    ['@deepseek-ai/dsh-people/static', StaticPeopleDirectory],
    ['@deepseek-ai/dsh-auth-session/store', StoredAuthSessions],
    ['@deepseek-ai/dsh-request-principal', RequestPrincipal],
    ['@deepseek-ai/dsh-session', SessionStore],
    ['@deepseek-ai/dsh-session-projection', SessionProjectionRegistry],
    ['@deepseek-ai/dsh-agent', AgentRegistry],
    ['@deepseek-ai/dsh-system-prompt', SystemPrompt],
    ['@deepseek-ai/dsh-personal-instructions', PersonalInstructions],
    ['@deepseek-ai/dsh-api-personal-instructions-controller', PersonalInstructionsController],
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
