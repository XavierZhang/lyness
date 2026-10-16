/** What the credits namespace refuses, and why each refusal is its own code. */

import { expect, it } from 'vitest'
import { Context } from '@lyness/cordis'
import { remoteErrorOf } from '@lyness/lyn-typert-protocol'
import { brandString } from '@lyness/lyn-brand'
import type { Membership, MembershipId, PersonId } from '@lyness/lyn-people'
import type { Principal } from '@lyness/lyn-request-principal'
import CreditsController from '../src/index.ts'

const ADA = brandString<PersonId>('ada')
const STANDING = brandString<MembershipId>('ada:tenant-administrator')

const ADMINISTRATOR: Membership = { id: STANDING, person: ADA, role: 'tenant-administrator', organization: 'acme' }

/** What one harness mounts beside the controller. */
interface Mounted {
  /** The principal every call reads; absent is an anonymous call. */
  readonly principal?: Principal
  /** Standings the directory knows; absent mounts no directory. */
  readonly standings?: readonly Membership[]
  /** Mount a ledger whose every read answers zero. */
  readonly ledger?: boolean
  /** Mount an administration seam that refuses with this value. */
  readonly refusal?: unknown
}

/** Act as Ada in her administrator standing. */
const asAda: Principal = { person: ADA, acting: { person: ADA, membership: STANDING } }

/**
 * Mount the controller over exactly the services one test needs.
 * @param mounted - which services exist, and what they answer.
 * @returns the controller.
 */
async function harness(mounted: Mounted): Promise<CreditsController> {
  const ctx = new Context()
  ctx.provide('requestPrincipal', { current: () => mounted.principal })
  if (mounted.standings !== undefined) {
    ctx.provide('people', {
      membership: (id: MembershipId) => Promise.resolve(mounted.standings?.find(held => held.id === id)),
      memberships: () => Promise.resolve([]),
    })
  }
  if (mounted.ledger === true) {
    ctx.provide('credits', {
      balance: (person: PersonId) => Promise.resolve({ person, available: 0, granted: 0, spent: 0 }),
      history: () => Promise.resolve({ grants: [], debits: [] }),
    })
  }
  if (mounted.refusal !== undefined) {
    const refuse = async (): Promise<never> => { throw mounted.refusal }
    ctx.provide('creditAdministration', {
      grant: refuse,
      setAllowance: refuse,
      mayAdminister: () => Promise.resolve(true),
      overridesFor: () => Promise.resolve({}),
    })
  }
  await ctx.plugin(CreditsController)
  return ctx.creditsController
}

/** The code one rejected call reported. */
async function refusedCode(call: Promise<unknown>): Promise<string | undefined> {
  return remoteErrorOf(await call.catch((error: unknown) => error))?.code
}

it('answers a deployment that meters nothing rather than an empty balance', async () => {
  const controller = await harness({ principal: asAda, standings: [ADMINISTRATOR] })
  expect(await refusedCode(controller.mine())).toBe('credits/unavailable')
})

it('answers a deployment with a ledger but no administration seam', async () => {
  const controller = await harness({ principal: asAda, standings: [ADMINISTRATOR], ledger: true })
  expect(await refusedCode(controller.grant({ person: 'bea', amount: 5 }))).toBe('credits/unavailable')
  expect(await refusedCode(controller.setAllowance({ person: 'bea', periodicAmount: 5 }))).toBe('credits/unavailable')
  expect(await refusedCode(controller.allowance('bea'))).toBe('credits/unavailable')
})

it('refuses a call acting in a personal context, which administers nobody', async () => {
  const controller = await harness({ principal: { person: ADA, acting: { person: ADA } }, standings: [], ledger: true })
  expect(await refusedCode(controller.grant({ person: 'bea', amount: 5 }))).toBe('credits/not-permitted')
})

it('refuses a call whose standing the directory does not know', async () => {
  const controller = await harness({ principal: asAda, standings: [], ledger: true })
  expect(await refusedCode(controller.grant({ person: 'bea', amount: 5 }))).toBe('credits/not-permitted')
})

it('refuses an anonymous grant before it reaches any authority check', async () => {
  const controller = await harness({ ledger: true })
  expect(await refusedCode(controller.grant({ person: 'bea', amount: 5 }))).toBe('credits/anonymous')
  expect(await refusedCode(controller.account('bea'))).toBe('credits/anonymous')
  expect(await refusedCode(controller.allowance('bea'))).toBe('credits/anonymous')
})

it('reports every invalid field of one request together', async () => {
  const controller = await harness({ principal: asAda, standings: [ADMINISTRATOR], ledger: true })
  const refused = await controller.grant({ person: '', amount: -1 }).catch((error: unknown) => error)
  const error = remoteErrorOf(refused)
  expect(error?.code).toBe('gateway/bad-request')
  expect(error?.message).toContain('person')
  expect(error?.message).toContain('amount')
})

it('passes the administration seam’s own refusal through as a rejection', async () => {
  const controller = await harness({
    principal: asAda, standings: [ADMINISTRATOR], ledger: true,
    refusal: new Error('credits: an allowance override must name an organization or a person'),
  })
  const refused = await controller.setAllowance({ periodicAmount: 5 }).catch((error: unknown) => error)
  expect(remoteErrorOf(refused)?.code).toBe('credits/rejected')
})

it('renders a refusal that is not an error at all', async () => {
  const controller = await harness({
    principal: asAda, standings: [ADMINISTRATOR], ledger: true, refusal: 'the ledger is locked',
  })
  const refused = await controller.grant({ person: 'bea', amount: 5 }).catch((error: unknown) => error)
  expect(remoteErrorOf(refused)?.message).toBe('the ledger is locked')
})

it('maps the seam’s authority refusal to the permission code, not a rejection', async () => {
  const controller = await harness({
    principal: asAda, standings: [ADMINISTRATOR], ledger: true,
    refusal: new Error('credits: this standing may not administer that person'),
  })
  expect(await refusedCode(controller.grant({ person: 'bea', amount: 5 }))).toBe('credits/not-permitted')
})

it('shows a person their own account without an authority check', async () => {
  const controller = await harness({ principal: asAda, standings: [ADMINISTRATOR], ledger: true })
  expect((await controller.account('ada')).person).toBe('ada')
})
