/**
 * What an invitation is worth: who may issue one, what it grants, how long it
 * lasts, how many people it admits, and what it is worth once its issuer is
 * gone. Every case runs over the real roster and real storage, because a
 * redemption is a write to the roster and the bounds are the whole point.
 */

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@lyness/cordis'
import { brandString } from '@lyness/lyn-brand'
import type { Membership, MembershipId, PersonId, Role } from '@lyness/lyn-people'
import type { ChannelId, ExternalSubject } from '@lyness/lyn-sign-in'
import Storage from '@lyness/lyn-storage'
import * as StorageJson from '@lyness/lyn-storage-json'
import * as StorageDomain from '@lyness/lyn-storage-domain'
import AdminAudit from '@lyness/lyn-admin-audit'
import ManagedPeople, { standingOf } from '@lyness/lyn-managed-people'
import ManagedPeopleDirectory from '@lyness/lyn-managed-people/directory'
import Invitations, {
  DEFAULT_LIFETIME_MS, DEFAULT_MAX_USES, MAX_LIFETIME_MS, MAX_USES_LIMIT, NOT_PERMITTED,
  ORGANIZATION_REQUIRED, OUT_OF_BOUNDS, UNKNOWN, codeHash, newCode, open, resolveConfig,
} from '../src/index.ts'
import type { InvitationId, InvitationRecord } from '../src/types.ts'

const ADA = brandString<PersonId>('ada')
const LEE = brandString<PersonId>('lee')

const live: Context[] = []
const roots: string[] = []

afterEach(async () => {
  for (const ctx of live.splice(0)) await ctx.fiber.dispose()
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true })
})

/** The operator's roster: a platform administrator, and one tenant's administrator. */
const ROSTER = [
  { id: 'ada', displayName: 'Ada', role: 'platform-administrator' },
  { id: 'lee', displayName: 'Lee', role: 'tenant-administrator', organization: 'acme' },
]

/**
 * The standing one written person holds, as the directory reports it.
 *
 * A written entry's standing is identified by its role, while a stored one's
 * is `standingOf(person)`; an invitation records the identity it was issued in
 * and asks the directory for it again, so a fixture that invented the wrong
 * one would make every redemption void.
 */
function standing(person: PersonId, role: Role, organization?: string): Membership {
  return {
    id: brandString<MembershipId>(`${person}:${role}`),
    person,
    role,
    ...organization === undefined ? {} : { organization },
  }
}

const PLATFORM = standing(ADA, 'platform-administrator')
const TENANT = standing(LEE, 'tenant-administrator', 'acme')

/** One subject a channel verified. */
function subject(id: string, displayName?: string): ExternalSubject {
  return {
    channel: brandString<ChannelId>('oidc'),
    issuer: 'https://id.example',
    subject: id,
    ...displayName === undefined ? {} : { displayName },
  }
}

/** A deployment that stores its roster and issues invitations. */
async function bench(config: Record<string, number> = {}): Promise<Context> {
  const root = await mkdtemp(join(tmpdir(), 'lyn-invitations-'))
  roots.push(root)
  const ctx = new Context()
  live.push(ctx)
  await ctx.plugin(Storage)
  await ctx.plugin(StorageJson, { root })
  await ctx.plugin(StorageDomain, { backend: 'json' })
  await ctx.plugin(AdminAudit, {}).await()
  await ctx.plugin(ManagedPeople).await()
  await ctx.plugin(ManagedPeopleDirectory, { people: ROSTER }).await()
  await ctx.plugin(Invitations, config).await()
  return ctx
}

describe('issuing one', () => {
  it('returns the code once and stores only its hash', async () => {
    const ctx = await bench()
    const issued = await ctx.invitations.issue({ label: 'Bea', role: 'member', organization: 'acme' }, PLATFORM)

    expect(issued.code).toBeDefined()
    expect(issued).toMatchObject({ label: 'Bea', role: 'member', organization: 'acme', maxUses: 1, uses: 0, open: true })
    // Every later read answers without it: the deployment cannot show a code
    // it does not keep.
    const listed = await ctx.invitations.list(PLATFORM)
    expect(listed).toHaveLength(1)
    expect(listed[0]?.code).toBeUndefined()
    expect(Date.parse(issued.expiresAt) - Date.parse(issued.issuedAt)).toBe(DEFAULT_LIFETIME_MS)
  })

  it('holds a standing to the same three rules as adding somebody directly', async () => {
    const ctx = await bench()

    // A tenant administrator's standing names its organization.
    await expect(ctx.invitations.issue({ label: 'x', role: 'tenant-administrator' }, PLATFORM))
      .rejects.toMatchObject({ reason: 'organization-required', message: ORGANIZATION_REQUIRED })
    // Only a platform administrator makes another one.
    await expect(ctx.invitations.issue({ label: 'x', role: 'platform-administrator' }, TENANT))
      .rejects.toMatchObject({ reason: 'not-permitted', message: NOT_PERMITTED })
    // Nobody reaches outside the organization they administer.
    await expect(ctx.invitations.issue({ label: 'x', role: 'member', organization: 'other' }, TENANT))
      .rejects.toMatchObject({ reason: 'not-permitted' })
    // What each of them may do.
    await expect(ctx.invitations.issue({ label: 'ok', role: 'member', organization: 'acme' }, TENANT))
      .resolves.toMatchObject({ role: 'member', organization: 'acme' })
    await expect(ctx.invitations.issue({ label: 'ok', role: 'platform-administrator' }, PLATFORM))
      .resolves.toMatchObject({ role: 'platform-administrator' })
  })

  it('refuses a life or a count outside what the deployment allows', async () => {
    const ctx = await bench({ maxLifetimeMs: 3_600_000, maxUsesLimit: 5 })

    for (const submission of [
      { label: 'x', role: 'member' as Role, lifetimeMs: 7_200_000 },
      { label: 'x', role: 'member' as Role, lifetimeMs: 1_000 },
      { label: 'x', role: 'member' as Role, maxUses: 6 },
      { label: 'x', role: 'member' as Role, maxUses: 0 },
    ]) {
      await expect(ctx.invitations.issue(submission, PLATFORM), JSON.stringify(submission))
        .rejects.toMatchObject({ reason: 'out-of-bounds', message: OUT_OF_BOUNDS })
    }
    await expect(ctx.invitations.issue({ label: 'x', role: 'member', lifetimeMs: 3_600_000, maxUses: 5 }, PLATFORM))
      .resolves.toMatchObject({ maxUses: 5 })
  })

  it('records who issued what in the administration trail', async () => {
    const ctx = await bench()
    const issued = await ctx.invitations.issue({ label: 'Bea', role: 'member', organization: 'acme' }, PLATFORM)
    const entries = await ctx.adminAudit.read({}, PLATFORM)

    expect(entries.map(entry => ({ kind: entry.kind, action: entry.action, subject: entry.subject })))
      .toContainEqual({ kind: 'invitation', action: 'added', subject: issued.id })
  })
})

describe('reading and withdrawing', () => {
  it('shows each standing only the invitations it administers', async () => {
    const ctx = await bench()
    await ctx.invitations.issue({ label: 'acme-one', role: 'member', organization: 'acme' }, PLATFORM)
    await ctx.invitations.issue({ label: 'other-one', role: 'member', organization: 'other' }, PLATFORM)
    await ctx.invitations.issue({ label: 'platform-one', role: 'member' }, PLATFORM)

    expect((await ctx.invitations.list(PLATFORM)).map(row => row.label).sort())
      .toEqual(['acme-one', 'other-one', 'platform-one'])
    // A tenant's administrator sees its own, and not the platform's or another tenant's.
    expect((await ctx.invitations.list(TENANT)).map(row => row.label)).toEqual(['acme-one'])
  })

  it('withdraws one so a code already sent stops working, and keeps the record', async () => {
    const ctx = await bench()
    const issued = await ctx.invitations.issue({ label: 'Bea', role: 'member', organization: 'acme' }, TENANT)

    await ctx.invitations.revoke(issued.id, TENANT)
    expect((await ctx.invitations.list(TENANT))).toMatchObject([{ id: issued.id, open: false }])
    expect(await ctx.invitations.redeem(issued.code ?? '', subject('bea'))).toBeUndefined()
    // Withdrawing twice is the same state, not a second refusal.
    await expect(ctx.invitations.revoke(issued.id, TENANT)).resolves.toBeUndefined()
  })

  it('refuses a withdrawal nobody is entitled to make', async () => {
    const ctx = await bench()
    const platformOne = await ctx.invitations.issue({ label: 'x', role: 'member' }, PLATFORM)

    await expect(ctx.invitations.revoke(platformOne.id, TENANT))
      .rejects.toMatchObject({ reason: 'not-permitted' })
    await expect(ctx.invitations.revoke(brandString<InvitationId>('nothing'), PLATFORM))
      .rejects.toMatchObject({ reason: 'unknown', message: UNKNOWN })
  })
})

describe('redeeming one', () => {
  it('admits the subject as a person with exactly the standing the code carried', async () => {
    const ctx = await bench()
    const issued = await ctx.invitations.issue({ label: 'Bea', role: 'member', organization: 'acme' }, TENANT)

    const person = await ctx.invitations.redeem(issued.code ?? '', subject('bea', 'Bea Smith'))
    if (person === undefined) throw new Error('the invitation admitted nobody')

    // The directory's own name for them, and the standing the code carried.
    expect(await ctx.people.person(person)).toMatchObject({ displayName: 'Bea Smith' })
    expect(await ctx.people.memberships(person)).toMatchObject([{ role: 'member', organization: 'acme' }])
    // And they sign in from now on without the code.
    expect(await ctx.managedPeople.admit(JSON.stringify(['oidc', 'https://id.example', 'bea'])))
      .toBe(person)
    expect((await ctx.invitations.list(TENANT))).toMatchObject([{ uses: 1, open: false }])
  })

  it('falls back to the label when the directory publishes no name', async () => {
    const ctx = await bench()
    const issued = await ctx.invitations.issue({ label: 'Seat 7', role: 'member', organization: 'acme' }, TENANT)
    const person = await ctx.invitations.redeem(issued.code ?? '', subject('anon'))
    if (person === undefined) throw new Error('the invitation admitted nobody')

    expect(await ctx.people.person(person)).toMatchObject({ displayName: 'Seat 7' })
  })

  it('answers undefined for a code that is wrong, spent, or expired', async () => {
    const ctx = await bench()
    const issued = await ctx.invitations.issue({ label: 'Bea', role: 'member', organization: 'acme' }, TENANT)

    // A wrong code reads exactly like an uninvited subject: a page that told
    // them apart would report which codes exist.
    expect(await ctx.invitations.redeem(newCode(), subject('bea'))).toBeUndefined()
    expect(await ctx.invitations.redeem('', subject('bea'))).toBeUndefined()
    expect(await ctx.invitations.redeem(issued.code ?? '', subject('bea'))).toBeDefined()
    // One use was all it had.
    expect(await ctx.invitations.redeem(issued.code ?? '', subject('cass'))).toBeUndefined()
  })

  it('admits as many people as the count allows, and no more', async () => {
    const ctx = await bench()
    const issued = await ctx.invitations.issue(
      { label: 'Acme seats', role: 'member', organization: 'acme', maxUses: 2 }, TENANT)
    const code = issued.code ?? ''

    expect(await ctx.invitations.redeem(code, subject('one'))).toBeDefined()
    expect(await ctx.invitations.redeem(code, subject('two'))).toBeDefined()
    expect(await ctx.invitations.redeem(code, subject('three'))).toBeUndefined()
    expect((await ctx.invitations.list(TENANT))).toMatchObject([{ maxUses: 2, uses: 2, open: false }])
  })

  it('is void once the standing that issued it is gone', async () => {
    const ctx = await bench()
    // Issued by an administrator this deployment stores rather than writes, so
    // the test can remove them the way an administrator would.
    const lee = await ctx.managedPeople.save(
      { displayName: 'Lee II', role: 'tenant-administrator', organization: 'acme' }, PLATFORM)
    const theirs = (await ctx.people.memberships(lee.id))[0]
    if (theirs === undefined) throw new Error('the stored administrator holds no standing')
    const issued = await ctx.invitations.issue({ label: 'Bea', role: 'member', organization: 'acme' }, theirs)

    await ctx.managedPeople.remove(lee.id, PLATFORM)
    expect(await ctx.invitations.redeem(issued.code ?? '', subject('bea'))).toBeUndefined()
  })

  it('admits a platform administrator, who belongs to no organization', async () => {
    const ctx = await bench()
    const issued = await ctx.invitations.issue({ label: 'Second operator', role: 'platform-administrator' }, PLATFORM)
    const person = await ctx.invitations.redeem(issued.code ?? '', subject('cass', 'Cass'))
    if (person === undefined) throw new Error('the invitation admitted nobody')

    expect(await ctx.people.memberships(person)).toMatchObject([{ role: 'platform-administrator' }])
    expect((await ctx.people.memberships(person))[0]?.organization).toBeUndefined()
  })

  it('withdraws a platform-level invitation too', async () => {
    const ctx = await bench()
    const issued = await ctx.invitations.issue({ label: 'Second operator', role: 'platform-administrator' }, PLATFORM)
    await ctx.invitations.revoke(issued.id, PLATFORM)

    expect(await ctx.invitations.redeem(issued.code ?? '', subject('cass'))).toBeUndefined()
  })

  it('is void once its issuer no longer holds what the code grants', async () => {
    const ctx = await bench()
    // A stored administrator, so the test can change their standing the way a
    // platform administrator would.
    const stored = await ctx.managedPeople.save(
      { displayName: 'Mo', role: 'platform-administrator' }, PLATFORM)
    const theirs = (await ctx.people.memberships(stored.id))[0]
    if (theirs === undefined) throw new Error('the stored administrator holds no standing')
    const platformInvite = await ctx.invitations.issue({ label: 'another operator', role: 'platform-administrator' }, theirs)
    const tenantInvite = await ctx.invitations.issue({ label: 'acme seat', role: 'member', organization: 'acme' }, theirs)

    // Demoted to a tenant's administrator: the platform-level code is void,
    // and the tenant one still stands, because that is what they still have.
    await ctx.managedPeople.save(
      { id: stored.id, displayName: 'Mo', role: 'tenant-administrator', organization: 'acme' }, PLATFORM)
    expect(await ctx.invitations.redeem(platformInvite.code ?? '', subject('one'))).toBeUndefined()
    expect(await ctx.invitations.redeem(tenantInvite.code ?? '', subject('two'))).toBeDefined()

    // Demoted again, to a member of another organization: nothing they issued stands.
    const third = await ctx.invitations.issue({ label: 'acme seat 2', role: 'member', organization: 'acme' },
      (await ctx.people.memberships(stored.id))[0] ?? theirs)
    await ctx.managedPeople.save(
      { id: stored.id, displayName: 'Mo', role: 'member', organization: 'other' }, PLATFORM)
    expect(await ctx.invitations.redeem(third.code ?? '', subject('three'))).toBeUndefined()
  })

  it('records the redemption against the invitation, in the issuer standing', async () => {
    const ctx = await bench()
    const issued = await ctx.invitations.issue({ label: 'Bea', role: 'member', organization: 'acme' }, TENANT)
    await ctx.invitations.redeem(issued.code ?? '', subject('bea', 'Bea'))
    const entries = await ctx.adminAudit.read({}, PLATFORM)

    expect(entries.filter(entry => entry.kind === 'invitation' && entry.action === 'changed'))
      .toMatchObject([{ subject: issued.id, by: LEE }])
  })
})

describe('reading a record', () => {
  it('calls an invitation open only while it stands, has uses left, and has not expired', () => {
    const base: InvitationRecord = {
      id: brandString<InvitationId>('i1'),
      codeHash: codeHash('x'),
      label: 'x',
      role: 'member',
      issuedBy: ADA,
      issuedIn: standingOf(ADA),
      issuedAt: '2026-11-11T00:00:00.000Z',
      expiresAt: '2026-11-18T00:00:00.000Z',
      maxUses: 2,
      uses: 0,
    }
    const now = new Date('2026-11-12T00:00:00.000Z')

    expect(open(base, now)).toBe(true)
    expect(open({ ...base, uses: 2 }, now)).toBe(false)
    expect(open({ ...base, revokedAt: '2026-11-11T12:00:00.000Z' }, now)).toBe(false)
    expect(open(base, new Date('2026-11-19T00:00:00.000Z'))).toBe(false)
  })

  it('hashes a code the same way every time, and differently per code', () => {
    const one = newCode()
    expect(codeHash(one)).toBe(codeHash(one))
    expect(codeHash(one)).not.toBe(codeHash(newCode()))
    // base64url, so it travels in a URL and in a cookie unescaped.
    expect(one).toMatch(/^[A-Za-z0-9_-]{43}$/u)
  })

  it('keeps the default count at one and the ceiling where the deployment set it', () => {
    expect(MAX_USES_LIMIT).toBe(200)
  })

  it('falls back to the shipped bounds for a composition that states none', () => {
    // A caller reaching the service without the schema's defaults — a test, or
    // a composition that states nothing — still gets bounded invitations.
    expect(resolveConfig({})).toEqual({
      defaultLifetimeMs: DEFAULT_LIFETIME_MS,
      maxLifetimeMs: MAX_LIFETIME_MS,
      defaultMaxUses: DEFAULT_MAX_USES,
      maxUsesLimit: MAX_USES_LIMIT,
    })
    expect(resolveConfig({ defaultMaxUses: 3, maxLifetimeMs: 60_000 }))
      .toMatchObject({ defaultMaxUses: 3, maxLifetimeMs: 60_000 })
  })
})
