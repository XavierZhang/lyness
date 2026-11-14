/**
 * REAL-composition coverage: the namespace booted through the vendored Loader
 * beside the invitations, the admission rule that honours them and the
 * principal, so what is asserted is what one administrator's call actually
 * does — a stranger the deployment refused is admitted afterwards, and
 * withdrawing the invitation refuses them again.
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
import Invitations from '@lyness/lyn-invitations'
import * as InvitingAdmission from '@lyness/lyn-invitations/admission'
import ManagedPeople from '@lyness/lyn-managed-people'
import ManagedPeopleDirectory from '@lyness/lyn-managed-people/directory'
import type { MembershipId, PersonId } from '@lyness/lyn-people'
import type { ChannelId } from '@lyness/lyn-sign-in'
import * as StoredAuthSessions from '@lyness/lyn-auth-session/store'
import * as RequestPrincipal from '@lyness/lyn-request-principal'
import { IDENTITY_COOKIE } from '@lyness/lyn-request-principal'
import Storage from '@lyness/lyn-storage'
import * as StorageJson from '@lyness/lyn-storage-json'
import * as StorageDomain from '@lyness/lyn-storage-domain'
import InvitationsController from '../src/index.ts'

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
  root = await mkdtemp(join(tmpdir(), 'lyn-invitations-controller-'))
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
    "- name: '@lyness/lyn-managed-people'",
    "- name: '@lyness/lyn-managed-people/directory'",
    '  config:',
    '    people:',
    '      - id: ada',
    '        displayName: Ada',
    '        role: platform-administrator',
    "- name: '@lyness/lyn-invitations'",
    "- name: '@lyness/lyn-invitations/admission'",
    '  config:',
    '    bindings: []',
    "- name: '@lyness/lyn-auth-session/store'",
    "- name: '@lyness/lyn-request-principal'",
    "- name: '@lyness/lyn-api-invitations-controller'",
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
    ['@lyness/lyn-invitations', Invitations],
    ['@lyness/lyn-invitations/admission', InvitingAdmission],
    ['@lyness/lyn-auth-session/store', StoredAuthSessions],
    ['@lyness/lyn-request-principal', RequestPrincipal],
    ['@lyness/lyn-api-invitations-controller', InvitationsController],
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

it('turns one issued code into somebody this deployment admits', async () => {
  const composed = await compose()
  const { ctx } = composed
  const subject = { channel: brandString<ChannelId>('acme-wecom'), issuer: 'ww-acme', subject: 'bea' }

  // The roster has never heard of them, so without a code they are nobody.
  expect(await ctx.signInAdmission.admit(subject)).toBeUndefined()

  const issued = await asAda(composed, () => ctx.invitationsController.issue({
    label: 'Bea', role: 'member', organization: 'acme',
  }))
  const code = issued.code
  if (code === undefined) throw new Error('this issue answered no code')

  const admitted = await ctx.signInAdmission.admit(subject, { invitation: code })
  expect(admitted).toEqual(expect.any(String))
  expect(await ctx.people.memberships(brandString<PersonId>(String(admitted))))
    .toMatchObject([{ role: 'member', organization: 'acme' }])
  // The redemption is what the surface reads back, not a second list.
  expect(await asAda(composed, () => ctx.invitationsController.list()))
    .toEqual([expect.objectContaining({ id: issued.id, uses: 1 })])
})

it('refuses the next stranger once the administrator withdraws it', async () => {
  const composed = await compose()
  const { ctx } = composed
  const issued = await asAda(composed, () => ctx.invitationsController.issue({
    label: 'The team', role: 'member', organization: 'acme', maxUses: 5,
  }))
  const code = issued.code
  if (code === undefined) throw new Error('this issue answered no code')

  await asAda(composed, () => ctx.invitationsController.revoke(issued.id))

  const subject = { channel: brandString<ChannelId>('acme-wecom'), issuer: 'ww-acme', subject: 'bea' }
  expect(await ctx.signInAdmission.admit(subject, { invitation: code })).toBeUndefined()
  // Withdrawn and still listed, with the uses it never had.
  expect(await asAda(composed, () => ctx.invitationsController.list()))
    .toEqual([expect.objectContaining({ id: issued.id, uses: 0, open: false })])
})
