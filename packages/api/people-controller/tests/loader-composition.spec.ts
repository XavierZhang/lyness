/**
 * REAL-composition coverage: the namespace booted through the vendored Loader
 * beside the managed directory, the admission rule and the principal, so what
 * is asserted is what one administrator's change actually does — somebody who
 * could not sign in is admitted afterwards, and the written roster stays the
 * operator's.
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, expect, it } from 'vitest'
import { Context } from '@lyness/cordis'
import Loader from '@lyness/cordis-plugin-loader'
import Include from '@lyness/cordis-plugin-include'
import { brandString } from '@lyness/lyn-brand'
import AdminAudit from '@lyness/lyn-admin-audit'
import ManagedPeople from '@lyness/lyn-managed-people'
import ManagedPeopleDirectory from '@lyness/lyn-managed-people/directory'
import ManagedAdmission from '@lyness/lyn-managed-people/admission'
import type { MembershipId, PersonId } from '@lyness/lyn-people'
import type { ChannelId } from '@lyness/lyn-sign-in'
import * as StoredAuthSessions from '@lyness/lyn-auth-session/store'
import * as RequestPrincipal from '@lyness/lyn-request-principal'
import { IDENTITY_COOKIE } from '@lyness/lyn-request-principal'
import Storage from '@lyness/lyn-storage'
import * as StorageJson from '@lyness/lyn-storage-json'
import * as StorageDomain from '@lyness/lyn-storage-domain'
import { RemoteError } from '@lyness/lyn-typert-protocol'
import PeopleController from '../src/index.ts'

const ADA = brandString<PersonId>('ada')
const ADA_STANDING = brandString<MembershipId>('ada:platform-administrator')

/** One registered request scope, captured from the connection double. */
type Scope = (request: Request, run: () => Promise<unknown>) => Promise<unknown>

let root: string | undefined
let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  context = undefined
  root = undefined
})

/** Boot the rows through the real Loader, with Ada as the written administrator. */
async function compose(): Promise<{ ctx: Context; scopes: Scope[] }> {
  root = await mkdtemp(join(tmpdir(), 'lyn-people-controller-'))
  const configPath = join(root, 'cordis.yml')
  await writeFile(configPath, [
    "- name: '@lyness/lyn-storage'",
    "- name: '@lyness/lyn-storage-json'",
    '  config:',
    `    root: ${JSON.stringify(join(root, 'state'))}`,
    "- name: '@lyness/lyn-storage-domain'",
    '  config:',
    '    backend: json',
    "- name: '@lyness/lyn-admin-audit'",
    '  config:',
    '    maxValueLength: 2000',
    "- name: '@lyness/lyn-managed-people'",
    "- name: '@lyness/lyn-managed-people/directory'",
    '  config:',
    '    people:',
    '      - id: ada',
    '        displayName: Ada',
    '        role: platform-administrator',
    "- name: '@lyness/lyn-managed-people/admission'",
    '  config:',
    '    bindings: []',
    "- name: '@lyness/lyn-auth-session/store'",
    "- name: '@lyness/lyn-request-principal'",
    "- name: '@lyness/lyn-api-people-controller'",
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
    ['@lyness/lyn-admin-audit', AdminAudit],
    ['@lyness/lyn-managed-people', ManagedPeople],
    ['@lyness/lyn-managed-people/directory', ManagedPeopleDirectory],
    ['@lyness/lyn-managed-people/admission', ManagedAdmission],
    ['@lyness/lyn-auth-session/store', StoredAuthSessions],
    ['@lyness/lyn-request-principal', RequestPrincipal],
    ['@lyness/lyn-api-people-controller', PeopleController],
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

/**
 * Run one call the way a signed-in request runs it: inside the scope the
 * principal registered, with the cookie that names Ada's session.
 * @param composed - the booted deployment and its registered scopes.
 * @param call - what to run as Ada.
 * @returns what the call answered.
 */
async function asAda<T>(composed: { ctx: Context; scopes: Scope[] }, call: () => Promise<T>): Promise<T> {
  const established = await composed.ctx.authSessions.establish({ person: ADA, method: 'test' })
  // Signing in produces a session for a person; which standing is in force is
  // the session's acting context, and administering is a standing's doing.
  await composed.ctx.authSessions.switchContext(established.id, { person: ADA, membership: ADA_STANDING })
  const request = new Request('http://127.0.0.1/api', {
    headers: { cookie: `${IDENTITY_COOKIE}=${established.id}` },
  })
  let answered!: T
  let ran = false
  for (const scope of composed.scopes) {
    await scope(request, async () => { answered = await call(); ran = true })
  }
  // A verb that answers nothing still ran, so the flag is what says so.
  if (!ran) throw new Error('no request scope ran the call')
  return answered
}

it('turns one administrator change into somebody who can sign in', async () => {
  const composed = await compose()
  const { ctx } = composed
  const identity = { channel: brandString<ChannelId>('acme-wecom'), issuer: 'ww-acme', subject: 'bea' }

  expect(await ctx.signInAdmission.admit(identity)).toBeUndefined()
  const added = await asAda(composed, () => ctx.peopleController.save({
    displayName: 'Bea', role: 'member', organization: 'acme',
  }))
  // Adding a person admits nobody: a directory identity is a second
  // decision, and until it is made the sign-in page refuses them.
  expect(await ctx.signInAdmission.admit(identity)).toBeUndefined()

  await asAda(composed, () => ctx.peopleController.bind({
    channel: 'acme-wecom', issuer: 'ww-acme', subject: 'bea', person: added.id,
  }))
  expect(await ctx.signInAdmission.admit(identity)).toEqual(added.id)
  expect(await ctx.people.person(brandString<PersonId>(added.id))).toMatchObject({ displayName: 'Bea' })

  await asAda(composed, () => ctx.peopleController.unbind({
    channel: 'acme-wecom', issuer: 'ww-acme', subject: 'bea',
  }))
  expect(await ctx.signInAdmission.admit(identity)).toBeUndefined()
})

it('leaves the roster the operator wrote to the operator', async () => {
  const composed = await compose()
  const { ctx } = composed

  expect(await asAda(composed, () => ctx.peopleController.list()))
    .toEqual([{ id: 'ada', displayName: 'Ada', role: 'platform-administrator', written: true, bindings: [] }])
  // The next boot reads the file again, so this surface refuses rather than
  // reporting a change that would not survive it.
  const refused = await asAda(composed, async () => {
    try {
      await ctx.peopleController.remove('ada')
      return undefined
    } catch (failed: unknown) {
      return failed instanceof RemoteError ? String(failed.code) : undefined
    }
  })
  expect(refused).toBe('people/written')
})
