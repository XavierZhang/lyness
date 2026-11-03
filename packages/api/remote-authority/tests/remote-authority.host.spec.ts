/**
 * What the rule admits and what it refuses: the four standings, a call that
 * presented no identity, one that acts in no standing, and an endpoint nobody
 * classified.
 */

import { Context } from '@lyness/cordis'
import { afterEach, describe, expect, it } from 'vitest'
import { brandString } from '@lyness/lyn-brand'
import type { Membership, MembershipId, PersonId, Role } from '@lyness/lyn-people'
import type { Principal } from '@lyness/lyn-request-principal'
import type { RemoteAuthority } from '@lyness/lyn-typert-protocol'
import type { RemoteAuthorizationRequest } from '@lyness/lyn-api-gateway'
import { ANONYMOUS, NO_STANDING, UNCLASSIFIED, apply, inject, refusal, satisfies } from '../src/index.ts'

const ADA = brandString<PersonId>('ada')

const live: Context[] = []
afterEach(async () => { for (const ctx of live.splice(0)) await ctx.fiber.dispose() })

/** One standing, as the directory reports it. */
function standing(role: Role): Membership {
  return {
    id: brandString<MembershipId>(`ada:${role}`),
    person: ADA,
    role,
    ...role === 'platform-administrator' ? {} : { organization: 'acme' },
  }
}

/** Ask the mounted rule about one endpoint. */
async function ask(
  options: { principal?: Principal; standings?: readonly Membership[] },
  requires: RemoteAuthority | undefined,
): Promise<string | undefined> {
  const ctx = new Context()
  live.push(ctx)
  ctx.provide('requestPrincipal', { current: () => options.principal })
  ctx.provide('people', {
    membership: (id: MembershipId) => Promise.resolve(options.standings?.find(held => held.id === id)),
    memberships: () => Promise.resolve([]),
  })
  await ctx.plugin({ inject: [...inject], apply }).await()
  const call: RemoteAuthorizationRequest = {
    endpoint: 'settings/update',
    namespace: 'settings',
    method: 'update',
    requires,
  }
  return ctx.bail('typert/authorize', call)
}

/** Act as Ada in one standing. */
function as(role: Role): { principal: Principal; standings: readonly Membership[] } {
  const held = standing(role)
  return {
    principal: { person: ADA, acting: { person: ADA, membership: held.id } },
    standings: [held],
  }
}

describe('what one standing satisfies', () => {
  it('admits a platform administrator everywhere', () => {
    for (const required of ['anyone', 'member', 'tenant-administrator', 'platform-administrator'] as const) {
      expect(satisfies('platform-administrator', required)).toBe(true)
    }
  })

  it('admits a tenant administrator to its own level and below, not the platform’s', () => {
    expect(satisfies('tenant-administrator', 'member')).toBe(true)
    expect(satisfies('tenant-administrator', 'tenant-administrator')).toBe(true)
    expect(satisfies('tenant-administrator', 'platform-administrator')).toBe(false)
  })

  it('admits a member only where a member is enough', () => {
    expect(satisfies('member', 'member')).toBe(true)
    expect(satisfies('member', 'tenant-administrator')).toBe(false)
    expect(satisfies('member', 'platform-administrator')).toBe(false)
    expect(satisfies('member', 'anyone')).toBe(true)
  })
})

describe('the mounted rule', () => {
  it('admits an endpoint anyone may reach, before any identity is resolved', async () => {
    expect(await ask({}, 'anyone')).toBeUndefined()
  })

  it('refuses an endpoint nobody classified, rather than admitting it', async () => {
    expect(await ask(as('platform-administrator'), undefined)).toBe(UNCLASSIFIED)
  })

  it('refuses a call that presented no identity', async () => {
    expect(await ask({}, 'member')).toBe(ANONYMOUS)
  })

  it('admits any signed-in person where a member is enough', async () => {
    expect(await ask(as('member'), 'member')).toBeUndefined()
    // A personal context is signed in too: it holds no standing, and a member
    // requirement does not ask for one.
    expect(await ask({ principal: { person: ADA, acting: { person: ADA } } }, 'member')).toBeUndefined()
  })

  it('refuses a personal context where a standing is required', async () => {
    const personal = { principal: { person: ADA, acting: { person: ADA } } }
    expect(await ask(personal, 'tenant-administrator')).toBe(NO_STANDING)
  })

  it('refuses a standing the directory does not know', async () => {
    expect(await ask({ principal: as('member').principal }, 'tenant-administrator')).toBe(NO_STANDING)
  })

  it('refuses a member an administrator endpoint, naming both standings', async () => {
    expect(await ask(as('member'), 'platform-administrator'))
      .toBe(refusal('platform-administrator', 'member'))
  })

  it('refuses a tenant administrator the platform’s own endpoints', async () => {
    expect(await ask(as('tenant-administrator'), 'platform-administrator'))
      .toBe(refusal('platform-administrator', 'tenant-administrator'))
  })

  it('admits a tenant administrator its own organization’s endpoints', async () => {
    expect(await ask(as('tenant-administrator'), 'tenant-administrator')).toBeUndefined()
  })

  it('stops refusing when its plugin is unloaded', async () => {
    const ctx = new Context()
    live.push(ctx)
    ctx.provide('requestPrincipal', { current: () => undefined })
    ctx.provide('people', { membership: () => Promise.resolve(undefined), memberships: () => Promise.resolve([]) })
    const fiber = await ctx.plugin({ inject: [...inject], apply }).await()
    const call: RemoteAuthorizationRequest = { endpoint: 'a/b', namespace: 'a', method: 'b', requires: 'member' }
    expect(await ctx.bail('typert/authorize', call)).toBe(ANONYMOUS)
    await fiber.dispose()
    expect(await ctx.bail('typert/authorize', call)).toBeUndefined()
  })
})
