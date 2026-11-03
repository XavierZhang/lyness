/**
 * What the viewer surface answers: the single-operator shape, a signed-out
 * viewer of a deployment with accounts, a signed-in one, and the channels a
 * surface may offer.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@lyness/cordis'
import { brandString } from '@lyness/lyn-brand'
import type { Membership, MembershipId, Person, PersonId, Role } from '@lyness/lyn-people'
import type { Principal } from '@lyness/lyn-request-principal'
import IdentityController from '../src/index.ts'

const ADA = brandString<PersonId>('ada')

const live: Context[] = []
afterEach(async () => { for (const ctx of live.splice(0)) await ctx.fiber.dispose() })

/** What one harness mounts beside the controller. */
interface Mounted {
  /** Mount the request principal, with this as its answer. */
  readonly principal?: Principal | 'none'
  /** People the directory knows. */
  readonly people?: readonly Person[]
  /** Standings the directory knows. */
  readonly standings?: readonly Membership[]
  /** Channels the sign-in registry offers; absent mounts no registry. */
  readonly channels?: readonly { id: string; displayName: string; kind: 'redirect' | 'self-driven' }[]
}

/** One standing, as the directory reports it. */
function standing(role: Role, organization?: string): Membership {
  return {
    id: brandString<MembershipId>(`ada:${role}`),
    person: ADA,
    role,
    ...organization === undefined ? {} : { organization },
  }
}

/** Mount the controller over exactly the services one test needs. */
async function harness(mounted: Mounted): Promise<IdentityController> {
  const ctx = new Context()
  live.push(ctx)
  if (mounted.principal !== undefined) {
    const current = mounted.principal === 'none' ? undefined : mounted.principal
    ctx.provide('requestPrincipal', { current: () => current })
  }
  if (mounted.people !== undefined || mounted.standings !== undefined) {
    ctx.provide('people', {
      person: (id: PersonId) => Promise.resolve(mounted.people?.find(one => one.id === id)),
      membership: (id: MembershipId) => Promise.resolve(mounted.standings?.find(one => one.id === id)),
      memberships: () => Promise.resolve([]),
    })
  }
  if (mounted.channels !== undefined) {
    ctx.provide('signIn', { available: () => mounted.channels })
  }
  await ctx.plugin(IdentityController)
  return ctx.identityController
}

describe('a deployment with no accounts', () => {
  it('says so, and offers nothing to sign in with', async () => {
    const controller = await harness({})
    expect(await controller.viewer()).toEqual({
      accounts: false,
      channels: [],
      signInPrefix: '/auth/sign-in',
      signOutPath: '/auth/sign-out',
    })
  })
})

describe('a deployment with accounts', () => {
  it('names the channels a surface may offer, and which are a link', async () => {
    const controller = await harness({
      principal: 'none',
      channels: [
        { id: 'wecom', displayName: '企业微信', kind: 'redirect' },
        { id: 'local', displayName: 'This machine', kind: 'self-driven' },
      ],
    })
    const viewer = await controller.viewer()
    expect(viewer.accounts).toBe(true)
    expect(viewer.channels).toEqual([
      { id: 'wecom', displayName: '企业微信', redirect: true },
      { id: 'local', displayName: 'This machine', redirect: false },
    ])
    expect(viewer.person).toBeUndefined()
  })

  it('names the person a signed-in call speaks for', async () => {
    const held = standing('tenant-administrator', 'acme')
    const controller = await harness({
      principal: { person: ADA, acting: { person: ADA, membership: held.id } },
      people: [{ id: ADA, displayName: 'Ada' }],
      standings: [held],
      channels: [],
    })
    expect(await controller.viewer()).toMatchObject({
      accounts: true,
      person: { id: 'ada', displayName: 'Ada' },
      standing: { id: 'ada:tenant-administrator', role: 'tenant-administrator', organization: 'acme' },
    })
  })

  it('names a platform administrator without an organization', async () => {
    const held = standing('platform-administrator')
    const controller = await harness({
      principal: { person: ADA, acting: { person: ADA, membership: held.id } },
      people: [{ id: ADA, displayName: 'Ada' }],
      standings: [held],
    })
    expect((await controller.viewer()).standing).toEqual({
      id: 'ada:platform-administrator',
      role: 'platform-administrator',
    })
  })

  it('reports no standing for a call acting in a personal context', async () => {
    const controller = await harness({
      principal: { person: ADA, acting: { person: ADA } },
      people: [{ id: ADA, displayName: 'Ada' }],
    })
    const viewer = await controller.viewer()
    expect(viewer.person).toEqual({ id: 'ada', displayName: 'Ada' })
    expect(viewer.standing).toBeUndefined()
  })

  it('reports a session that outlived its person as signed out', async () => {
    const controller = await harness({
      principal: { person: ADA, acting: { person: ADA } },
      people: [],
    })
    expect((await controller.viewer()).person).toBeUndefined()
  })

  it('reports a standing the directory no longer holds as none', async () => {
    const controller = await harness({
      principal: { person: ADA, acting: { person: ADA, membership: brandString<MembershipId>('gone') } },
      people: [{ id: ADA, displayName: 'Ada' }],
      standings: [],
    })
    expect((await controller.viewer()).standing).toBeUndefined()
  })

  it('answers about a signed-in person even where no directory is mounted', async () => {
    const controller = await harness({ principal: { person: ADA, acting: { person: ADA } } })
    const viewer = await controller.viewer()
    expect(viewer.accounts).toBe(true)
    expect(viewer.person).toBeUndefined()
  })
})
