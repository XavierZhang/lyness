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
import { Context } from '@deepseek-ai/cordis'
import { brandString } from '@deepseek-ai/dsh-brand'
import AdminAudit from '@deepseek-ai/dsh-admin-audit'
import Invitations from '@deepseek-ai/dsh-invitations'
import ManagedPeople from '@deepseek-ai/dsh-managed-people'
import ManagedPeopleDirectory from '@deepseek-ai/dsh-managed-people/directory'
import type { Membership, MembershipId, PersonId, Role } from '@deepseek-ai/dsh-people'
import Storage from '@deepseek-ai/dsh-storage'
import * as StorageJson from '@deepseek-ai/dsh-storage-json'
import * as StorageDomain from '@deepseek-ai/dsh-storage-domain'
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import InvitationsController from '../src/index.ts'

const ADA = brandString<PersonId>('ada')

const live: Context[] = []
let root: string | undefined

/**
 * The deployment the last harness built, for the tests that need more than
 * its controller: who the next call signs in as, and the roster to write a
 * stored person into.
 */
let built: { ctx: Context; becomes: (person: PersonId) => void } | undefined

afterEach(async () => {
  for (const ctx of live.splice(0)) await ctx.fiber.dispose()
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
  built = undefined
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
  root ??= await mkdtemp(join(tmpdir(), 'dsh-invitations-controller-'))
  const ctx = new Context()
  live.push(ctx)
  let who: PersonId | undefined = by === 'none' ? undefined : by.person
  ctx.provide('requestPrincipal', {
    current: () => by === 'none' || who === undefined
      ? undefined
      : { person: who, acting: { person: by.person, membership: by.id } },
  })
  built = { ctx, becomes: (person) => { who = person } }
  if (options.fails !== undefined) {
    const failure = options.fails
    ctx.provide('invitations', {
      list: () => Promise.reject(new Error(failure)),
      issue: () => Promise.reject(new Error(failure)),
      accept: () => Promise.reject(new Error(failure)),
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

describe('a member accepting an invitation', () => {
  it('accepts as the person the call signed in as, and answers what they now hold', async () => {
    const controller = await harness(standing('platform-administrator'))
    const deployment = built
    if (deployment === undefined) throw new Error('the harness built no deployment')
    const bea = await deployment.ctx.managedPeople.save(
      { displayName: 'Bea', role: 'member', organization: 'acme' }, standing('platform-administrator'),
    )
    const issued = await controller.issue({ label: 'Bea again', role: 'tenant-administrator', organization: 'beta' })

    // The person comes from the call's own session, never from an argument.
    deployment.becomes(bea.id)
    expect(await controller.accept(issued.code ?? '')).toEqual({
      accepted: true, role: 'tenant-administrator', organization: 'beta',
    })
  })

  it('answers the same for every code that grants nothing', async () => {
    const controller = await harness(standing('platform-administrator'))
    const deployment = built
    if (deployment === undefined) throw new Error('the harness built no deployment')
    const bea = await deployment.ctx.managedPeople.save(
      { displayName: 'Bea', role: 'member', organization: 'acme' }, standing('platform-administrator'),
    )
    const issued = await controller.issue({ label: 'again', role: 'member', organization: 'acme' })
    deployment.becomes(bea.id)

    // A wrong code, and one granting what they already hold: telling them
    // apart would report which codes exist to anybody signed in.
    expect(await controller.accept('not-a-code')).toEqual({ accepted: false })
    expect(await controller.accept(issued.code ?? '')).toEqual({ accepted: false })
  })

  it('answers a standing that names no organization without one', async () => {
    const controller = await harness(standing('platform-administrator'))
    const deployment = built
    if (deployment === undefined) throw new Error('the harness built no deployment')
    const bea = await deployment.ctx.managedPeople.save(
      { displayName: 'Bea', role: 'member', organization: 'acme' }, standing('platform-administrator'),
    )
    const issued = await controller.issue({ label: 'to the platform', role: 'platform-administrator' })
    deployment.becomes(bea.id)

    expect(await controller.accept(issued.code ?? ''))
      .toEqual({ accepted: true, role: 'platform-administrator' })
  })

  it('refuses a call that presented no identity, having nobody to accept as', async () => {
    const controller = await harness('none')
    expect(await codeOf(controller.accept('any-code'))).toBe('invitations/no-identity')
  })

  it('answers that this deployment issues none, and reports a carrier failure as itself', async () => {
    expect(await codeOf((await harness(standing('member'), { invitations: false })).accept('x')))
      .toBe('gateway/internal')
    await expect((await harness(standing('member'), { fails: 'the store is gone' })).accept('x'))
      .rejects.toThrow('the store is gone')
  })
})
