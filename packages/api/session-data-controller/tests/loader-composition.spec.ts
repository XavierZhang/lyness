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
import SessionStore, { SESSION_FORMAT_VERSION, SessionId, SessionSeq } from '@lyness/lyn-session'
import type { SessionHeader } from '@lyness/lyn-session'
import SessionProjectionRegistry from '@lyness/lyn-session-projection'
import * as JsonlSessionPersistence from '@lyness/lyn-session-persistence-jsonl'
import SqliteSessionQueryEngine from '@lyness/lyn-session-query-sqlite'
import * as SessionOwnership from '@lyness/lyn-session-ownership'
import SessionVisibility from '@lyness/lyn-session-ownership/visibility'
import { SESSION_OWNER_RECORD_VERSION } from '@lyness/lyn-session-ownership/types'
import SessionDeletion from '@lyness/lyn-session-deletion'
import { brandString } from '@lyness/lyn-brand'
import type { PersonId } from '@lyness/lyn-people'
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
  root = await mkdtemp(join(tmpdir(), 'lyn-session-data-controller-'))
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
    '        role: member',
    '        organization: acme',
    '      - id: bo',
    '        displayName: Bo',
    '        role: member',
    '        organization: acme',
    "- name: '@lyness/lyn-auth-session/store'",
    "- name: '@lyness/lyn-request-principal'",
    "- name: '@lyness/lyn-session'",
    "- name: '@lyness/lyn-session-projection'",
    "- name: '@lyness/lyn-session-persistence-jsonl'",
    '  config:',
    `    root: ${JSON.stringify(join(root, 'sessions'))}`,
    "    compression: 'none'",
    "- name: '@lyness/lyn-session-query-sqlite'",
    '  config:',
    `    path: ${JSON.stringify(join(root, 'session-query.db'))}`,
    "- name: '@lyness/lyn-session-ownership'",
    "- name: '@lyness/lyn-session-ownership/visibility'",
    "- name: '@lyness/lyn-session-deletion'",
    "- name: '@lyness/lyn-api-session-data-controller'",
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
    ['@lyness/lyn-session-persistence-jsonl', JsonlSessionPersistence],
    ['@lyness/lyn-session-query-sqlite', SqliteSessionQueryEngine],
    ['@lyness/lyn-session-ownership', SessionOwnership],
    ['@lyness/lyn-session-ownership/visibility', SessionVisibility],
    ['@lyness/lyn-session-deletion', SessionDeletion],
    ['@lyness/lyn-api-session-data-controller', SessionDataController],
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
