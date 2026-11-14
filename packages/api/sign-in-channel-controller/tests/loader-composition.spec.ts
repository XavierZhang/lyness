/**
 * REAL-composition coverage: the namespace booted through the vendored Loader
 * beside the kinds, the store, the credential document and the directory, so
 * what is asserted is what one administrator's change actually does — a
 * channel that was not there is offered on the sign-in page afterwards, and
 * its secret is in the credential store rather than in the record.
 */

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, expect, it } from 'vitest'
import { Context } from '@lyness/cordis'
import Loader from '@lyness/cordis-plugin-loader'
import Include from '@lyness/cordis-plugin-include'
import { brandString } from '@lyness/lyn-brand'
import CredentialsLocal from '@lyness/lyn-credentials-local'
import { StaticPeopleDirectory } from '@lyness/lyn-people/static'
import type { MembershipId, PersonId } from '@lyness/lyn-people'
import SignIn from '@lyness/lyn-sign-in'
import ChannelKindRegistry from '@lyness/lyn-sign-in/kinds'
import * as AdmissionRoster from '@lyness/lyn-sign-in/admission-roster'
import AdminAudit from '@lyness/lyn-admin-audit'
import ConfiguredChannels from '@lyness/lyn-sign-in-channels'
import * as Wecom from '@lyness/lyn-wecom/kind'
import * as StoredAuthSessions from '@lyness/lyn-auth-session/store'
import * as RequestPrincipal from '@lyness/lyn-request-principal'
import { IDENTITY_COOKIE } from '@lyness/lyn-request-principal'
import Storage from '@lyness/lyn-storage'
import * as StorageJson from '@lyness/lyn-storage-json'
import * as StorageDomain from '@lyness/lyn-storage-domain'
import SignInChannelController from '../src/index.ts'

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

/** Boot the rows through the real Loader, signed in as the platform administrator. */
async function compose(): Promise<{ ctx: Context; scopes: Scope[] }> {
  root = await mkdtemp(join(tmpdir(), 'lyn-sign-in-channel-controller-'))
  const configPath = join(root, 'cordis.yml')
  // The provider refuses a document anyone but its owner can read, which is
  // the same check a deployment's own file passes.
  await writeFile(join(root, 'credentials.yaml'), 'version: 1\nrefs: {}\n', { mode: 0o600 })
  await writeFile(configPath, [
    "- name: '@lyness/lyn-storage'",
    "- name: '@lyness/lyn-storage-json'",
    '  config:',
    `    root: ${JSON.stringify(join(root, 'state'))}`,
    "- name: '@lyness/lyn-storage-domain'",
    '  config:',
    '    backend: json',
    "- name: '@lyness/lyn-credentials-local'",
    '  config:',
    `    path: ${JSON.stringify(join(root, 'credentials.yaml'))}`,
    '    watch: false',
    "- name: '@lyness/lyn-people/static'",
    '  config:',
    '    people:',
    '      - id: ada',
    '        displayName: Ada',
    '        role: platform-administrator',
    "- name: '@lyness/lyn-auth-session/store'",
    "- name: '@lyness/lyn-sign-in/admission-roster'",
    '  config:',
    '    bindings: []',
    "- name: '@lyness/lyn-sign-in'",
    "- name: '@lyness/lyn-sign-in/kinds'",
    "- name: '@lyness/lyn-wecom/kind'",
    "- name: '@lyness/lyn-admin-audit'",
    "- name: '@lyness/lyn-sign-in-channels'",
    "- name: '@lyness/lyn-request-principal'",
    "- name: '@lyness/lyn-api-sign-in-channel-controller'",
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
    ['@lyness/lyn-credentials-local', CredentialsLocal],
    ['@lyness/lyn-people/static', StaticPeopleDirectory],
    ['@lyness/lyn-auth-session/store', StoredAuthSessions],
    ['@lyness/lyn-sign-in/admission-roster', AdmissionRoster],
    ['@lyness/lyn-sign-in', SignIn],
    ['@lyness/lyn-sign-in/kinds', ChannelKindRegistry],
    ['@lyness/lyn-wecom/kind', Wecom],
    ['@lyness/lyn-admin-audit', AdminAudit],
    ['@lyness/lyn-sign-in-channels', ConfiguredChannels],
    ['@lyness/lyn-request-principal', RequestPrincipal],
    ['@lyness/lyn-api-sign-in-channel-controller', SignInChannelController],
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
  let answered: T | undefined
  for (const scope of composed.scopes) {
    await scope(request, async () => { answered = await call() })
  }
  if (answered === undefined) throw new Error('no request scope ran the call')
  return answered
}

it('offers the kinds the composed rows contribute', async () => {
  const { ctx } = await compose()
  expect(ctx.signInChannelController.kinds()).toEqual([
    {
      id: 'wecom',
      displayName: '企业微信',
      fields: [
        { name: 'corpId', label: 'corpid', required: true },
        { name: 'agentId', label: 'agentid', required: true },
        { name: 'loginHost', label: 'login host', required: false },
        { name: 'apiOrigin', label: 'API origin', required: false },
      ],
    },
  ])
})

it('turns one administrator change into a channel the sign-in page offers', async () => {
  const composed = await compose()
  const { ctx } = composed
  expect(ctx.signIn.available()).toEqual([])

  const saved = await asAda(composed, () => ctx.signInChannelController.save({
    kind: 'wecom',
    displayName: 'Head office',
    settings: { corpId: 'ww-acme', agentId: '1000002' },
    secret: 'the-application-secret',
  }))

  expect(saved).toMatchObject({ kind: 'wecom', displayName: 'Head office', mounted: true })
  expect(ctx.signIn.available()).toEqual([{ id: saved.id, displayName: 'Head office', kind: 'redirect' }])
  // The secret is in the credential document, under a reference derived from
  // the channel's own id; the record a surface reads carries neither.
  const document = await readFile(join(root ?? '', 'credentials.yaml'), 'utf8')
  expect(document).toContain('the-application-secret')
  expect(JSON.stringify(saved)).not.toContain('the-application-secret')
})
