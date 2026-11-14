/**
 * REAL-composition coverage: the deletion service and the namespace booted
 * through the vendored Loader beside the shipped storage backends, the
 * directory, the request principal and the ownership rule — so what is
 * asserted is the answer a surface actually receives, including that one
 * person's call cannot delete another's conversation.
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
import SessionStore, { SESSION_FORMAT_VERSION, SessionId, SessionSeq } from '@deepseek-ai/dsh-session'
import type { SessionHeader } from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import * as JsonlSessionPersistence from '@deepseek-ai/dsh-session-persistence-jsonl'
import SqliteSessionQueryEngine from '@deepseek-ai/dsh-session-query-sqlite'
import * as SessionOwnership from '@deepseek-ai/dsh-session-ownership'
import SessionVisibility from '@deepseek-ai/dsh-session-ownership/visibility'
import { SESSION_OWNER_RECORD_VERSION } from '@deepseek-ai/dsh-session-ownership/types'
import SessionDeletion from '@deepseek-ai/dsh-session-deletion'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { PersonId } from '@deepseek-ai/dsh-people'
import SessionDataController from '../src/index.ts'

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
  root = await mkdtemp(join(tmpdir(), 'dsh-session-data-controller-'))
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
    '        role: member',
    '        organization: acme',
    '      - id: bo',
    '        displayName: Bo',
    '        role: member',
    '        organization: acme',
    "- name: '@deepseek-ai/dsh-auth-session/store'",
    "- name: '@deepseek-ai/dsh-request-principal'",
    "- name: '@deepseek-ai/dsh-session'",
    "- name: '@deepseek-ai/dsh-session-projection'",
    "- name: '@deepseek-ai/dsh-session-persistence-jsonl'",
    '  config:',
    `    root: ${JSON.stringify(join(root, 'sessions'))}`,
    "    compression: 'none'",
    "- name: '@deepseek-ai/dsh-session-query-sqlite'",
    '  config:',
    `    path: ${JSON.stringify(join(root, 'session-query.db'))}`,
    "- name: '@deepseek-ai/dsh-session-ownership'",
    "- name: '@deepseek-ai/dsh-session-ownership/visibility'",
    "- name: '@deepseek-ai/dsh-session-deletion'",
    "- name: '@deepseek-ai/dsh-api-session-data-controller'",
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
    ['@deepseek-ai/dsh-session-persistence-jsonl', JsonlSessionPersistence],
    ['@deepseek-ai/dsh-session-query-sqlite', SqliteSessionQueryEngine],
    ['@deepseek-ai/dsh-session-ownership', SessionOwnership],
    ['@deepseek-ai/dsh-session-ownership/visibility', SessionVisibility],
    ['@deepseek-ai/dsh-session-deletion', SessionDeletion],
    ['@deepseek-ai/dsh-api-session-data-controller', SessionDataController],
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

/** One stored header. */
const headerOf = (id: string): SessionHeader => ({
  version: SESSION_FORMAT_VERSION,
  id: SessionId(id),
  createdAt: 1,
  cwd: '/work',
  isSeeded: false,
})

/**
 * Store one cold conversation whose own log says who opened it.
 *
 * Written rather than opened live because the rule answers a cold
 * conversation from its log, which is the path a deletion takes.
 * @param ctx - the booted context.
 * @param id - the conversation's id.
 * @param person - who opened it.
 */
async function storeOwnedBy(ctx: Context, id: string, person: PersonId): Promise<void> {
  const handle = await ctx.sessionPersistence.create(headerOf(id))
  await handle.append([{
    type: 'session/owner',
    seq: SessionSeq(0),
    time: 2,
    data: {
      version: SESSION_OWNER_RECORD_VERSION,
      owner: person,
      openedAt: '2026-10-29T00:00:00.000Z',
    },
  }])
  await handle.close()
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

it('keeps one person\'s conversation out of another\'s deletion', { timeout: 30_000 }, async () => {
  const { ctx, scopes } = await compose()
  await storeOwnedBy(ctx, 'ada-conversation', ADA)
  await storeOwnedBy(ctx, 'bo-conversation', BO)

  // Bo holds Ada's id — the only way they could, in a test — and is answered
  // exactly as for a conversation that never existed.
  await expect(asPerson(ctx, scopes, BO, () => ctx.sessionDataController.delete('ada-conversation')))
    .rejects.toMatchObject({ code: 'session-data/not-found' })
  expect(await ctx.sessionPersistence.stat(SessionId('ada-conversation'))).toBeDefined()

  // Her own deletion lands, and takes only hers.
  expect(await asPerson(ctx, scopes, ADA, () => ctx.sessionDataController.delete('ada-conversation')))
    .toEqual({ removed: ['ada-conversation'] })
  expect(await ctx.sessionPersistence.stat(SessionId('ada-conversation'))).toBeUndefined()
  expect(await ctx.sessionPersistence.stat(SessionId('bo-conversation'))).toBeDefined()
})

it('lets the deployment acting on itself delete an attributed conversation', { timeout: 30_000 }, async () => {
  const { ctx } = await compose()
  await storeOwnedBy(ctx, 'ada-conversation', ADA)
  // A call with no request principal is the deployment acting on itself,
  // which is what keeps a CLI run and a scheduled follow-up working; the
  // ownership rule admits it, so this deletion lands.
  expect(await ctx.sessionDataController.delete('ada-conversation'))
    .toEqual({ removed: ['ada-conversation'] })
  expect(await ctx.sessionPersistence.stat(SessionId('ada-conversation'))).toBeUndefined()
})

it('answers an id nobody stored as it answers another person\'s', { timeout: 30_000 }, async () => {
  const { ctx, scopes } = await compose()
  await storeOwnedBy(ctx, 'ada-conversation', ADA)
  await expect(asPerson(ctx, scopes, ADA, () => ctx.sessionDataController.delete('never-existed')))
    .rejects.toMatchObject({ code: 'session-data/not-found' })
})
