/**
 * REAL-composition coverage: a deployment booted through the vendored Loader
 * with the roster, the invitations and the admission rule that joins them, so
 * what is asserted is a sign-in this composition could actually serve —
 * somebody nobody has heard of presents a code and comes out with a session.
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
import type { Membership, MembershipId, PersonId } from '@lyness/lyn-people'
import SignIn, { channelId } from '@lyness/lyn-sign-in'
import type { ExternalSubject, SelfDrivenChannel } from '@lyness/lyn-sign-in'
import * as StoredAuthSessions from '@lyness/lyn-auth-session/store'
import Storage from '@lyness/lyn-storage'
import * as StorageJson from '@lyness/lyn-storage-json'
import * as StorageDomain from '@lyness/lyn-storage-domain'
import AdminAudit from '@lyness/lyn-admin-audit'
import ManagedPeople from '@lyness/lyn-managed-people'
import * as ManagedPeopleDirectory from '@lyness/lyn-managed-people/directory'
import * as Invitations from '../src/index.ts'
import * as InvitingAdmission from '../src/admission.ts'

const CHANNEL = channelId('probe')
const ISSUER = 'https://id.example'
const ADA = brandString<PersonId>('ada')

/** The platform administrator the composition writes, as the directory reports them. */
const PLATFORM: Membership = {
  id: brandString<MembershipId>('ada:platform-administrator'),
  person: ADA,
  role: 'platform-administrator',
}

let root: string | undefined
let context: Context | undefined
/** The subject the probe channel reports on the next sign-in. */
let authenticated: ExternalSubject | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  context = undefined
  root = undefined
  authenticated = undefined
})

/**
 * A self-driven channel standing in for a directory.
 *
 * Self-driven because the browser round trip is `lyn-sign-in-http`'s half and
 * has its own coverage; what this composition must show is that the code
 * reaches the admission rule and that the rule writes the roster.
 */
const probeChannel = {
  name: 'probe-channel',
  inject: ['signIn'],
  apply(ctx: Context): void {
    const channel: SelfDrivenChannel = {
      id: CHANNEL,
      displayName: 'Probe directory',
      kind: 'self-driven',
      authenticate: () => Promise.resolve(authenticated),
    }
    ctx.effect(() => ctx.signIn.register(channel))
  },
}

/**
 * Boot the rows through the real Loader.
 * @param bindings - the directory identities composition writes, in YAML lines.
 */
async function compose(bindings: readonly string[] = []): Promise<Context> {
  root = await mkdtemp(join(tmpdir(), 'lyn-invitations-composition-'))
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
    "- name: '@lyness/lyn-auth-session/store'",
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
    ...bindings.length === 0 ? ['    bindings: []'] : ['    bindings:', ...bindings],
    "- name: '@lyness/lyn-sign-in'",
    "- name: 'probe-channel'",
    '',
  ].join('\n'))

  const ctx = new Context()
  context = ctx
  ctx.baseUrl = `${pathToFileURL(root).href}/`
  await ctx.plugin(Loader)
  ctx.loader.builtins.include = Include
  const modules = new Map<string, unknown>([
    ['@lyness/lyn-storage', Storage],
    ['@lyness/lyn-storage-json', StorageJson],
    ['@lyness/lyn-storage-domain', StorageDomain],
    ['@lyness/lyn-admin-audit', AdminAudit],
    ['@lyness/lyn-auth-session/store', StoredAuthSessions],
    ['@lyness/lyn-managed-people', ManagedPeople],
    ['@lyness/lyn-managed-people/directory', ManagedPeopleDirectory],
    ['@lyness/lyn-invitations', Invitations],
    ['@lyness/lyn-invitations/admission', InvitingAdmission],
    ['@lyness/lyn-sign-in', SignIn],
    ['probe-channel', probeChannel],
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
  return ctx
}

/** One subject the probe directory verifies. */
function subject(id: string, displayName?: string): ExternalSubject {
  return {
    channel: CHANNEL,
    issuer: ISSUER,
    subject: id,
    ...displayName === undefined ? {} : { displayName },
  }
}

it('signs an invited stranger in, and refuses the same stranger without the code', async () => {
  const ctx = await compose()
  const issued = await ctx.invitations.issue(
    { label: 'Bea', role: 'member', organization: 'acme' }, PLATFORM)
  authenticated = subject('bea', 'Bea Smith')

  // Without the code this deployment admits them as nobody: the roster has
  // never heard of them.
  await expect(ctx.signIn.begin(CHANNEL, 'https://lyn.example/callback'))
    .rejects.toMatchObject({ code: 'not-admitted' })

  const outcome = await ctx.signIn.begin(CHANNEL, 'https://lyn.example/callback', { invitation: issued.code })
  if (outcome.kind !== 'session') throw new Error('a self-driven channel returned something else')
  const established = await ctx.authSessions.read(outcome.session)

  // They are now a person of this deployment, with the standing the code carried.
  expect(await ctx.people.person(established.person)).toMatchObject({ displayName: 'Bea Smith' })
  expect(await ctx.people.memberships(established.person))
    .toMatchObject([{ role: 'member', organization: 'acme' }])
})

it('signs them in afterwards without the code, because the redemption bound them', async () => {
  const ctx = await compose()
  const issued = await ctx.invitations.issue({ label: 'Bea', role: 'member', organization: 'acme' }, PLATFORM)
  authenticated = subject('bea', 'Bea Smith')
  const first = await ctx.signIn.begin(CHANNEL, 'https://lyn.example/callback', { invitation: issued.code })
  if (first.kind !== 'session') throw new Error('a self-driven channel returned something else')
  const person = (await ctx.authSessions.read(first.session)).person

  // The second sign-in presents no code at all.
  const second = await ctx.signIn.begin(CHANNEL, 'https://lyn.example/callback')
  if (second.kind !== 'session') throw new Error('a self-driven channel returned something else')

  expect((await ctx.authSessions.read(second.session)).person).toBe(person)
  // And it was one redemption, not two: the roster answered the second time.
  expect(await ctx.invitations.list(PLATFORM)).toMatchObject([{ uses: 1 }])
})

it('answers the roster first, so a code adds no second entry for somebody already here', async () => {
  const ctx = await compose()
  // Ada is written into the composition and bound at runtime; a code she also
  // holds must not make a second Ada.
  const bea = await ctx.invitations.issue({ label: 'Bea', role: 'member', organization: 'acme' }, PLATFORM)
  await ctx.managedPeople.bind(
    { channel: CHANNEL, issuer: ISSUER, subject: 'ada', person: ADA }, PLATFORM)
  authenticated = subject('ada', 'Ada')

  const outcome = await ctx.signIn.begin(CHANNEL, 'https://lyn.example/callback', { invitation: bea.code })
  if (outcome.kind !== 'session') throw new Error('a self-driven channel returned something else')

  expect((await ctx.authSessions.read(outcome.session)).person).toBe(ADA)
  expect(await ctx.invitations.list(PLATFORM)).toMatchObject([{ uses: 0, open: true }])
})

it('lets the person the roster answered for accept that same code themselves', async () => {
  const ctx = await compose()
  // Bea joins with one code, which is the only way the roster hears of her;
  // the second code then reaches her through accepting it, not through
  // signing in again.
  const first = await ctx.invitations.issue({ label: 'Bea', role: 'member', organization: 'acme' }, PLATFORM)
  authenticated = subject('bea', 'Bea')
  const joined = await ctx.signIn.begin(CHANNEL, 'https://lyn.example/callback', { invitation: first.code })
  if (joined.kind !== 'session') throw new Error('a self-driven channel returned something else')
  const bea = (await ctx.authSessions.read(joined.session)).person

  const second = await ctx.invitations.issue({ label: 'Bea again', role: 'tenant-administrator', organization: 'beta' }, PLATFORM)
  // Signing in with it in hand still changes nothing: that is what keeps a
  // forwarded link from adding authority to an account.
  await ctx.signIn.begin(CHANNEL, 'https://lyn.example/callback', { invitation: second.code })
  expect(await ctx.people.memberships(bea)).toHaveLength(1)

  expect(await ctx.invitations.accept(second.code ?? '', bea))
    .toMatchObject({ role: 'tenant-administrator', organization: 'beta' })
  expect(await ctx.people.memberships(bea)).toMatchObject([
    { role: 'member', organization: 'acme' },
    { role: 'tenant-administrator', organization: 'beta' },
  ])
})

it('refuses a code this deployment never issued, with the same answer as no code', async () => {
  const ctx = await compose()
  authenticated = subject('nobody')

  await expect(ctx.signIn.begin(CHANNEL, 'https://lyn.example/callback', { invitation: 'not-a-code' }))
    .rejects.toMatchObject({ code: 'not-admitted' })
  expect(await ctx.invitations.list(PLATFORM)).toEqual([])
})

it('keeps the written bindings this rule still owns', async () => {
  // The rule reads the same `bindings` configuration the managed one does, so
  // an installation that writes its operator's identity keeps signing them in
  // with no code and no stored binding.
  const ctx = await compose([
    '      - channel: probe',
    `        issuer: ${ISSUER}`,
    '        subject: ada',
    '        person: ada',
  ])
  authenticated = subject('ada', 'Ada')

  const outcome = await ctx.signIn.begin(CHANNEL, 'https://lyn.example/callback')
  if (outcome.kind !== 'session') throw new Error('a self-driven channel returned something else')
  expect((await ctx.authSessions.read(outcome.session)).person).toBe(ADA)
})

it('admits nobody by configuration when it writes no binding', async () => {
  const ctx = await compose()
  expect(ctx.signInAdmission).toBeDefined()
  authenticated = subject('ada', 'Ada')
  await expect(ctx.signIn.begin(CHANNEL, 'https://lyn.example/callback'))
    .rejects.toMatchObject({ code: 'not-admitted' })
})
