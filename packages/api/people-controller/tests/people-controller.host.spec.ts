/**
 * What the people surface answers an administrator, and what it refuses:
 * a person composition owns, another organization's, a standing the caller
 * does not hold, an identity already admitted, and a call on no standing.
 */

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@lyness/cordis'
import { brandString } from '@lyness/lyn-brand'
import AdminAudit from '@lyness/lyn-admin-audit'
import ManagedPeople from '@lyness/lyn-managed-people'
import ManagedPeopleDirectory from '@lyness/lyn-managed-people/directory'
import type { Membership, MembershipId, PersonId, Role } from '@lyness/lyn-people'
import Storage from '@lyness/lyn-storage'
import * as StorageJson from '@lyness/lyn-storage-json'
import * as StorageDomain from '@lyness/lyn-storage-domain'
import { RemoteError } from '@lyness/lyn-typert-protocol'
import PeopleController from '../src/index.ts'

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
  options: { directory?: boolean; fails?: string; bot?: { id: string; organization: string } } = {},
): Promise<PeopleController> {
  root ??= await mkdtemp(join(tmpdir(), 'lyn-people-controller-'))
  const ctx = new Context()
  live.push(ctx)
  ctx.provide('requestPrincipal', {
    current: () => by === 'none' ? undefined : { person: by.person, acting: { person: by.person, membership: by.id } },
  })
  if (options.fails !== undefined) {
    const failure = options.fails
    ctx.provide('managedPeople', { save: () => Promise.reject(new Error(failure)) } as never)
    ctx.provide('people', {
      person: () => Promise.resolve(undefined),
      membership: (id: MembershipId) => Promise.resolve(by === 'none' || id !== by.id ? undefined : by),
      memberships: () => Promise.resolve([]),
    } as never)
    await ctx.plugin(PeopleController)
    return ctx.peopleController
  }
  if (options.directory !== false) {
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
    if (options.bot !== undefined) {
      const bot = options.bot
      // What the bot roster registers, without standing one up: an entry the
      // directory answers and the admission table must refuse.
      ctx.effect(() => ctx.managedPeople.declarePerson({
        person: { id: brandString<PersonId>(bot.id), displayName: 'Triage' },
        membership: {
          id: brandString<MembershipId>(`${bot.id}:standing`),
          person: brandString<PersonId>(bot.id),
          organization: bot.organization,
          role: 'member',
        },
        kind: 'bot',
      }))
    }
  }
  await ctx.plugin(PeopleController)
  return ctx.peopleController
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

describe('an administrator maintaining who may use the deployment', () => {
  it('adds a person and reads them back with the identities admitted as them', async () => {
    const controller = await harness(standing('platform-administrator'))
    const added = await controller.save({ displayName: 'Bea', role: 'member', organization: 'acme' })
    expect(added).toMatchObject({ displayName: 'Bea', role: 'member', organization: 'acme', written: false })

    await controller.bind({ channel: 'wecom-1', issuer: 'corp', subject: 'bea', person: added.id })
    expect(await controller.list()).toContainEqual(expect.objectContaining({
      id: added.id,
      bindings: [{ channel: 'wecom-1', issuer: 'corp', subject: 'bea', written: false }],
    }))

    await controller.unbind({ channel: 'wecom-1', issuer: 'corp', subject: 'bea' })
    await controller.remove(added.id)
    expect(await controller.list()).toEqual([
      expect.objectContaining({ id: 'ada', written: true, role: 'platform-administrator' }),
    ])
  })

  it('is refused a person the installation\'s configuration owns', async () => {
    const controller = await harness(standing('platform-administrator'))
    expect(await codeOf(controller.save({ id: 'ada', displayName: 'Renamed', role: 'member' })))
      .toBe('people/written')
    expect(await codeOf(controller.remove('ada'))).toBe('people/written')
  })

  it('is refused a standing it does not hold, and a tenant administrator without an organization', async () => {
    const tenant = await harness(standing('tenant-administrator', 'acme'))
    expect(await codeOf(tenant.save({ displayName: 'Mallory', role: 'platform-administrator' })))
      .toBe('people/not-permitted')
    const platform = await harness(standing('platform-administrator'))
    expect(await codeOf(platform.save({ displayName: 'Mallory', role: 'tenant-administrator' })))
      .toBe('people/incomplete')
  })

  it('leaves the deployment\'s bots out, and refuses to admit an identity as one', async () => {
    const controller = await harness(standing('platform-administrator'), { bot: { id: 'triage', organization: 'acme' } })

    // This surface is who signs in. A bot owns conversations and signs in
    // nowhere, so listing it would be a row nothing here can act on.
    expect((await controller.list()).map(person => person.id)).toEqual(['ada'])
    expect(await codeOf(controller.bind({ channel: 'wecom-1', issuer: 'corp', subject: 'bea', person: 'triage' })))
      .toBe('people/not-a-person')
  })

  it('is refused an identity nobody holds, and one already admitted', async () => {
    const controller = await harness(standing('platform-administrator'))
    const added = await controller.save({ displayName: 'Bea', role: 'member', organization: 'acme' })
    const identity = { channel: 'wecom-1', issuer: 'corp', subject: 'bea' }
    await controller.bind({ ...identity, person: added.id })

    expect(await codeOf(controller.bind({ ...identity, person: added.id }))).toBe('people/already-bound')
    expect(await codeOf(controller.bind({ ...identity, subject: 'ghost', person: 'nobody' })))
      .toBe('people/unknown-person')
  })

  it('is refused another organization\'s person', async () => {
    const platform = await harness(standing('platform-administrator'))
    const theirs = await platform.save({ displayName: 'Bea', role: 'member', organization: 'acme' })
    const identity = { channel: 'wecom-1', issuer: 'corp', subject: 'bea' }
    await platform.bind({ ...identity, person: theirs.id })
    const other = await harness(standing('tenant-administrator', 'other'))

    // Their own written standing is theirs to see; the acme person is not.
    expect(await other.list()).toEqual([expect.objectContaining({ id: 'ada', written: true })])
    expect(await codeOf(other.remove(theirs.id))).toBe('people/not-permitted')
    // Refused on the standing before the identity is looked at, so this
    // administrator does not learn that it is taken either.
    expect(await codeOf(other.bind({ ...identity, person: theirs.id }))).toBe('people/not-permitted')
    expect(await codeOf(other.unbind(identity))).toBe('people/not-permitted')
  })
})

describe('a call the deployment cannot answer', () => {
  it('on no standing changes nothing, whichever verb it names', async () => {
    const controller = await harness('none')
    // Where a deployment mounts an authorization rule this is unreachable;
    // where it mounts none, every call arrives here.
    expect(await codeOf(controller.list())).toBe('people/no-standing')
    expect(await codeOf(controller.save({ displayName: 'Bea', role: 'member' }))).toBe('people/no-standing')
    expect(await codeOf(controller.remove('x'))).toBe('people/no-standing')
    expect(await codeOf(controller.bind({ channel: 'c', issuer: 'i', subject: 's', person: 'p' })))
      .toBe('people/no-standing')
    expect(await codeOf(controller.unbind({ channel: 'c', issuer: 'i', subject: 's' }))).toBe('people/no-standing')
  })

  it('failing for a reason that is not a refusal answers as itself', async () => {
    const controller = await harness(standing('platform-administrator'), { fails: 'the store is gone' })
    // Only the directory's own refusals have wire codes; anything else is
    // the carrier's to report, not a change an administrator can correct.
    await expect(controller.save({ displayName: 'Bea', role: 'member' })).rejects.toThrow('the store is gone')
    expect(await codeOf(controller.save({ displayName: 'Bea', role: 'member' }))).toBeUndefined()
  })

  it('maintaining no directory answers that it has none', async () => {
    const controller = await harness(standing('platform-administrator'), { directory: false })
    expect(await codeOf(controller.list())).toBe('gateway/internal')
  })
})
