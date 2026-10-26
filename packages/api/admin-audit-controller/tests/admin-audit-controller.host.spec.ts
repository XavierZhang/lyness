/**
 * What the trail surface answers an administrator and what it refuses: their
 * own organization's history without naming it, every organization's only on
 * a platform standing, another organization's never, and a call on no
 * standing rather than a read on nobody's authority.
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
import AdminAuditController, { organizationOf } from '../src/index.ts'

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
  options: { trail?: boolean; maxValueLength?: number } = {},
): Promise<{ controller: AdminAuditController; ctx: Context }> {
  root ??= await mkdtemp(join(tmpdir(), 'lyn-audit-controller-'))
  const ctx = new Context()
  live.push(ctx)
  ctx.provide('requestPrincipal', {
    current: () => by === 'none' ? undefined : { person: by.person, acting: { person: by.person, membership: by.id } },
  })
  await ctx.plugin(Storage)
  await ctx.plugin(StorageJson, { root: join(root, 'state') })
  await ctx.plugin(StorageDomain, { backend: 'json' })
  if (options.trail !== false) {
    await ctx.plugin(
      AdminAudit,
      options.maxValueLength === undefined ? {} : { maxValueLength: options.maxValueLength },
    ).await()
  }
  await ctx.plugin(ManagedPeople).await()
  // The caller is the operator's own written person, which is also where the
  // standing a call acts in is read back from.
  await ctx.plugin(ManagedPeopleDirectory, {
    people: [{
      id: 'ada',
      displayName: 'Ada',
      role: by === 'none' ? 'platform-administrator' : by.role,
      ...by === 'none' || by.organization === undefined ? {} : { organization: by.organization },
    }],
  }).await()
  await ctx.plugin(AdminAuditController)
  return { controller: ctx.adminAuditController, ctx }
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

/** One recorded change in each of two organizations, plus one in neither. */
async function seed(ctx: Context, by: Membership): Promise<void> {
  for (const [subject, organization] of [['a', 'acme'], ['b', 'other'], ['c', undefined]] as const) {
    await ctx.adminAudit.record({
      kind: 'bot',
      subject,
      subjectName: subject.toUpperCase(),
      action: 'added',
      ...organization === undefined ? {} : { organization },
      changes: [{ field: 'displayName', after: subject.toUpperCase() }],
    }, by)
  }
}

describe('an administrator reading the trail of what they administer', () => {
  it('reads their own organization\'s history without naming it', async () => {
    const acme = standing('tenant-administrator', 'acme')
    const { controller, ctx } = await harness(acme)
    await seed(ctx, acme)

    const read = await controller.read({})

    expect(read.map(entry => entry.subject)).toEqual(['a'])
    expect(read[0]).toMatchObject({
      by: 'ada',
      standing: 'ada:tenant-administrator',
      kind: 'bot',
      subjectName: 'A',
      action: 'added',
      organization: 'acme',
      changes: [{ field: 'displayName', after: 'A' }],
    })
  })

  it('reads one record\'s history alone, and a page no larger than asked for', async () => {
    const acme = standing('tenant-administrator', 'acme')
    const { controller, ctx } = await harness(acme)
    for (const action of ['added', 'changed', 'removed'] as const) {
      await ctx.adminAudit.record({
        kind: 'bot', subject: 'triage', subjectName: 'Triage', action, organization: 'acme', changes: [],
      }, acme)
    }

    expect((await controller.read({ subject: 'triage' })).map(entry => entry.action))
      .toEqual(['removed', 'changed', 'added'])
    expect(await controller.read({ subject: 'triage', limit: 1 })).toHaveLength(1)
  })

  it('reads every organization\'s on a platform standing, including records that belong to none', async () => {
    const platform = standing('platform-administrator')
    const { controller, ctx } = await harness(platform)
    await seed(ctx, platform)

    expect((await controller.read({})).map(entry => entry.subject)).toEqual(['c', 'b', 'a'])
    // Naming one narrows that same read.
    expect((await controller.read({ organization: 'other' })).map(entry => entry.subject)).toEqual(['b'])
  })
})

describe('what the surface refuses', () => {
  it('refuses another organization\'s trail', async () => {
    const acme = standing('tenant-administrator', 'acme')
    const { controller, ctx } = await harness(acme)
    await seed(ctx, acme)

    // Knowing an organization's name is not permission to read its trail.
    expect(await codeOf(controller.read({ organization: 'other' }))).toBe('audit/not-permitted')
  })

  it('refuses a call that acts in no standing rather than answering it', async () => {
    const { controller } = await harness('none')
    expect(await codeOf(controller.read({}))).toBe('audit/no-standing')
  })

  it('says a deployment that keeps no trail has none to read', async () => {
    const { controller } = await harness(standing('tenant-administrator', 'acme'), { trail: false })
    expect(await codeOf(controller.read({}))).toBe('gateway/internal')
  })
})

describe('what one entry looks like on the wire', () => {
  it('carries a removal\'s value with no replacement, and says a long one was cut', async () => {
    const acme = standing('tenant-administrator', 'acme')
    const { controller, ctx } = await harness(acme)
    await ctx.adminAudit.record({
      kind: 'bot',
      subject: 'triage',
      subjectName: 'Triage',
      action: 'removed',
      organization: 'acme',
      changes: [{ field: 'persona', before: 'You answer in short sentences.' }],
    }, acme)

    expect((await controller.read({}))[0]?.changes)
      .toEqual([{ field: 'persona', before: 'You answer in short sentences.' }])

    const cutting = await harness(acme, { maxValueLength: 4 })
    await cutting.ctx.adminAudit.record({
      kind: 'bot', subject: 'other', subjectName: 'Other', action: 'added', organization: 'acme',
      changes: [{ field: 'persona', after: 'longer than the bound' }],
    }, acme)
    expect((await cutting.controller.read({}))[0]?.changes)
      .toEqual([{ field: 'persona', after: 'long', truncated: true }])
  })
})

describe('a failure that is not a refusal', () => {
  it('reaches the caller as itself rather than as a trail refusal', async () => {
    const ctx = new Context()
    live.push(ctx)
    ctx.provide('requestPrincipal', {
      current: () => ({ person: ADA, acting: { person: ADA, membership: standing('platform-administrator').id } }),
    })
    ctx.provide('people', {
      person: () => Promise.resolve(undefined),
      membership: () => Promise.resolve(standing('platform-administrator')),
      memberships: () => Promise.resolve([]),
    } as never)
    ctx.provide('adminAudit', { read: () => Promise.reject(new Error('storage closed')) } as never)
    await ctx.plugin(AdminAuditController)

    await expect(ctx.adminAuditController.read({})).rejects.toThrow('storage closed')
  })
})

describe('which organization an unnamed read means', () => {
  it('is the standing\'s own, and nothing when the standing holds none', () => {
    expect(organizationOf({}, standing('tenant-administrator', 'acme'))).toBe('acme')
    expect(organizationOf({ organization: 'other' }, standing('tenant-administrator', 'acme'))).toBe('other')
    expect(organizationOf({}, standing('platform-administrator'))).toBeUndefined()
  })
})
