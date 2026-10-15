/**
 * Administrator credit decisions: who may make them, who may not, and what a
 * changed allowance does to the next periodic grant.
 */

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@lyness/cordis'
import Storage from '@lyness/lyn-storage'
import * as StorageDomain from '@lyness/lyn-storage-domain'
import * as StorageJson from '@lyness/lyn-storage-json'
import { brandString } from '@lyness/lyn-brand'
import type { Membership, MembershipId, PersonId } from '@lyness/lyn-people'
import StaticPeople from '@lyness/lyn-people/static'
import { afterEach, describe, expect, it } from 'vitest'
import StoredCreditLedger from '../src/store.ts'
import type { Config as LedgerConfig } from '../src/store.ts'
import CreditAdministration, { NOT_PERMITTED, NOT_POSITIVE } from '../src/administration.ts'

const ADA = brandString<PersonId>('ada')
const BOB = brandString<PersonId>('bob')

const PLATFORM: Membership = {
  id: brandString<MembershipId>('root:platform'),
  person: brandString<PersonId>('root'),
  role: 'platform-administrator',
}

const ACME_ADMIN: Membership = {
  id: brandString<MembershipId>('grace:acme'),
  person: brandString<PersonId>('grace'),
  organization: 'acme',
  role: 'tenant-administrator',
}

const OTHER_ADMIN: Membership = {
  id: brandString<MembershipId>('hopper:other'),
  person: brandString<PersonId>('hopper'),
  organization: 'other',
  role: 'tenant-administrator',
}

const ADA_MEMBER: Membership = {
  id: brandString<MembershipId>('ada:acme'),
  person: ADA,
  organization: 'acme',
  role: 'member',
}

const roots: string[] = []
const live: Context[] = []
afterEach(async () => {
  for (const ctx of live.splice(0)) await ctx.fiber.dispose()
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

/** The ledger, a written roster, and the administration service over one store. */
async function harness(ledger: LedgerConfig = {}): Promise<Context> {
  const root = mkdtempSync(join(tmpdir(), 'lyn-credit-admin-'))
  roots.push(root)
  const ctx = new Context()
  await ctx.plugin(Storage)
  await ctx.plugin(StorageJson, { root })
  await ctx.plugin(StorageDomain, { backend: 'json' })
  await ctx.plugin(StaticPeople, {
    people: [
      { id: 'ada', displayName: 'Ada', role: 'member', organization: 'acme' },
      { id: 'bob', displayName: 'Bob', role: 'member', organization: 'other' },
      { id: 'grace', displayName: 'Grace', role: 'tenant-administrator', organization: 'acme' },
      { id: 'root', displayName: 'Root', role: 'platform-administrator' },
    ],
  }).await()
  await ctx.plugin(StoredCreditLedger, ledger).await()
  await ctx.plugin(CreditAdministration).await()
  live.push(ctx)
  return ctx
}

describe('granting credits', () => {
  it('lets a platform administrator grant to anyone', async () => {
    const ctx = await harness({ periodicAmount: 0 })
    await ctx.creditAdministration.grant({ person: ADA, amount: 100 }, PLATFORM)
    expect((await ctx.credits.balance(ADA)).available).toBe(100)
  })

  it('lets a tenant administrator grant within their own organization', async () => {
    const ctx = await harness({ periodicAmount: 0 })
    await ctx.creditAdministration.grant({ person: ADA, amount: 100 }, ACME_ADMIN)
    expect((await ctx.credits.balance(ADA)).available).toBe(100)
  })

  it('refuses a tenant administrator reaching into another organization', async () => {
    const ctx = await harness({ periodicAmount: 0 })
    await expect(ctx.creditAdministration.grant({ person: BOB, amount: 100 }, ACME_ADMIN))
      .rejects.toThrow(NOT_PERMITTED)
  })

  it('refuses a member granting to themselves', async () => {
    const ctx = await harness({ periodicAmount: 0 })
    await expect(ctx.creditAdministration.grant({ person: ADA, amount: 100 }, ADA_MEMBER))
      .rejects.toThrow(NOT_PERMITTED)
  })

  it('refuses an administrator of an organization that person does not belong to', async () => {
    const ctx = await harness({ periodicAmount: 0 })
    await expect(ctx.creditAdministration.grant({ person: ADA, amount: 100 }, OTHER_ADMIN))
      .rejects.toThrow(NOT_PERMITTED)
  })

  it('refuses a grant that is not a positive whole number', async () => {
    const ctx = await harness({ periodicAmount: 0 })
    await expect(ctx.creditAdministration.grant({ person: ADA, amount: 0 }, PLATFORM))
      .rejects.toThrow(NOT_POSITIVE)
    await expect(ctx.creditAdministration.grant({ person: ADA, amount: 1.5 }, PLATFORM))
      .rejects.toThrow(NOT_POSITIVE)
  })

  it('records who granted them, and lets them lapse when told to', async () => {
    const ctx = await harness({ periodicAmount: 0 })
    const expiresAt = new Date(Date.now() + 60_000).toISOString()
    await ctx.creditAdministration.grant({ person: ADA, amount: 100, expiresAt }, ACME_ADMIN)
    const { grants } = await ctx.credits.history(ADA)
    expect(grants[0]).toMatchObject({
      reason: 'administrator',
      grantedBy: ACME_ADMIN.person,
      expiresAt,
    })
  })

  it('leaves a lapsed administrator grant out of the balance', async () => {
    const ctx = await harness({ periodicAmount: 0 })
    const expiresAt = new Date(Date.now() - 1000).toISOString()
    await ctx.creditAdministration.grant({ person: ADA, amount: 100, expiresAt }, PLATFORM)
    expect((await ctx.credits.balance(ADA)).available).toBe(0)
  })
})

describe('changing an allowance', () => {
  it('raises what one person receives each period', async () => {
    const ctx = await harness()
    await ctx.creditAdministration.setAllowance({ person: ADA, periodicAmount: 2000 }, ACME_ADMIN)
    expect((await ctx.credits.balance(ADA)).available).toBe(2000)
  })

  it('raises what everyone in an organization receives', async () => {
    const ctx = await harness()
    await ctx.creditAdministration.setAllowance({ organization: 'acme', periodicAmount: 1500 }, ACME_ADMIN)
    expect((await ctx.credits.balance(ADA)).available).toBe(1500)
  })

  it('lets a person override beat their own organization', async () => {
    const ctx = await harness()
    await ctx.creditAdministration.setAllowance({ organization: 'acme', periodicAmount: 1500 }, ACME_ADMIN)
    await ctx.creditAdministration.setAllowance({ person: ADA, periodicAmount: 10 }, ACME_ADMIN)
    expect((await ctx.credits.balance(ADA)).available).toBe(10)
  })

  it('caps a person at nothing when an administrator sets zero', async () => {
    const ctx = await harness()
    await ctx.creditAdministration.setAllowance({ person: ADA, periodicAmount: 0 }, ACME_ADMIN)
    const balance = await ctx.credits.balance(ADA)
    expect(balance.available).toBe(0)
    // Nothing is due later either: a capped person has no next grant to wait for.
    expect(balance.nextGrantAt).toBeUndefined()
  })

  it('changes the reset cycle a person is granted on', async () => {
    const ctx = await harness()
    await ctx.creditAdministration.setAllowance({ person: ADA, period: 'monthly' }, PLATFORM)
    const balance = await ctx.credits.balance(ADA)
    expect(balance.available).toBe(500)
    // A monthly cycle pushes the next grant past a day away.
    expect(Date.parse(balance.nextGrantAt ?? '') - Date.now()).toBeGreaterThan(86_400_000)
  })

  it('leaves another organization untouched', async () => {
    const ctx = await harness()
    await ctx.creditAdministration.setAllowance({ organization: 'acme', periodicAmount: 1500 }, ACME_ADMIN)
    expect((await ctx.credits.balance(BOB)).available).toBe(500)
  })

  it('refuses a tenant administrator changing another organization', async () => {
    const ctx = await harness()
    await expect(ctx.creditAdministration
      .setAllowance({ organization: 'other', periodicAmount: 1500 }, ACME_ADMIN))
      .rejects.toThrow(NOT_PERMITTED)
  })

  it('refuses a member changing their own allowance', async () => {
    const ctx = await harness()
    await expect(ctx.creditAdministration.setAllowance({ person: ADA, periodicAmount: 9999 }, ADA_MEMBER))
      .rejects.toThrow(NOT_PERMITTED)
  })

  it('refuses a change that names neither an organization nor a person', async () => {
    const ctx = await harness()
    await expect(ctx.creditAdministration.setAllowance({ periodicAmount: 1 }, PLATFORM))
      .rejects.toThrow(/must name an organization or a person/u)
  })

  it('replaces an earlier override rather than accumulating', async () => {
    const ctx = await harness()
    await ctx.creditAdministration.setAllowance({ person: ADA, periodicAmount: 2000 }, PLATFORM)
    await ctx.creditAdministration.setAllowance({ person: ADA, periodicAmount: 300 }, PLATFORM)
    expect(await ctx.creditAdministration.overridesFor(ADA))
      .toMatchObject({ person: { periodicAmount: 300 } })
  })

  it('finds no organization override for a standing that belongs to no organization', async () => {
    const ctx = await harness()
    // A platform administrator is also a person with credits, and their
    // standing names no organization for an override to be scoped to.
    await ctx.creditAdministration.setAllowance({ organization: 'acme', periodicAmount: 1500 }, PLATFORM)
    expect(await ctx.creditAdministration.overridesFor(PLATFORM.person)).toEqual({})
    expect((await ctx.credits.balance(PLATFORM.person)).available).toBe(500)
  })

  it('reports no override for a person nobody decided anything about', async () => {
    const ctx = await harness()
    expect(await ctx.creditAdministration.overridesFor(BOB)).toEqual({})
  })
})
