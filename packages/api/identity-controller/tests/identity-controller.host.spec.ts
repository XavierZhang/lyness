/**
 * What the viewer surface answers: the single-operator shape, a signed-out
 * viewer of a deployment with accounts, a signed-in one, and the channels a
 * surface may offer.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@lyness/cordis'
import { brandString } from '@lyness/lyn-brand'
import type { AuthSessionId } from '@lyness/lyn-auth-session'
import type { Membership, MembershipId, Person, PersonId, Role } from '@lyness/lyn-people'
import type { Principal } from '@lyness/lyn-request-principal'
import IdentityController from '../src/index.ts'

/** The session every principal in this spec presents; no case addresses another. */
const SESSION = brandString<AuthSessionId>('test-session')

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
  /** Mount a session store recording what each switch asked for; absent mounts none. */
  readonly sessions?: { readonly switched: { session: string; membership: string | undefined }[] }
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
      memberships: () => Promise.resolve(mounted.standings ?? []),
    })
  }
  if (mounted.sessions !== undefined) {
    const recorded = mounted.sessions.switched
    ctx.provide('authSessions', {
      switchContext: (session: string, acting: { membership?: string }) => {
        recorded.push({ session, membership: acting.membership })
        return Promise.resolve({})
      },
    } as never)
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
      standings: [],
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
      principal: { session: SESSION, person: ADA, acting: { person: ADA, membership: held.id } },
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
      principal: { session: SESSION, person: ADA, acting: { person: ADA, membership: held.id } },
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
      principal: { session: SESSION, person: ADA, acting: { person: ADA } },
      people: [{ id: ADA, displayName: 'Ada' }],
    })
    const viewer = await controller.viewer()
    expect(viewer.person).toEqual({ id: 'ada', displayName: 'Ada' })
    expect(viewer.standing).toBeUndefined()
  })

  it('reports a session that outlived its person as signed out', async () => {
    const controller = await harness({
      principal: { session: SESSION, person: ADA, acting: { person: ADA } },
      people: [],
    })
    expect((await controller.viewer()).person).toBeUndefined()
  })

  it('reports a standing the directory no longer holds as none', async () => {
    const controller = await harness({
      principal: { session: SESSION, person: ADA, acting: { person: ADA, membership: brandString<MembershipId>('gone') } },
      people: [{ id: ADA, displayName: 'Ada' }],
      standings: [],
    })
    expect((await controller.viewer()).standing).toBeUndefined()
  })

  it('offers every standing this person holds, so a surface can ask', async () => {
    const platform = standing('platform-administrator')
    const tenant = { ...standing('tenant-administrator', 'acme'), id: brandString<MembershipId>('ada:acme') }
    const controller = await harness({
      principal: { session: SESSION, person: ADA, acting: { person: ADA } },
      people: [{ id: ADA, displayName: 'Ada' }],
      standings: [platform, tenant],
    })
    const viewer = await controller.viewer()
    // Nothing in force and two to choose between: which organization they act
    // for is the person's own decision.
    expect(viewer.standing).toBeUndefined()
    expect(viewer.standings).toEqual([
      { id: 'ada:platform-administrator', role: 'platform-administrator' },
      { id: 'ada:acme', role: 'tenant-administrator', organization: 'acme' },
    ])
  })

  it('offers nothing to a call that presented no identity', async () => {
    const controller = await harness({ principal: 'none', people: [{ id: ADA, displayName: 'Ada' }] })
    expect((await controller.viewer()).standings).toEqual([])
  })

  it('answers about a signed-in person even where no directory is mounted', async () => {
    const controller = await harness({ principal: { session: SESSION, person: ADA, acting: { person: ADA } } })
    const viewer = await controller.viewer()
    expect(viewer.accounts).toBe(true)
    expect(viewer.person).toBeUndefined()
  })
})

describe('acting in one of your own standings', () => {
  it('puts it in force on the session this call presented', async () => {
    const tenant = { ...standing('tenant-administrator', 'acme'), id: brandString<MembershipId>('ada:acme') }
    const switched: { session: string; membership: string | undefined }[] = []
    const controller = await harness({
      principal: { session: SESSION, person: ADA, acting: { person: ADA } },
      people: [{ id: ADA, displayName: 'Ada' }],
      standings: [standing('platform-administrator'), tenant],
      sessions: { switched },
    })

    await controller.act('ada:acme')
    // One session, its own: nothing here names another.
    expect(switched).toEqual([{ session: SESSION, membership: 'ada:acme' }])
  })

  it('answers with the standing it put in force, not the one it replaced', async () => {
    const tenant = { ...standing('tenant-administrator', 'acme'), id: brandString<MembershipId>('ada:acme') }
    const controller = await harness({
      // The principal is established once per request, before this call runs,
      // so it still reports no standing; a surface that rendered this answer
      // would otherwise be told to ask the question it just answered.
      principal: { session: SESSION, person: ADA, acting: { person: ADA } },
      people: [{ id: ADA, displayName: 'Ada' }],
      standings: [standing('platform-administrator'), tenant],
      sessions: { switched: [] },
    })

    expect((await controller.act('ada:acme')).standing)
      .toEqual({ id: 'ada:acme', role: 'tenant-administrator', organization: 'acme' })
  })

  it('refuses a standing this caller does not hold, and changes nothing', async () => {
    const switched: { session: string; membership: string | undefined }[] = []
    const controller = await harness({
      principal: { session: SESSION, person: ADA, acting: { person: ADA } },
      people: [{ id: ADA, displayName: 'Ada' }],
      standings: [standing('platform-administrator')],
      sessions: { switched },
    })

    await expect(controller.act('bea:acme')).rejects.toMatchObject({ code: 'identity/not-held' })
    expect(switched).toEqual([])
  })

  it('refuses a call that presented no identity', async () => {
    const controller = await harness({ principal: 'none', sessions: { switched: [] } })
    await expect(controller.act('ada:acme')).rejects.toMatchObject({ code: 'identity/no-identity' })
  })

  it('refuses where this deployment keeps no sessions', async () => {
    const controller = await harness({
      principal: { session: SESSION, person: ADA, acting: { person: ADA } },
      people: [{ id: ADA, displayName: 'Ada' }],
      standings: [standing('platform-administrator')],
    })
    await expect(controller.act('ada:platform-administrator')).rejects.toMatchObject({ code: 'gateway/internal' })
  })

  it('refuses a standing where no directory can say who holds what', async () => {
    const controller = await harness({
      principal: { session: SESSION, person: ADA, acting: { person: ADA } },
      sessions: { switched: [] },
    })
    await expect(controller.act('ada:platform-administrator')).rejects.toMatchObject({ code: 'identity/not-held' })
  })
})
