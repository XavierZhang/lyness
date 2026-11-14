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
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import { brandString } from '@deepseek-ai/dsh-brand'
import AdminAudit from '@deepseek-ai/dsh-admin-audit'
import Invitations from '@deepseek-ai/dsh-invitations'
import * as InvitingAdmission from '@deepseek-ai/dsh-invitations/admission'
import ManagedPeople from '@deepseek-ai/dsh-managed-people'
import ManagedPeopleDirectory from '@deepseek-ai/dsh-managed-people/directory'
import type { MembershipId, PersonId } from '@deepseek-ai/dsh-people'
import type { ChannelId } from '@deepseek-ai/dsh-sign-in'
import * as StoredAuthSessions from '@deepseek-ai/dsh-auth-session/store'
import * as RequestPrincipal from '@deepseek-ai/dsh-request-principal'
import { IDENTITY_COOKIE } from '@deepseek-ai/dsh-request-principal'
import Storage from '@deepseek-ai/dsh-storage'
import * as StorageJson from '@deepseek-ai/dsh-storage-json'
import * as StorageDomain from '@deepseek-ai/dsh-storage-domain'
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
  root = await mkdtemp(join(tmpdir(), 'dsh-invitations-controller-'))
  const configPath = join(root, 'cordis.yml')
  await writeFile(configPath, [
    "- name: '@deepseek-ai/dsh-storage'",
    "- name: '@deepseek-ai/dsh-storage-json'",
    '  config:',
    `    root: ${JSON.stringify(join(root, 'state'))}`,
    "- name: '@deepseek-ai/dsh-storage-domain'",
    '  config:',
    '    backend: json',
    "- name: '@deepseek-ai/dsh-admin-audit'",
    "- name: '@deepseek-ai/dsh-managed-people'",
    "- name: '@deepseek-ai/dsh-managed-people/directory'",
    '  config:',
    '    people:',
    '      - id: ada',
    '        displayName: Ada',
    '        role: platform-administrator',
    "- name: '@deepseek-ai/dsh-invitations'",
    "- name: '@deepseek-ai/dsh-invitations/admission'",
    '  config:',
    '    bindings: []',
    "- name: '@deepseek-ai/dsh-auth-session/store'",
    "- name: '@deepseek-ai/dsh-request-principal'",
    "- name: '@deepseek-ai/dsh-api-invitations-controller'",
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
    ['@deepseek-ai/dsh-admin-audit', AdminAudit],
    ['@deepseek-ai/dsh-managed-people', ManagedPeople],
    ['@deepseek-ai/dsh-managed-people/directory', ManagedPeopleDirectory],
    ['@deepseek-ai/dsh-invitations', Invitations],
    ['@deepseek-ai/dsh-invitations/admission', InvitingAdmission],
    ['@deepseek-ai/dsh-auth-session/store', StoredAuthSessions],
    ['@deepseek-ai/dsh-request-principal', RequestPrincipal],
    ['@deepseek-ai/dsh-api-invitations-controller', InvitationsController],
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
