/**
 * What an administrator may change about who uses a deployment: the people
 * composition wrote and may not be touched here, the ones they add, who may
 * grant which standing, and which directory identity signs in as whom.
 */

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@lyness/cordis'
import { brandString } from '@lyness/lyn-brand'
import type { Membership, MembershipId, PersonId, Role } from '@lyness/lyn-people'
import type { ChannelId } from '@lyness/lyn-sign-in'
import Storage from '@lyness/lyn-storage'
import * as StorageJson from '@lyness/lyn-storage-json'
import * as StorageDomain from '@lyness/lyn-storage-domain'
import AdminAudit from '@lyness/lyn-admin-audit'
import ManagedPeople, {
  ALREADY_BOUND, NOT_PERMITTED, ORGANIZATION_REQUIRED, PeopleRefusedError, UNKNOWN_PERSON, WRITTEN,
  bindingKey, standingOf,
} from '../src/index.ts'
import ManagedPeopleDirectory, { declaredPeople } from '../src/directory.ts'
import ManagedAdmission, { declaredBindings } from '../src/admission.ts'

const ADA = brandString<PersonId>('ada')

const live: Context[] = []
const roots: string[] = []

afterEach(async () => {
  for (const ctx of live.splice(0)) await ctx.fiber.dispose()
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true })
})

/** One standing, as the directory reports it. */
function standing(role: Role, organization?: string, person: PersonId = ADA): Membership {
  return {
    id: brandString<MembershipId>(`${person}:${role}`),
    person,
    role,
    ...organization === undefined ? {} : { organization },
  }
}

/** A deployment storing its directory, with whatever rows the test composes. */
async function bench(options: {
  people?: { id: string; displayName: string; role: string; organization?: string }[]
  bindings?: { channel: string; issuer: string; subject: string; person: string }[]
  channels?: readonly string[]
} = {}): Promise<Context> {
  const root = await mkdtemp(join(tmpdir(), 'lyn-managed-people-'))
  roots.push(root)
  const ctx = new Context()
  live.push(ctx)
  await ctx.plugin(Storage)
  await ctx.plugin(StorageJson, { root })
  await ctx.plugin(StorageDomain, { backend: 'json' })
  if (options.channels !== undefined) {
    const offered = options.channels
    // The real service filters by the standing; the fixture answers the ids
    // the test says this standing administers.
    ctx.provide('signInChannels', { list: () => Promise.resolve(offered.map(id => ({ id }))) } as never)
  }
  await ctx.plugin(AdminAudit, {}).await()
  await ctx.plugin(ManagedPeople).await()
  if (options.people !== undefined) await ctx.plugin(ManagedPeopleDirectory, { people: options.people }).await()
  if (options.bindings !== undefined) await ctx.plugin(ManagedAdmission, { bindings: options.bindings }).await()
  return ctx
}

/** The operator's own roster: one platform administrator and nobody else. */
const OPERATOR = [{ id: 'ada', displayName: 'Ada', role: 'platform-administrator' }]

describe('the people composition wrote', () => {
  it('answer every lookup and cannot be changed here', async () => {
    const ctx = await bench({ people: OPERATOR })
    const platform = standing('platform-administrator')

    expect(await ctx.people.person(ADA)).toMatchObject({ id: ADA, displayName: 'Ada' })
    expect(await ctx.people.membership(brandString<MembershipId>('ada:platform-administrator')))
      .toMatchObject({ person: ADA, role: 'platform-administrator' })
    expect(await ctx.people.memberships(ADA)).toMatchObject([{ role: 'platform-administrator' }])
    expect(await ctx.managedPeople.list(platform)).toMatchObject([{ id: ADA, written: true, bindings: [] }])
    // The next boot reads the file again, so a change accepted here would be
    // undone and the surface would have reported something untrue.
    await expect(ctx.managedPeople.save({ id: ADA, displayName: 'Renamed', role: 'member' }, platform))
      .rejects.toMatchObject({ reason: 'written', message: WRITTEN })
    await expect(ctx.managedPeople.remove(ADA, platform)).rejects.toMatchObject({ reason: 'written' })
  })

  it('refuse an empty roster, because nobody could then add the first person', () => {
    expect(() => declaredPeople({ people: [] })).toThrow(/must name at least one person/u)
  })

  it('refuse the same person written twice', () => {
    expect(() => declaredPeople({ people: [...OPERATOR, ...OPERATOR] })).toThrow(/duplicate person id/u)
  })
})

describe('the people an administrator adds', () => {
  it('are served by the directory as soon as they are stored', async () => {
    const ctx = await bench({ people: OPERATOR })
    const added = await ctx.managedPeople.save(
      { displayName: 'Bea', role: 'member', organization: 'acme' },
      standing('platform-administrator'),
    )

    expect(await ctx.people.person(added.id)).toMatchObject({ displayName: 'Bea' })
    expect(await ctx.people.memberships(added.id)).toEqual([
      { id: standingOf(added.id), person: added.id, role: 'member', organization: 'acme' },
    ])
    expect(await ctx.people.membership(standingOf(added.id))).toMatchObject({ role: 'member' })
  })

  it('keep the standing they signed in with when their role changes', async () => {
    const ctx = await bench({ people: OPERATOR })
    const platform = standing('platform-administrator')
    const added = await ctx.managedPeople.save({ displayName: 'Bea', role: 'member', organization: 'acme' }, platform)
    await ctx.managedPeople.save(
      { id: added.id, displayName: 'Bea', role: 'tenant-administrator', organization: 'acme' },
      platform,
    )

    // A membership id that moved would leave an open session acting with no
    // standing at all, which reads as having none rather than as a change.
    expect(await ctx.people.membership(standingOf(added.id))).toMatchObject({ role: 'tenant-administrator' })
  })

  it('belong to the organization that added them, and to no other administrator', async () => {
    const ctx = await bench({ people: OPERATOR })
    const acme = standing('tenant-administrator', 'acme')
    const other = standing('tenant-administrator', 'other')
    const added = await ctx.managedPeople.save({ displayName: 'Bea', role: 'member', organization: 'acme' }, acme)

    expect(await ctx.managedPeople.list(other)).toEqual([])
    await expect(ctx.managedPeople.save(
      { id: added.id, displayName: 'Taken', role: 'member', organization: 'other' },
      other,
    )).rejects.toMatchObject({ reason: 'not-permitted', message: NOT_PERMITTED })
    await expect(ctx.managedPeople.remove(added.id, other)).rejects.toMatchObject({ reason: 'not-permitted' })
  })

  it('cannot be given a standing the administrator does not hold', async () => {
    const ctx = await bench({ people: OPERATOR })
    // Granting a role grants what it may do, and a platform administrator
    // administers every organization, including the ones this one does not.
    await expect(ctx.managedPeople.save(
      { displayName: 'Mallory', role: 'platform-administrator' },
      standing('tenant-administrator', 'acme'),
    )).rejects.toMatchObject({ reason: 'not-permitted' })
    await expect(ctx.managedPeople.save(
      { displayName: 'Mallory', role: 'tenant-administrator' },
      standing('platform-administrator'),
    )).rejects.toMatchObject({ reason: 'organization-required', message: ORGANIZATION_REQUIRED })
  })

  it('may belong to no organization, and leave everybody else\'s bindings alone', async () => {
    const written = { channel: 'wecom-1', issuer: 'corp', subject: 'ada', person: 'ada' }
    const ctx = await bench({ people: OPERATOR, bindings: [written] })
    const platform = standing('platform-administrator')
    const deputy = await ctx.managedPeople.save({ displayName: 'Deputy', role: 'platform-administrator' }, platform)
    const member = await ctx.managedPeople.save({ displayName: 'Bea', role: 'member', organization: 'acme' }, platform)
    await ctx.managedPeople.bind({ channel: 'wecom-1', issuer: 'corp', subject: 'bea', person: member.id }, platform)

    const renamed = await ctx.managedPeople.save(
      { id: deputy.id, displayName: 'Deputy II', role: 'platform-administrator' },
      platform,
    )
    expect(renamed).toMatchObject({ displayName: 'Deputy II', bindings: [] })
    expect(renamed.organization).toBeUndefined()
    expect(await ctx.people.membership(standingOf(deputy.id))).toMatchObject({ role: 'platform-administrator' })

    await ctx.managedPeople.remove(deputy.id, platform)
    expect(await ctx.managedPeople.admit(bindingKey('wecom-1', 'corp', 'bea'))).toEqual(member.id)
    expect(await ctx.people.membership(brandString<MembershipId>('nobody:standing'))).toBeUndefined()
  })

  it('are removed with the identities that signed in as them', async () => {
    const ctx = await bench({ people: OPERATOR, bindings: [] })
    const platform = standing('platform-administrator')
    const added = await ctx.managedPeople.save({ displayName: 'Bea', role: 'member', organization: 'acme' }, platform)
    await ctx.managedPeople.bind({ channel: 'wecom-1', issuer: 'corp', subject: 'bea', person: added.id }, platform)
    await ctx.managedPeople.remove(added.id, platform)

    expect(await ctx.managedPeople.admit(bindingKey('wecom-1', 'corp', 'bea'))).toBeUndefined()
    expect(await ctx.people.person(added.id)).toBeUndefined()
    // Removing somebody who is not there is not an error: two surfaces
    // racing on the same row both report it gone.
    await expect(ctx.managedPeople.remove(added.id, platform)).resolves.toBeUndefined()
  })
})

describe('the directory identities admitted as them', () => {
  it('sign in as the person they are bound to', async () => {
    const ctx = await bench({ people: OPERATOR, bindings: [] })
    const platform = standing('platform-administrator')
    const added = await ctx.managedPeople.save({ displayName: 'Bea', role: 'member', organization: 'acme' }, platform)
    await ctx.managedPeople.bind({ channel: 'wecom-1', issuer: 'corp', subject: 'bea', person: added.id }, platform)

    expect(await ctx.signInAdmission.admit({
      channel: brandString<ChannelId>('wecom-1'), issuer: 'corp', subject: 'bea',
    })).toEqual(added.id)
    expect(await ctx.managedPeople.list(platform)).toContainEqual(expect.objectContaining({
      id: added.id,
      bindings: [{ channel: 'wecom-1', issuer: 'corp', subject: 'bea', written: false }],
    }))
  })

  it('are admitted once, and name somebody who exists', async () => {
    const ctx = await bench({ people: OPERATOR })
    const platform = standing('platform-administrator')
    const added = await ctx.managedPeople.save({ displayName: 'Bea', role: 'member', organization: 'acme' }, platform)
    const identity = { channel: 'wecom-1', issuer: 'corp', subject: 'bea' }
    await ctx.managedPeople.bind({ ...identity, person: added.id }, platform)

    // Two rows for one identity would decide who somebody signs in as by
    // whichever was read first.
    await expect(ctx.managedPeople.bind({ ...identity, person: ADA }, platform))
      .rejects.toMatchObject({ reason: 'already-bound', message: ALREADY_BOUND })
    await expect(ctx.managedPeople.bind(
      { channel: 'wecom-1', issuer: 'corp', subject: 'ghost', person: brandString<PersonId>('nobody') },
      platform,
    )).rejects.toMatchObject({ reason: 'unknown-person', message: UNKNOWN_PERSON })
  })

  it('are bound only by an administrator of the person and of the channel', async () => {
    const ctx = await bench({ people: OPERATOR, channels: ['acme-wecom'] })
    const acme = standing('tenant-administrator', 'acme')
    const added = await ctx.managedPeople.save({ displayName: 'Bea', role: 'member', organization: 'acme' }, acme)

    // A binding on another organization's directory lets that organization's
    // people sign in here, so the channel is authorized as well.
    await expect(ctx.managedPeople.bind(
      { channel: 'other-wecom', issuer: 'corp', subject: 'bea', person: added.id },
      acme,
    )).rejects.toMatchObject({ reason: 'not-permitted' })
    await expect(ctx.managedPeople.bind(
      { channel: 'acme-wecom', issuer: 'corp', subject: 'bea', person: added.id },
      acme,
    )).resolves.toMatchObject({ channel: 'acme-wecom', written: false })
    await expect(ctx.managedPeople.bind(
      { channel: 'acme-wecom', issuer: 'corp', subject: 'ada', person: ADA },
      acme,
    )).rejects.toMatchObject({ reason: 'not-permitted' })
  })

  it('stop signing in when the binding is withdrawn, and not before', async () => {
    const ctx = await bench({ people: OPERATOR })
    const platform = standing('platform-administrator')
    const acme = standing('tenant-administrator', 'acme')
    const added = await ctx.managedPeople.save({ displayName: 'Bea', role: 'member', organization: 'acme' }, platform)
    const identity = { channel: 'wecom-1', issuer: 'corp', subject: 'bea' }
    await ctx.managedPeople.bind({ ...identity, person: added.id }, platform)

    await expect(ctx.managedPeople.unbind(identity, standing('tenant-administrator', 'other')))
      .rejects.toMatchObject({ reason: 'not-permitted' })
    await ctx.managedPeople.unbind(identity, acme)
    expect(await ctx.managedPeople.admit(bindingKey('wecom-1', 'corp', 'bea'))).toBeUndefined()
    // Withdrawing one that is not there is the same no-op as removing a
    // person who is gone.
    await expect(ctx.managedPeople.unbind(identity, acme)).resolves.toBeUndefined()
  })
})

describe('what the trail records', () => {
  it('names the role a change replaced, and the identity a binding admitted', async () => {
    const ctx = await bench({ people: OPERATOR, bindings: [] })
    const platform = standing('platform-administrator')
    const added = await ctx.managedPeople.save({ displayName: 'Bea', role: 'member', organization: 'acme' }, platform)
    await ctx.managedPeople.save({
      id: added.id, displayName: 'Bea', role: 'tenant-administrator', organization: 'acme',
    }, platform)
    await ctx.managedPeople.bind({ channel: 'wecom-1', issuer: 'corp', subject: 'bea', person: added.id }, platform)

    const trail = await ctx.adminAudit.read({ organization: 'acme' }, platform)
    expect(trail.map(entry => [entry.kind, entry.action])).toEqual([
      ['binding', 'added'], ['person', 'changed'], ['person', 'added'],
    ])
    expect(trail[1]?.changes).toEqual([
      { field: 'role', before: 'member', after: 'tenant-administrator' },
    ])
    expect(trail[0]).toMatchObject({ subjectName: 'wecom-1:corp:bea', changes: [{ field: 'person', after: added.id }] })
  })

  it('records removing somebody as the bindings going with them', async () => {
    const ctx = await bench({ people: OPERATOR, bindings: [] })
    const platform = standing('platform-administrator')
    const added = await ctx.managedPeople.save({ displayName: 'Bea', role: 'member', organization: 'acme' }, platform)
    await ctx.managedPeople.bind({ channel: 'wecom-1', issuer: 'corp', subject: 'bea', person: added.id }, platform)
    await ctx.managedPeople.remove(added.id, platform)

    const trail = await ctx.adminAudit.read({ organization: 'acme' }, platform)
    // The binding is removed before the person, because that is the order the
    // operation does it in and the trail is what happened.
    expect(trail.map(entry => [entry.kind, entry.action])).toEqual([
      ['person', 'removed'], ['binding', 'removed'], ['binding', 'added'], ['person', 'added'],
    ])
  })

  it('records unbinding one identity on its own', async () => {
    const ctx = await bench({ people: OPERATOR, bindings: [] })
    const platform = standing('platform-administrator')
    const added = await ctx.managedPeople.save({ displayName: 'Bea', role: 'member', organization: 'acme' }, platform)
    const identity = { channel: 'wecom-1', issuer: 'corp', subject: 'bea' }
    await ctx.managedPeople.bind({ ...identity, person: added.id }, platform)
    await ctx.managedPeople.unbind(identity, platform)

    const trail = await ctx.adminAudit.read({ organization: 'acme' }, platform)
    expect(trail[0]).toMatchObject({
      kind: 'binding',
      action: 'removed',
      subjectName: 'wecom-1:corp:bea',
      changes: [{ field: 'person', before: added.id }],
    })
  })
  it('leaves the organization off a trail entry for somebody who belongs to none', async () => {
    const ctx = await bench({ people: OPERATOR, bindings: [] })
    const platform = standing('platform-administrator')
    const added = await ctx.managedPeople.save({ displayName: 'Cal', role: 'platform-administrator' }, platform)
    const identity = { channel: 'wecom-1', issuer: 'corp', subject: 'cal' }
    await ctx.managedPeople.bind({ ...identity, person: added.id }, platform)
    await ctx.managedPeople.unbind(identity, platform)
    await ctx.managedPeople.bind({ ...identity, person: added.id }, platform)
    await ctx.managedPeople.remove(added.id, platform)

    // Nobody's organization, so only a platform standing reads these at all.
    const trail = await ctx.adminAudit.read({}, platform)
    expect(trail.map(entry => [entry.kind, entry.action])).toEqual([
      ['person', 'removed'], ['binding', 'removed'], ['binding', 'added'],
      ['binding', 'removed'], ['binding', 'added'], ['person', 'added'],
    ])
    expect(trail.every(entry => entry.organization === undefined)).toBe(true)
  })

  it('records nothing for a save that altered no field', async () => {
    const ctx = await bench({ people: OPERATOR, bindings: [] })
    const platform = standing('platform-administrator')
    const added = await ctx.managedPeople.save({ displayName: 'Bea', role: 'member', organization: 'acme' }, platform)
    await ctx.managedPeople.save({ id: added.id, displayName: 'Bea', role: 'member', organization: 'acme' }, platform)

    expect((await ctx.adminAudit.read({ organization: 'acme' }, platform)).map(entry => entry.action))
      .toEqual(['added'])
  })
})

describe('the bindings composition wrote', () => {
  it('admit their identity and cannot be withdrawn here', async () => {
    const written = { channel: 'wecom-1', issuer: 'corp', subject: 'ada', person: 'ada' }
    const ctx = await bench({ people: OPERATOR, bindings: [written] })
    const platform = standing('platform-administrator')

    expect(await ctx.signInAdmission.admit({
      channel: brandString<ChannelId>('wecom-1'), issuer: 'corp', subject: 'ada',
    })).toEqual(ADA)
    expect(await ctx.managedPeople.list(platform)).toMatchObject([
      { id: ADA, bindings: [{ subject: 'ada', written: true }] },
    ])
    await expect(ctx.managedPeople.unbind({ channel: 'wecom-1', issuer: 'corp', subject: 'ada' }, platform))
      .rejects.toMatchObject({ reason: 'written' })
    await expect(ctx.managedPeople.bind({ ...written, person: ADA }, platform))
      .rejects.toMatchObject({ reason: 'written' })
  })

  it('refuse the same identity written twice', () => {
    const written = { channel: 'wecom-1', issuer: 'corp', subject: 'ada', person: 'ada' }
    expect(() => declaredBindings({ bindings: [written, written] })).toThrow(/is bound twice/u)
  })
})

describe('a refusal', () => {
  it('names the rule rather than the words it was refused with', () => {
    // A surface marks one field or disables one row by the reason; deciding
    // that by matching prose would break the moment the prose changed.
    const refusal = new PeopleRefusedError('written', WRITTEN)
    expect(refusal).toBeInstanceOf(Error)
    expect(refusal.name).toBe('PeopleRefusedError')
    expect(refusal.reason).toBe('written')
  })
})
