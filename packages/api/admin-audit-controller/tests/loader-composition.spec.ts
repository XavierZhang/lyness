/**
 * REAL-composition coverage: the namespace booted through the vendored Loader
 * beside the trail, the managed directory and the principal, so what is
 * asserted is what one administrator's change actually leaves behind — the
 * person they added, the role they changed, and the value that change
 * replaced, read back through the surface on their own standing.
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
import type { Membership, MembershipId, PersonId } from '@lyness/lyn-people'
import * as StoredAuthSessions from '@lyness/lyn-auth-session/store'
import * as RequestPrincipal from '@lyness/lyn-request-principal'
import { IDENTITY_COOKIE } from '@lyness/lyn-request-principal'
import Storage from '@lyness/lyn-storage'
import * as StorageJson from '@lyness/lyn-storage-json'
import * as StorageDomain from '@lyness/lyn-storage-domain'
import AdminAuditController from '../src/index.ts'

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
  root = await mkdtemp(join(tmpdir(), 'lyn-audit-controller-'))
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
    "- name: '@lyness/lyn-api-admin-audit-controller'",
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
    ['@lyness/lyn-api-admin-audit-controller', AdminAuditController],
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
  await composed.ctx.authSessions.switchContext(established.id, { person: ADA, membership: ADA_STANDING })
  const request = new Request('http://127.0.0.1/api', {
    headers: { cookie: `${IDENTITY_COOKIE}=${established.id}` },
  })
  let answered!: T
  let ran = false
  for (const scope of composed.scopes) {
    await scope(request, async () => { answered = await call(); ran = true })
  }
  if (!ran) throw new Error('no request scope ran the call')
  return answered
}

it('reads back what one administrator\'s changes replaced', async () => {
  const composed = await compose()
  const { ctx } = composed

  // The roster is driven directly rather than through its own surface: what
  // this composition is here to show is that the booted namespace reads the
  // trail those changes wrote.
  const by: Membership = { id: ADA_STANDING, person: ADA, role: 'platform-administrator' }
  const added = await ctx.managedPeople.save({ displayName: 'Bea', role: 'member', organization: 'acme' }, by)
  await ctx.managedPeople.save({
    id: brandString<PersonId>(added.id), displayName: 'Bea', role: 'tenant-administrator', organization: 'acme',
  }, by)

  // The booted surface answers the trail the roster wrote, on Ada's own
  // standing: a platform one, so an unnamed read is every organization's.
  const read = await asAda(composed, () => ctx.adminAuditController.read({}))

  expect(read.map(entry => [entry.kind, entry.action])).toEqual([['person', 'changed'], ['person', 'added']])
  expect(read[0]?.changes).toEqual([{ field: 'role', before: 'member', after: 'tenant-administrator' }])
  expect(read[1]).toMatchObject({ subjectName: 'Bea', organization: 'acme', by: 'ada' })
})
