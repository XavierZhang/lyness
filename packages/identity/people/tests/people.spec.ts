/**
 * People, their standing, and who may administer what.
 *
 * The authorization predicate is tested directly rather than through a
 * surface, because every operation that restricts itself to administrators
 * will call it and none of them will go through a page to do so.
 */

import { Context } from '@deepseek-ai/cordis'
import { brandString } from '@deepseek-ai/dsh-brand'
import { expect, it } from 'vitest'
import { ROLES, administers, isRole } from '../src/index.ts'
import type { Membership, MembershipId, PersonId } from '../src/types.ts'
import StaticPeopleDirectory, { resolveEntry } from '../src/static.ts'

/** One standing, built without a directory. */
function standing(role: Membership['role'], organization?: string): Membership {
  return {
    id: brandString<MembershipId>(`m:${role}`),
    person: brandString<PersonId>('p'),
    role,
    ...organization === undefined ? {} : { organization },
  }
}

it('lets a tenant administrator administer only its own organization', () => {
  const admin = standing('tenant-administrator', 'acme')

  expect(administers(admin, 'acme')).toBe(true)
  expect(administers(admin, 'other')).toBe(false)
  // Administering "no organization" is the platform's, not a tenant's.
  expect(administers(admin, undefined)).toBe(false)
})

it('lets a platform administrator administer every organization', () => {
  const platform = standing('platform-administrator')

  // One predicate rather than a role comparison at each call site, so no
  // operation has to remember that the platform role outranks the tenant one.
  expect(administers(platform, 'acme')).toBe(true)
  expect(administers(platform, 'other')).toBe(true)
  expect(administers(platform, undefined)).toBe(true)
})

it('never lets a member administer, including its own organization', () => {
  const member = standing('member', 'acme')

  expect(administers(member, 'acme')).toBe(false)
  expect(administers(member, undefined)).toBe(false)
})

it('refuses a tenant administrator standing that names no organization', () => {
  // Such a standing would administer nothing while reading as an
  // administrator, which is worse than being refused.
  expect(() => resolveEntry({ id: 'a', displayName: 'A', role: 'tenant-administrator' }))
    .toThrow(/names no organization/)
})

it('refuses a role this deployment does not know', () => {
  expect(() => resolveEntry({ id: 'a', displayName: 'A', role: 'auditor' }))
    .toThrow(/unknown role/)
  expect(isRole('auditor')).toBe(false)
  expect(ROLES.every(isRole)).toBe(true)
})

it('serves the operator roster by person, by standing, and by owner', async () => {
  const ctx = new Context()
  await ctx.plugin(StaticPeopleDirectory, {
    people: [
      { id: 'root', displayName: 'Platform Root', role: 'platform-administrator' },
      { id: 'ada', displayName: 'Ada', role: 'tenant-administrator', organization: 'acme' },
      { id: 'bob', displayName: 'Bob', role: 'member', organization: 'acme' },
    ],
  }).await()

  const ada = brandString<PersonId>('ada')
  expect((await ctx.people.person(ada))?.displayName).toBe('Ada')
  const held = await ctx.people.memberships(ada)
  expect(held).toHaveLength(1)
  expect(held[0]?.role).toBe('tenant-administrator')
  expect(await ctx.people.membership(brandString<MembershipId>('ada:tenant-administrator')))
    .toMatchObject({ organization: 'acme' })
})

it('reports nothing for a person the roster does not name', async () => {
  const ctx = new Context()
  await ctx.plugin(StaticPeopleDirectory, {
    people: [{ id: 'ada', displayName: 'Ada', role: 'member', organization: 'acme' }],
  }).await()

  // Only the people the roster names may use the installation, so an unknown
  // identity holds no standing rather than a default one.
  expect(await ctx.people.person(brandString<PersonId>('ghost'))).toBeUndefined()
  expect(await ctx.people.memberships(brandString<PersonId>('ghost'))).toEqual([])
})

it('refuses an empty roster and a duplicate identity at load', async () => {
  const ctx = new Context()

  await expect(ctx.plugin(StaticPeopleDirectory, { people: [] }).await())
    .rejects.toThrow(/at least one person/)
  await expect(ctx.plugin(StaticPeopleDirectory, {
    people: [
      { id: 'ada', displayName: 'Ada', role: 'member', organization: 'acme' },
      { id: 'ada', displayName: 'Ada again', role: 'tenant-administrator', organization: 'acme' },
    ],
  }).await()).rejects.toThrow(/duplicate person id/)
})

it('serves every standing a written entry lists', async () => {
  const ctx = new Context()
  await ctx.plugin(StaticPeopleDirectory, {
    people: [{
      id: 'ada',
      displayName: 'Ada',
      standings: [
        { role: 'platform-administrator' },
        { role: 'tenant-administrator', organization: 'acme' },
        { role: 'member', organization: 'beta' },
      ],
    }],
  }).await()

  const held = await ctx.people.memberships(brandString<PersonId>('ada'))
  expect(held.map(one => [one.id, one.role, one.organization])).toEqual([
    ['ada:platform:platform-administrator', 'platform-administrator', undefined],
    ['ada:acme:tenant-administrator', 'tenant-administrator', 'acme'],
    ['ada:beta:member', 'member', 'beta'],
  ])
  // Each is reachable on its own, because a session names one of them.
  expect(await ctx.people.membership(brandString<MembershipId>('ada:beta:member')))
    .toMatchObject({ person: 'ada', role: 'member', organization: 'beta' })
})

it('keeps the identity a one-standing entry has always had', () => {
  // A roster written before entries could list standings produced this id,
  // and sessions and invitations name it: deriving another one would leave
  // them holding a standing nobody has.
  const { memberships } = resolveEntry({ id: 'ada', displayName: 'Ada', role: 'tenant-administrator', organization: 'acme' })
  expect(memberships.map(one => one.id)).toEqual(['ada:tenant-administrator'])
})

it('refuses an entry that writes both forms, neither, or one standing twice', () => {
  expect(() => resolveEntry({ id: 'ada', displayName: 'Ada' }))
    .toThrow(/names no standing/)
  expect(() => resolveEntry({ id: 'ada', displayName: 'Ada', standings: [] }))
    .toThrow(/names no standing/)
  expect(() => resolveEntry({
    id: 'ada', displayName: 'Ada', role: 'member', organization: 'acme',
    standings: [{ role: 'platform-administrator' }],
  })).toThrow(/writes both/)
  expect(() => resolveEntry({
    id: 'ada',
    displayName: 'Ada',
    standings: [{ role: 'member', organization: 'acme' }, { role: 'member', organization: 'acme' }],
  })).toThrow(/holds "member" in that organization twice/)
})

it('applies every standing rule to a listed one as well', () => {
  expect(() => resolveEntry({ id: 'ada', displayName: 'Ada', standings: [{ role: 'auditor' }] }))
    .toThrow(/unknown role/)
  expect(() => resolveEntry({ id: 'ada', displayName: 'Ada', standings: [{ role: 'tenant-administrator' }] }))
    .toThrow(/names no organization/)
})
