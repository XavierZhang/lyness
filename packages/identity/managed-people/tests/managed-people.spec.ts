/**
 * What an administrator may change about who uses a deployment: the people
 * composition wrote and may not be touched here, the ones they add, who may
 * grant which standing, and which directory identity signs in as whom.
 */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
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
  bindingKey, standingOf, standingsOf,
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
  registered?: readonly string[]
  /** A store this deployment inherits, written by the first generation. */
  stored?: Record<string, unknown>
} = {}): Promise<Context> {
  const root = await mkdtemp(join(tmpdir(), 'lyn-managed-people-'))
  roots.push(root)
  if (options.stored !== undefined) {
    // Seeded before the service opens its domain, which is the only way a
    // deployment ever meets a store an older version wrote.
    await mkdir(root, { recursive: true })
    await writeFile(join(root, 'managed_people.json'), JSON.stringify({
      unit: { name: 'managed_people', version: 1 },
      global: null,
      tables: { people: options.stored, bindings: {} },
    }))
  }
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
  if (options.registered !== undefined) {
    const registered = options.registered
    // What composition wrote: channels the sign-in service offers and no
    // standing configured, so the configured-channel store never holds them.
    ctx.provide('signIn', { available: () => registered.map(id => ({ id })) } as never)
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

describe('the standings one person holds', () => {
  it('grants a second standing without disturbing the first', async () => {
    const ctx = await bench({ people: OPERATOR })
    const platform = standing('platform-administrator')
    const added = await ctx.managedPeople.save({ displayName: 'Bea', role: 'member', organization: 'acme' }, platform)
    const [first] = added.standings

    const both = await ctx.managedPeople.grantStanding(
      { person: added.id, role: 'tenant-administrator', organization: 'beta' }, platform)
    expect(both.standings.map(one => [one.role, one.organization])).toEqual([
      ['member', 'acme'],
      ['tenant-administrator', 'beta'],
    ])
    // The first standing keeps its identity, so a session signed in under it
    // still names a standing they hold.
    expect(both.standings[0]?.id).toBe(first?.id)
    expect((await ctx.people.memberships(added.id)).map(one => one.id))
      .toEqual(both.standings.map(one => one.id))
    for (const held of both.standings) {
      expect(await ctx.people.membership(held.id)).toMatchObject({ person: added.id, role: held.role })
    }
  })

  it('refuses a standing they already hold, and one nobody holds', async () => {
    const ctx = await bench({ people: OPERATOR })
    const platform = standing('platform-administrator')
    const added = await ctx.managedPeople.save({ displayName: 'Bea', role: 'member', organization: 'acme' }, platform)

    await expect(ctx.managedPeople.grantStanding({ person: added.id, role: 'member', organization: 'acme' }, platform))
      .rejects.toMatchObject({ reason: 'already-held' })
    await expect(ctx.managedPeople.grantStanding(
      { person: brandString<PersonId>('nobody'), role: 'member', organization: 'acme' }, platform,
    )).rejects.toMatchObject({ reason: 'unknown-person' })
    await expect(ctx.managedPeople.revokeStanding(brandString<MembershipId>('nothing'), platform))
      .rejects.toMatchObject({ reason: 'unknown-standing' })
  })

  it('revokes one and refuses the last', async () => {
    const ctx = await bench({ people: OPERATOR })
    const platform = standing('platform-administrator')
    const added = await ctx.managedPeople.save({ displayName: 'Bea', role: 'member', organization: 'acme' }, platform)
    const both = await ctx.managedPeople.grantStanding(
      { person: added.id, role: 'tenant-administrator', organization: 'beta' }, platform)
    const [, second] = both.standings
    if (second === undefined) throw new Error('the grant wrote no second standing')

    await ctx.managedPeople.revokeStanding(second.id, platform)
    expect(await ctx.people.memberships(added.id)).toHaveLength(1)
    expect(await ctx.people.membership(second.id)).toBeUndefined()

    // A person holding none could act in no context at all, so the last one
    // is refused and removing the person is the operation that says so.
    const [only] = (await ctx.managedPeople.list(platform)).find(view => view.id === added.id)?.standings ?? []
    if (only === undefined) throw new Error('the person holds no standing')
    await expect(ctx.managedPeople.revokeStanding(only.id, platform))
      .rejects.toMatchObject({ reason: 'last-standing' })
  })

  it('keeps a person who belongs elsewhere out of one tenant administrator\'s reach', async () => {
    const ctx = await bench({ people: OPERATOR })
    const platform = standing('platform-administrator')
    const acme = standing('tenant-administrator', 'acme')
    const added = await ctx.managedPeople.save({ displayName: 'Bea', role: 'member', organization: 'acme' }, platform)
    const both = await ctx.managedPeople.grantStanding(
      { person: added.id, role: 'member', organization: 'beta' }, platform)
    const [, beta] = both.standings
    if (beta === undefined) throw new Error('the grant wrote no second standing')

    // Acme's administrator sees them, because one of their standings is in
    // acme — but only that standing, and they may neither rename nor delete
    // somebody who also belongs to beta.
    const listed = (await ctx.managedPeople.list(acme)).find(view => view.id === added.id)
    expect(listed?.standings.map(one => one.organization)).toEqual(['acme'])
    await expect(ctx.managedPeople.save({ id: added.id, displayName: 'Renamed', role: 'member', organization: 'acme' }, acme))
      .rejects.toMatchObject({ reason: 'not-permitted' })
    await expect(ctx.managedPeople.remove(added.id, acme)).rejects.toMatchObject({ reason: 'not-permitted' })
    await expect(ctx.managedPeople.revokeStanding(beta.id, acme)).rejects.toMatchObject({ reason: 'not-permitted' })
    // And an identity bound to them would sign in as somebody who acts for
    // beta too, so that is refused as well.
    await expect(ctx.managedPeople.bind(
      { channel: 'acme-wecom', issuer: 'corp', subject: 'bea', person: added.id }, acme,
    )).rejects.toMatchObject({ reason: 'not-permitted' })
  })

  it('grants a platform standing, which names no organization, and takes it back', async () => {
    const ctx = await bench({ people: OPERATOR, bindings: [] })
    const platform = standing('platform-administrator')
    const added = await ctx.managedPeople.save({ displayName: 'Bea', role: 'member', organization: 'acme' }, platform)
    await ctx.managedPeople.bind({ channel: 'wecom-1', issuer: 'corp', subject: 'bea', person: added.id }, platform)

    const both = await ctx.managedPeople.grantStanding({ person: added.id, role: 'platform-administrator' }, platform)
    // A platform standing belongs to the platform rather than to any
    // organization, and the person keeps the identity that signs in as them.
    expect(both.standings.map(one => one.organization)).toEqual(['acme', undefined])
    expect(both.bindings).toEqual([{ channel: 'wecom-1', issuer: 'corp', subject: 'bea', written: false }])

    const [, granted] = both.standings
    if (granted === undefined) throw new Error('the grant wrote no second standing')
    await ctx.managedPeople.revokeStanding(granted.id, platform)
    expect((await ctx.people.memberships(added.id)).map(one => one.organization)).toEqual(['acme'])
    // Filed under the platform rather than under acme, which is whose
    // authority granted and took it back.
    const trail = await ctx.adminAudit.read({}, platform)
    expect(trail.slice(0, 2).map(entry => [entry.kind, entry.action, entry.organization]))
      .toEqual([['person', 'changed', undefined], ['person', 'changed', undefined]])
  })

  it('refuses to grant a standing to a person composition owns', async () => {
    const ctx = await bench({ people: OPERATOR })
    await expect(ctx.managedPeople.grantStanding(
      { person: ADA, role: 'member', organization: 'acme' }, standing('platform-administrator'),
    )).rejects.toMatchObject({ reason: 'written' })
  })
})

describe('a roster the first generation stored', () => {
  it('reads one role as one standing, under the identity that generation derived', async () => {
    const legacy = brandString<PersonId>('stored-before')
    // What version 1 wrote: one role per person, no list, and the unit
    // stamped with the version it was saved under.
    const ctx = await bench({
      people: OPERATOR,
      stored: {
        [legacy]: {
          id: legacy,
          displayName: 'Cai',
          role: 'member',
          organization: 'acme',
          addedAt: '2026-01-01T00:00:00.000Z',
          addedBy: ADA,
        },
      },
    })
    const platform = standing('platform-administrator')

    const held = await ctx.people.memberships(legacy)
    expect(held).toEqual([{ id: standingOf(legacy), person: legacy, role: 'member', organization: 'acme' }])
    // A session signed in then names this identity, so it has to resolve.
    expect(await ctx.people.membership(standingOf(legacy))).toMatchObject({ person: legacy })
    expect((await ctx.managedPeople.list(platform)).find(view => view.id === legacy)?.standings)
      .toEqual([{ id: standingOf(legacy), role: 'member', organization: 'acme' }])

    // The next write of that record replaces the one role with a list, and
    // the standing keeps the identity it already had.
    const both = await ctx.managedPeople.grantStanding(
      { person: legacy, role: 'member', organization: 'beta' }, platform)
    expect(both.standings.map(one => [one.id, one.organization]))
      .toEqual([[standingOf(legacy), 'acme'], [both.standings[1]?.id, 'beta']])
    expect(await ctx.people.memberships(legacy)).toHaveLength(2)
  })

  it('folds a record of either generation the same way', () => {
    const id = brandString<PersonId>('cai')
    const legacy = standingsOf({
      id, displayName: 'Cai', role: 'member', organization: 'acme',
      addedAt: '2026-01-01T00:00:00.000Z', addedBy: ADA,
    })
    expect(legacy).toEqual([{
      id: standingOf(id), role: 'member', organization: 'acme',
      addedAt: '2026-01-01T00:00:00.000Z', addedBy: ADA,
    }])
    // A platform administrator of that generation named no organization.
    expect(standingsOf({
      id, displayName: 'Cai', role: 'platform-administrator',
      addedAt: '2026-01-01T00:00:00.000Z', addedBy: ADA,
    })).toEqual([{
      id: standingOf(id), role: 'platform-administrator',
      addedAt: '2026-01-01T00:00:00.000Z', addedBy: ADA,
    }])
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

  it('are bound on a channel composition wrote, which no store can hold', async () => {
    const ctx = await bench({ people: OPERATOR, channels: ['acme-wecom'], registered: ['oidc'] })
    const platform = standing('platform-administrator')
    const added = await ctx.managedPeople.save({ displayName: 'Bea', role: 'member', organization: 'acme' }, platform)

    // The installation's own files name this channel, so nobody configured it
    // and nobody can change it; refusing it would make the roster unusable on
    // the one channel a deployment bootstraps with.
    await expect(ctx.managedPeople.bind(
      { channel: 'oidc', issuer: 'https://id.acme.example', subject: 'bea-sub', person: added.id },
      platform,
    )).resolves.toMatchObject({ channel: 'oidc', written: false })

    // A channel neither half knows is still refused.
    await expect(ctx.managedPeople.bind(
      { channel: 'nowhere', issuer: 'corp', subject: 'bea', person: added.id },
      platform,
    )).rejects.toMatchObject({ reason: 'not-permitted' })
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
    // Every standing in one field: a trail naming one of two would record
    // half the change.
    expect(trail[1]?.changes).toEqual([
      { field: 'standings', before: 'member@acme', after: 'tenant-administrator@acme' },
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
