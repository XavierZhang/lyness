/**
 * REAL-composition coverage: a test-only cordis.yml booted through the
 * vendored Loader mounts the session store, the projection registry, the
 * sessions' identity chain, and both halves of this package. The assertions
 * are the durable outcome — what a session created by a signed-in call
 * carries in its own log — and what a second person's call may see of it.
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, expect, it } from 'vitest'
import { Context } from '@lyness/cordis'
import Loader from '@lyness/cordis-plugin-loader'
import Include from '@lyness/cordis-plugin-include'
import SessionStore from '@lyness/lyn-session'
import type { Session } from '@lyness/lyn-session'
import SessionProjectionRegistry from '@lyness/lyn-session-projection'
import Storage from '@lyness/lyn-storage'
import * as StorageJson from '@lyness/lyn-storage-json'
import * as StorageDomain from '@lyness/lyn-storage-domain'
import * as StoredAuthSessions from '@lyness/lyn-auth-session/store'
import * as RequestPrincipal from '@lyness/lyn-request-principal'
import { IDENTITY_COOKIE } from '@lyness/lyn-request-principal'
import { brandString } from '@lyness/lyn-brand'
import { StaticPeopleDirectory } from '@lyness/lyn-people/static'
import type { PersonId } from '@lyness/lyn-people'
import * as SessionOwnership from '../src/index.ts'
import SessionVisibility from '../src/visibility.ts'
import type { SessionOwnerRecord } from '../src/index.ts'

const ADA = brandString<PersonId>('ada')
const BEA = brandString<PersonId>('bea')

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
  root = await mkdtemp(join(tmpdir(), 'lyn-session-ownership-'))
  const configPath = join(root, 'cordis.yml')
  await writeFile(configPath, [
    "- name: '@lyness/lyn-session'",
    "- name: '@lyness/lyn-session-projection'",
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
    '      - id: bea',
    '        displayName: Bea',
    '        role: member',
    "- name: '@lyness/lyn-auth-session/store'",
    "- name: '@lyness/lyn-request-principal'",
    "- name: '@lyness/lyn-session-ownership'",
    "- name: '@lyness/lyn-session-ownership/visibility'",
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
    ['@lyness/lyn-session', SessionStore],
    ['@lyness/lyn-session-projection', SessionProjectionRegistry],
    ['@lyness/lyn-storage', Storage],
    ['@lyness/lyn-storage-json', StorageJson],
    ['@lyness/lyn-storage-domain', StorageDomain],
    ['@lyness/lyn-people/static', StaticPeopleDirectory],
    ['@lyness/lyn-auth-session/store', StoredAuthSessions],
    ['@lyness/lyn-request-principal', RequestPrincipal],
    ['@lyness/lyn-session-ownership', SessionOwnership],
    ['@lyness/lyn-session-ownership/visibility', SessionVisibility],
  ])
  const base = ctx.loader.internal
  if (base === undefined) throw new Error('this Node build exposes no internal module loader')
  // A copy with `import` replaced: the internal loader is cached
  // process-wide, so changing it would reroute every other spec.
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

/** Every ownership record in one session's own log. */
function records(session: Session): SessionOwnerRecord[] {
  return session.ownEvents()
    .filter(event => event.type === 'session/owner')
    .map(event => event.data)
}

it('attributes a session created inside a signed-in call, and leaves one created outside unowned', async () => {
  const { ctx, scopes } = await compose()
  const established = await ctx.authSessions.establish({ person: ADA, method: 'test' })

  // Outside any call, there is no principal: the session carries no owner.
  // The stamp runs on the microtask after the read-only creation announcement,
  // so each assertion waits that turn.
  const unowned = ctx.sessions.create()
  await Promise.resolve()
  expect(records(unowned)).toEqual([])

  // Inside the request scope the signed-in session opens, it does.
  const request = new Request('http://127.0.0.1/api', { headers: { cookie: `${IDENTITY_COOKIE}=${established.id}` } })
  let attributed: SessionOwnerRecord[] = []
  for (const scope of scopes) {
    await scope(request, async () => {
      // Awaited inside the scope: the principal this stamp reads is published
      // for the duration of the call, so the turn has to pass before it ends.
      const session = ctx.sessions.create()
      await Promise.resolve()
      attributed = records(session)
    })
  }
  expect(attributed).toMatchObject([{ version: 1, owner: ADA }])
})

it('shows each person their own conversation and not the other\'s', async () => {
  const { ctx, scopes } = await compose()

  /** Run one call as the person whose signed-in session this is. */
  const asPerson = async <T>(person: PersonId, call: () => Promise<T>): Promise<T> => {
    const established = await ctx.authSessions.establish({ person, method: 'test' })
    const request = new Request('http://127.0.0.1/api', {
      headers: { cookie: `${IDENTITY_COOKIE}=${established.id}` },
    })
    let answered: T | undefined
    for (const scope of scopes) await scope(request, async () => { answered = await call() })
    if (answered === undefined) throw new Error('no request scope ran the call')
    return answered
  }

  const mine = await asPerson(ADA, () => Promise.resolve(ctx.sessions.create()))
  const theirs = await asPerson(BEA, () => Promise.resolve(ctx.sessions.create()))

  expect(await asPerson(ADA, () => ctx.sessionVisibility.mayRead(mine))).toBe(true)
  expect(await asPerson(ADA, () => ctx.sessionVisibility.mayRead(theirs))).toBe(false)
  expect(await asPerson(BEA, () => ctx.sessionVisibility.mayRead(theirs))).toBe(true)
  // Outside a request there is no principal: the deployment reads its own.
  expect(await ctx.sessionVisibility.mayRead(theirs)).toBe(true)
})
