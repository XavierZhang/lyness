/**
 * What the invitations surface answers an administrator, and what it refuses:
 * a standing the caller does not hold, another organization, a tenant
 * administrator with no organization, bounds the deployment does not allow,
 * an invitation nobody issued, and a call on no standing.
 */

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@lyness/cordis'
import { brandString } from '@lyness/lyn-brand'
import AdminAudit from '@lyness/lyn-admin-audit'
import Invitations from '@lyness/lyn-invitations'
import ManagedPeople from '@lyness/lyn-managed-people'
import ManagedPeopleDirectory from '@lyness/lyn-managed-people/directory'
import type { Membership, MembershipId, PersonId, Role } from '@lyness/lyn-people'
import Storage from '@lyness/lyn-storage'
import * as StorageJson from '@lyness/lyn-storage-json'
import * as StorageDomain from '@lyness/lyn-storage-domain'
import { RemoteError } from '@lyness/lyn-typert-protocol'
import InvitationsController from '../src/index.ts'

const ADA = brandString<PersonId>('ada')

const live: Context[] = []
let root: string | undefined

afterEach(async () => {
  for (const ctx of live.splice(0)) await ctx.fiber.dispose()
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

/** One standing, as the directory reports it. */
function standing(role: Role, organization?: string): Membership {
  return {
    id: brandString<MembershipId>(`ada:${role}`),
    person: ADA,
    role,
    ...organization === undefined ? {} : { organization },
  }
}

/** The deployment, with one standing calling it. */
async function harness(
  by: Membership | 'none',
  options: { invitations?: boolean; fails?: string; bounds?: Record<string, number> } = {},
): Promise<InvitationsController> {
  root ??= await mkdtemp(join(tmpdir(), 'lyn-invitations-controller-'))
  const ctx = new Context()
  live.push(ctx)
  ctx.provide('requestPrincipal', {
    current: () => by === 'none' ? undefined : { person: by.person, acting: { person: by.person, membership: by.id } },
  })
  if (options.fails !== undefined) {
    const failure = options.fails
    ctx.provide('invitations', {
      list: () => Promise.reject(new Error(failure)),
      issue: () => Promise.reject(new Error(failure)),
    } as never)
    ctx.provide('people', {
      person: () => Promise.resolve(undefined),
      membership: (id: MembershipId) => Promise.resolve(by === 'none' || id !== by.id ? undefined : by),
      memberships: () => Promise.resolve([]),
    } as never)
    await ctx.plugin(InvitationsController)
    return ctx.invitationsController
  }
  if (options.invitations !== false) {
    await ctx.plugin(Storage)
    await ctx.plugin(StorageJson, { root: join(root, 'state') })
    await ctx.plugin(StorageDomain, { backend: 'json' })
    await ctx.plugin(AdminAudit, {}).await()
    await ctx.plugin(ManagedPeople).await()
    // The caller is the operator's own written person, which is also where
    // the standing a call acts in is read back from.
    await ctx.plugin(ManagedPeopleDirectory, {
      people: [{
        id: 'ada',
        displayName: 'Ada',
        role: by === 'none' ? 'platform-administrator' : by.role,
        ...by === 'none' || by.organization === undefined ? {} : { organization: by.organization },
      }],
    }).await()
    await ctx.plugin(Invitations, options.bounds ?? {}).await()
  }
  await ctx.plugin(InvitationsController)
  return ctx.invitationsController
}

/** The failure code one call answered with. */
async function codeOf(call: Promise<unknown>): Promise<string | undefined> {
  try {
    await call
    return undefined
  } catch (failed: unknown) {
    return failed instanceof RemoteError ? String(failed.code) : undefined
  }
}

describe('an administrator issuing invitations', () => {
  it('issues one with its code, lists it without the code, and withdraws it', async () => {
    const controller = await harness(standing('platform-administrator'))
    const issued = await controller.issue({ label: 'Bea', role: 'member', organization: 'acme' })
    expect(issued).toMatchObject({ label: 'Bea', role: 'member', organization: 'acme', uses: 0, open: true })
    expect(issued.code).toEqual(expect.any(String))

    // The code is in that answer and nowhere else: the store holds its hash.
    const listed = await controller.list()
    expect(listed).toEqual([expect.objectContaining({ id: issued.id, open: true })])
    expect(listed[0]?.code).toBeUndefined()

    await controller.revoke(issued.id)
    // Withdrawn, not deleted: who invited whom is why the row is kept.
    expect(await controller.list()).toEqual([expect.objectContaining({ id: issued.id, open: false })])
  })

  it('issues one for a platform administrator, which names no organization', async () => {
    const controller = await harness(standing('platform-administrator'))
    const issued = await controller.issue({ label: 'The other operator', role: 'platform-administrator' })
    // A platform standing is in no organization, so the view carries none.
    expect(issued.organization).toBeUndefined()
    expect(await controller.list()).toEqual([expect.objectContaining({ role: 'platform-administrator' })])
  })

  it('is refused a standing it does not hold, and a tenant administrator with no organization', async () => {
    const tenant = await harness(standing('tenant-administrator', 'acme'))
    expect(await codeOf(tenant.issue({ label: 'Mallory', role: 'platform-administrator' })))
      .toBe('invitations/not-permitted')
    expect(await codeOf(tenant.issue({ label: 'Bea', role: 'member', organization: 'other' })))
      .toBe('invitations/not-permitted')
    const platform = await harness(standing('platform-administrator'))
    expect(await codeOf(platform.issue({ label: 'Lead', role: 'tenant-administrator' })))
      .toBe('invitations/incomplete')
  })

  it('is refused more uses or a longer life than the deployment allows', async () => {
    const controller = await harness(standing('platform-administrator'), { bounds: { maxUsesLimit: 5, maxLifetimeMs: 60_000, defaultLifetimeMs: 60_000 } })
    expect(await codeOf(controller.issue({ label: 'Team', role: 'member', organization: 'acme', maxUses: 6 })))
      .toBe('invitations/out-of-bounds')
    expect(await codeOf(controller.issue({ label: 'Team', role: 'member', organization: 'acme', lifetimeMs: 120_000 })))
      .toBe('invitations/out-of-bounds')
    // The bounds are configuration, so what they allow is issued.
    expect(await controller.issue({ label: 'Team', role: 'member', organization: 'acme', maxUses: 5, lifetimeMs: 60_000 }))
      .toMatchObject({ maxUses: 5 })
  })

  it('is refused an invitation nobody issued, and another organization\'s', async () => {
    const platform = await harness(standing('platform-administrator'))
    const theirs = await platform.issue({ label: 'Bea', role: 'member', organization: 'acme' })
    expect(await codeOf(platform.revoke('no-such-invitation'))).toBe('invitations/unknown')

    const other = await harness(standing('tenant-administrator', 'other'))
    // Nothing of acme's is theirs to read or to withdraw.
    expect(await other.list()).toEqual([])
    expect(await codeOf(other.revoke(theirs.id))).toBe('invitations/not-permitted')
  })
})

describe('a call the deployment cannot answer', () => {
  it('on no standing issues nothing, whichever verb it names', async () => {
    const controller = await harness('none')
    // Where a deployment mounts an authorization rule this is unreachable;
    // where it mounts none, every call arrives here.
    expect(await codeOf(controller.list())).toBe('invitations/no-standing')
    expect(await codeOf(controller.issue({ label: 'Bea', role: 'member', organization: 'acme' })))
      .toBe('invitations/no-standing')
    expect(await codeOf(controller.revoke('x'))).toBe('invitations/no-standing')
  })

  it('failing for a reason that is not a refusal answers as itself', async () => {
    const controller = await harness(standing('platform-administrator'), { fails: 'the store is gone' })
    // Only the seam's own refusals have wire codes; anything else is the
    // carrier's to report, not something an administrator can correct.
    await expect(controller.list()).rejects.toThrow('the store is gone')
    await expect(controller.issue({ label: 'Bea', role: 'member', organization: 'acme' }))
      .rejects.toThrow('the store is gone')
    expect(await codeOf(controller.issue({ label: 'Bea', role: 'member', organization: 'acme' })))
      .toBeUndefined()
  })

  it('issuing no invitations answers that it issues none', async () => {
    const controller = await harness(standing('platform-administrator'), { invitations: false })
    expect(await codeOf(controller.list())).toBe('gateway/internal')
  })
})
