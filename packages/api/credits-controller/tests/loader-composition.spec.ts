/**
 * REAL-composition coverage: a test-only cordis.yml booted through the
 * vendored Loader mounts the stored ledger, the administration seam, a
 * written roster, and this controller, and the assertions are what each
 * standing may read and change about whose credits.
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, expect, it } from 'vitest'
import { Context } from '@lyness/cordis'
import Loader from '@lyness/cordis-plugin-loader'
import Include from '@lyness/cordis-plugin-include'
import AdminAudit from '@lyness/lyn-admin-audit'
import StoredCreditLedger from '@lyness/lyn-credits/store'
import CreditAdministration from '@lyness/lyn-credits/administration'
import { StaticPeopleDirectory } from '@lyness/lyn-people/static'
import Storage from '@lyness/lyn-storage'
import * as StorageJson from '@lyness/lyn-storage-json'
import * as StorageDomain from '@lyness/lyn-storage-domain'
import { remoteErrorOf } from '@lyness/lyn-typert-protocol'
import { brandString } from '@lyness/lyn-brand'
import type { MembershipId, PersonId } from '@lyness/lyn-people'
import type { Principal } from '@lyness/lyn-request-principal'
import CreditsController from '../src/index.ts'

const ADA = brandString<PersonId>('ada')
const BEA = brandString<PersonId>('bea')
const DEE = brandString<PersonId>('dee')

let root: string | undefined
let context: Context | undefined
let acting: Principal | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  context = undefined
  root = undefined
  acting = undefined
})

/** Boot the rows through the real Loader, with the principal the test chooses. */
async function compose(): Promise<CreditsController> {
  root = await mkdtemp(join(tmpdir(), 'lyn-credits-controller-'))
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
    '        role: tenant-administrator',
    '        organization: acme',
    '      - id: bea',
    '        displayName: Bea',
    '        role: member',
    '        organization: acme',
    '      - id: cai',
    '        displayName: Cai',
    '        role: member',
    '        organization: zenith',
    '      - id: dee',
    '        displayName: Dee',
    '        role: platform-administrator',
    "- name: '@lyness/lyn-admin-audit'",
    "- name: '@lyness/lyn-credits/store'",
    '  config:',
    '    periodicAmount: 100',
    '    period: daily',
    "- name: '@lyness/lyn-credits/administration'",
    "- name: '@lyness/lyn-api-credits-controller'",
    '',
  ].join('\n'))

  const ctx = new Context()
  context = ctx
  ctx.provide('requestPrincipal', { current: () => acting })
  ctx.baseUrl = `${pathToFileURL(root).href}/`
  await ctx.plugin(Loader)
  ctx.loader.builtins.include = Include
  const modules = new Map<string, unknown>([
    ['@lyness/lyn-storage', Storage],
    ['@lyness/lyn-storage-json', StorageJson],
    ['@lyness/lyn-storage-domain', StorageDomain],
    ['@lyness/lyn-people/static', StaticPeopleDirectory],
    ['@lyness/lyn-admin-audit', AdminAudit],
    ['@lyness/lyn-credits/store', StoredCreditLedger],
    ['@lyness/lyn-credits/administration', CreditAdministration],
    ['@lyness/lyn-api-credits-controller', CreditsController],
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
  return ctx.creditsController
}

/** Act as one person in one of their standings. */
function as(person: PersonId, membership?: string): void {
  acting = {
    person,
    acting: { person, ...membership === undefined ? {} : { membership: brandString<MembershipId>(membership) } },
  }
}

it('shows a member their own balance and offers them no administration', async () => {
  const controller = await compose()
  as(BEA, 'bea:member')
  const account = await controller.mine()
  expect(account.person).toBe('bea')
  expect(account.administrable).toBe(false)
  expect(account.available).toBeGreaterThan(0)
})

it('lets an administrator grant into their own organization and read the result', async () => {
  const controller = await compose()
  as(ADA, 'ada:tenant-administrator')
  const granted = await controller.grant({ person: 'bea', amount: 250 })
  expect(granted.person).toBe('bea')
  expect(granted.grants.some(grant => grant.reason === 'administrator' && grant.amount === 250)).toBe(true)
  expect(granted.administrable).toBe(true)

  const read = await controller.account('bea')
  expect(read.available).toBe(granted.available)
})

it('refuses an administrator reaching into another organization', async () => {
  const controller = await compose()
  as(ADA, 'ada:tenant-administrator')
  const refused = await controller.grant({ person: 'cai', amount: 10 }).catch((error: unknown) => error)
  expect(remoteErrorOf(refused)?.code).toBe('credits/not-permitted')

  const unread = await controller.account('cai').catch((error: unknown) => error)
  expect(remoteErrorOf(unread)?.code).toBe('credits/not-permitted')
})

it('refuses a member granting to anybody, including themselves', async () => {
  const controller = await compose()
  as(BEA, 'bea:member')
  const refused = await controller.grant({ person: 'bea', amount: 10 }).catch((error: unknown) => error)
  expect(remoteErrorOf(refused)?.code).toBe('credits/not-permitted')
})

it('records an allowance override and reads it back with the periods a form may offer', async () => {
  const controller = await compose()
  as(ADA, 'ada:tenant-administrator')
  const saved = await controller.setAllowance({ person: 'bea', periodicAmount: 500, period: 'weekly' })
  expect(saved.own).toMatchObject({ periodicAmount: 500, period: 'weekly', setBy: 'ada' })
  expect(saved.periods).toEqual(['daily', 'weekly', 'monthly'])

  const read = await controller.allowance('bea')
  expect(read.own?.periodicAmount).toBe(500)
})

it('sets an organization-wide allowance and reports it on a person it reaches', async () => {
  const controller = await compose()
  as(ADA, 'ada:tenant-administrator')
  await controller.setAllowance({ organization: 'acme', periodicAmount: 42 })
  const read = await controller.allowance('bea')
  expect(read.organization?.periodicAmount).toBe(42)
})

it('shows a dated grant and the spending that drew it down', async () => {
  const controller = await compose()
  as(ADA, 'ada:tenant-administrator')
  const lapses = new Date(Date.now() + 86_400_000).toISOString()
  await controller.grant({ person: 'bea', amount: 300, expiresAt: lapses })

  const ctx = context
  if (ctx === undefined) throw new Error('the composition did not boot')
  await ctx.credits.spend({ person: BEA, amount: 120, session: 's-1' })

  as(BEA, 'bea:member')
  const account = await controller.mine()
  expect(account.grants.some(grant => grant.expiresAt === lapses)).toBe(true)
  expect(account.debits).toMatchObject([{ amount: 120, session: 's-1' }])
  expect(account.spent).toBe(120)
})

it('records an override that changes only how often the allowance arrives', async () => {
  const controller = await compose()
  as(ADA, 'ada:tenant-administrator')
  const saved = await controller.setAllowance({ person: 'bea', period: 'monthly' })
  expect(saved.own?.period).toBe('monthly')
  expect(saved.own?.periodicAmount).toBeUndefined()
})

it('offers no administration to a call acting in a personal context', async () => {
  const controller = await compose()
  as(ADA)
  expect((await controller.mine()).administrable).toBe(false)
})

it('refuses every call that presented no identity', async () => {
  const controller = await compose()
  const refused = await controller.mine().catch((error: unknown) => error)
  expect(remoteErrorOf(refused)?.code).toBe('credits/anonymous')
})

it('lets a platform standing set what an organization bought and read what is left', async () => {
  const controller = await compose()
  as(DEE, 'dee:platform-administrator')

  const set = await controller.setBudget({ organization: 'acme', periodicAmount: 5000, period: 'monthly' })

  expect(set).toMatchObject({
    organization: 'acme',
    periodicAmount: 5000,
    period: 'monthly',
    spent: 0,
    remaining: 5000,
    settable: true,
  })
  expect(set.periods).toEqual(['daily', 'weekly', 'monthly'])
})

it('shows an organization its own ceiling without offering the control', async () => {
  const controller = await compose()
  as(DEE, 'dee:platform-administrator')
  await controller.setBudget({ organization: 'acme', periodicAmount: 5000, period: 'monthly' })

  as(ADA, 'ada:tenant-administrator')
  const read = await controller.budget('acme')

  // Its own money and its own usage, and a control the next call would
  // refuse is not offered.
  expect(read).toMatchObject({ periodicAmount: 5000, remaining: 5000, settable: false })
})

it('refuses an organization raising its own ceiling', async () => {
  const controller = await compose()
  as(ADA, 'ada:tenant-administrator')

  // A ceiling an organization can raise is not a ceiling.
  const refused = await controller
    .setBudget({ organization: 'acme', periodicAmount: 1_000_000, period: 'monthly' })
    .catch((error: unknown) => error)
  expect(remoteErrorOf(refused)?.code).toBe('credits/rejected')
  expect((await controller.budget('acme')).periodicAmount).toBeUndefined()
})

it('refuses reading another organization\'s ceiling', async () => {
  const controller = await compose()
  as(ADA, 'ada:tenant-administrator')

  const refused = await controller.budget('zenith').catch((error: unknown) => error)
  expect(remoteErrorOf(refused)?.code).toBe('credits/not-permitted')
})

it('answers an organization nobody set a ceiling for as having none', async () => {
  const controller = await compose()
  as(DEE, 'dee:platform-administrator')

  const read = await controller.budget('acme')

  // No ceiling rather than a ceiling of zero: a surface that read zero would
  // say its customer may spend nothing.
  expect(read).toEqual({ organization: 'acme', periods: ['daily', 'weekly', 'monthly'], settable: true })
})

it('answers an administrator their own organization\'s ceiling without naming it', async () => {
  const controller = await compose()
  as(DEE, 'dee:platform-administrator')
  await controller.setBudget({ organization: 'acme', periodicAmount: 5000, period: 'monthly' })

  as(ADA, 'ada:tenant-administrator')
  // The one organization somebody holds standing in is not a parameter.
  expect(await controller.myBudget()).toMatchObject({
    organization: 'acme',
    periodicAmount: 5000,
    remaining: 5000,
    settable: false,
  })
})

it('refuses a member the numbers behind their organization\'s ceiling', async () => {
  const controller = await compose()
  as(DEE, 'dee:platform-administrator')
  await controller.setBudget({ organization: 'acme', periodicAmount: 5000, period: 'monthly' })

  as(BEA, 'bea:member')
  // What an organization bought and has spent is its administrators' to see.
  // A member learns from the refusal that the organization is out, and that
  // is the only part of it their own turn depends on.
  const refused = await controller.myBudget().catch((error: unknown) => error)
  expect(remoteErrorOf(refused)?.code).toBe('credits/not-permitted')
})

it('answers nothing to a standing that holds no organization', async () => {
  const controller = await compose()
  as(DEE, 'dee:platform-administrator')

  // A platform standing is in no organization, so it has no own ceiling to
  // read; it names the organization it wants instead.
  expect(await controller.myBudget()).toBeUndefined()
})
