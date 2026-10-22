/**
 * REAL-composition coverage: the namespace booted through the vendored Loader
 * beside the bot roster, the real preset registry, the managed directory and
 * the principal, so what is asserted is what one administrator's change
 * actually does — a bot that exists in the roster and runs with a preset the
 * deployment declared, and that no directory identity can be admitted as.
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
import AgentPreset from '@lyness/lyn-agent-preset'
import AgentPresets from '@lyness/lyn-agent-preset-registry'
import ManagedBots from '@lyness/lyn-managed-bots'
import ManagedPeople from '@lyness/lyn-managed-people'
import ManagedPeopleDirectory from '@lyness/lyn-managed-people/directory'
import ManagedAdmission from '@lyness/lyn-managed-people/admission'
import type { MembershipId, PersonId } from '@lyness/lyn-people'
import SessionProjectionRegistry from '@lyness/lyn-session-projection'
import type { ChannelId } from '@lyness/lyn-sign-in'
import * as StoredAuthSessions from '@lyness/lyn-auth-session/store'
import * as RequestPrincipal from '@lyness/lyn-request-principal'
import { IDENTITY_COOKIE } from '@lyness/lyn-request-principal'
import Storage from '@lyness/lyn-storage'
import * as StorageJson from '@lyness/lyn-storage-json'
import * as StorageDomain from '@lyness/lyn-storage-domain'
import { RemoteError } from '@lyness/lyn-typert-protocol'
import BotsController from '../src/index.ts'

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
  root = await mkdtemp(join(tmpdir(), 'lyn-bots-controller-'))
  const configPath = join(root, 'cordis.yml')
  await writeFile(configPath, [
    "- name: '@lyness/lyn-storage'",
    "- name: '@lyness/lyn-storage-json'",
    '  config:',
    `    root: ${JSON.stringify(join(root, 'state'))}`,
    "- name: '@lyness/lyn-storage-domain'",
    '  config:',
    '    backend: json',
    "- name: '@lyness/lyn-session-projection'",
    "- name: '@lyness/lyn-agent-preset-registry'",
    '  config:',
    '    default: standard',
    "- name: '@lyness/lyn-agent-preset'",
    '  config:',
    '    id: standard',
    '    name: Standard',
    '    plugins: []',
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
    "- name: '@lyness/lyn-managed-bots'",
    "- name: '@lyness/lyn-auth-session/store'",
    "- name: '@lyness/lyn-request-principal'",
    "- name: '@lyness/lyn-api-bots-controller'",
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
    ['@lyness/lyn-session-projection', SessionProjectionRegistry],
    ['@lyness/lyn-agent-preset-registry', AgentPresets],
    ['@lyness/lyn-agent-preset', AgentPreset],
    ['@lyness/lyn-managed-people', ManagedPeople],
    ['@lyness/lyn-managed-people/directory', ManagedPeopleDirectory],
    ['@lyness/lyn-managed-people/admission', ManagedAdmission],
    ['@lyness/lyn-managed-bots', ManagedBots],
    ['@lyness/lyn-auth-session/store', StoredAuthSessions],
    ['@lyness/lyn-request-principal', RequestPrincipal],
    ['@lyness/lyn-api-bots-controller', BotsController],
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

it('turns one administrator change into a bot the deployment knows', async () => {
  const composed = await compose()
  const { ctx } = composed

  // What a bot may be given is what this deployment declared, by name.
  expect(await asAda(composed, () => ctx.botsController.presets()))
    .toEqual([{ id: 'standard', displayName: 'Standard' }])

  const added = await asAda(composed, () => ctx.botsController.save({
    displayName: 'Triage',
    organization: 'acme',
    persona: 'You answer in short sentences.',
    job: 'Reads incoming reports and files them.',
    preset: 'standard',
  }))
  expect(added).toMatchObject({ available: true, written: false })

  // The roster answers it, which is what makes a conversation it opens
  // resolve an owner without anything knowing about bots.
  expect(await ctx.people.person(brandString<PersonId>(added.id))).toMatchObject({ displayName: 'Triage' })
  expect(await ctx.people.memberships(brandString<PersonId>(added.id))).toEqual([
    expect.objectContaining({ organization: 'acme', role: 'member' }),
  ])

  await asAda(composed, () => ctx.botsController.remove(added.id))
  expect(await ctx.people.person(brandString<PersonId>(added.id))).toBeUndefined()
})

it('admits no directory identity as a bot, however it is named', async () => {
  const composed = await compose()
  const { ctx } = composed
  const added = await asAda(composed, () => ctx.botsController.save({
    displayName: 'Triage', organization: 'acme', persona: '', job: '', preset: 'standard',
  }))
  const identity = { channel: brandString<ChannelId>('acme-wecom'), issuer: 'ww-acme', subject: 'triage' }

  const refused = await asAda(composed, async () => {
    try {
      await ctx.managedPeople.bind(
        { channel: 'acme-wecom', issuer: 'ww-acme', subject: 'triage', person: brandString<PersonId>(added.id) },
        { id: ADA_STANDING, person: ADA, role: 'platform-administrator' },
      )
      return undefined
    } catch (failed: unknown) {
      return failed instanceof Error ? failed.message : undefined
    }
  })
  expect(refused).toContain('does not sign in')
  expect(await ctx.signInAdmission.admit(identity)).toBeUndefined()
})

it('refuses a preset this deployment never declared', async () => {
  const composed = await compose()
  const { ctx } = composed
  const code = await asAda(composed, async () => {
    try {
      await ctx.botsController.save({
        displayName: 'Ghost', organization: 'acme', persona: '', job: '', preset: 'nothing-declares-this',
      })
      return undefined
    } catch (failed: unknown) {
      return failed instanceof RemoteError ? String(failed.code) : undefined
    }
  })
  expect(code).toBe('bots/unknown-preset')
})
