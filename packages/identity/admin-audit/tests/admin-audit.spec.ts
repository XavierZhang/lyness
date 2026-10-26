/**
 * What the trail keeps and who may read it: an append-only history that
 * records the value a change replaced, cut to the length a deployment keeps,
 * and answered only to a standing that administers the organization asked
 * about.
 */

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@lyness/cordis'
import { brandString } from '@lyness/lyn-brand'
import type { Membership, MembershipId, PersonId } from '@lyness/lyn-people'
import Storage from '@lyness/lyn-storage'
import * as StorageJson from '@lyness/lyn-storage-json'
import * as StorageDomain from '@lyness/lyn-storage-domain'
import AdminAudit, {
  AuditRefusedError, DEFAULT_MAX_ENTRIES, DEFAULT_MAX_VALUE_LENGTH, NOT_PERMITTED,
  fieldChanges, resolveConfig,
} from '../src/index.ts'
import { entrySchema } from '../src/storage.ts'

const live: Context[] = []
const roots: string[] = []

afterEach(async () => {
  for (const ctx of live.splice(0)) await ctx.fiber.dispose()
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true })
})

/** A standing in one organization, or on the platform. */
function standing(person: string, role: Membership['role'], organization?: string): Membership {
  return {
    id: brandString<MembershipId>(`${person}:${role}`),
    person: brandString<PersonId>(person),
    role,
    ...organization === undefined ? {} : { organization },
  }
}

const PLATFORM = standing('ada', 'platform-administrator')
const ACME = standing('bea', 'tenant-administrator', 'acme')
const OTHER = standing('cal', 'tenant-administrator', 'other')
const MEMBER = standing('dee', 'member', 'acme')

/** A deployment keeping a trail, with the bounds a test asks for. */
async function bench(config: { maxValueLength?: number; maxEntries?: number } = {}): Promise<Context> {
  const root = await mkdtemp(join(tmpdir(), 'lyn-admin-audit-'))
  roots.push(root)
  const ctx = new Context()
  live.push(ctx)
  await ctx.plugin(Storage)
  await ctx.plugin(StorageJson, { root })
  await ctx.plugin(StorageDomain, { backend: 'json' })
  await ctx.plugin(AdminAudit, config).await()
  return ctx
}

describe('recording a change', () => {
  it('keeps who made it, the standing they made it in, and the value it replaced', async () => {
    const ctx = await bench()

    const entry = await ctx.adminAudit.record({
      kind: 'bot',
      subject: 'triage',
      subjectName: 'Triage',
      action: 'changed',
      organization: 'acme',
      changes: fieldChanges({ persona: 'Be brief.' }, { persona: 'Be thorough.' }),
    }, ACME)

    expect(entry).toMatchObject({
      by: 'bea',
      standing: 'bea:tenant-administrator',
      kind: 'bot',
      subject: 'triage',
      subjectName: 'Triage',
      action: 'changed',
      organization: 'acme',
      changes: [{ field: 'persona', before: 'Be brief.', after: 'Be thorough.' }],
    })
    // The stored row validates as the trail's own record, so a later read
    // answers it rather than refusing the domain.
    expect(entrySchema.safeParse(entry).success).toBe(true)
  })

  it('records nothing about authorization, because the change was already permitted', async () => {
    const ctx = await bench()
    // A trail that could refuse an entry would be a trail with changes
    // missing from it, so even a standing that may read nothing records.
    await expect(ctx.adminAudit.record({
      kind: 'person', subject: 'eve', subjectName: 'Eve', action: 'removed', organization: 'acme', changes: [],
    }, MEMBER)).resolves.toMatchObject({ by: 'dee' })
  })

  it('keeps a removal\'s value with no replacement beside it', async () => {
    const ctx = await bench()
    // What a removal is worth auditing for is the value that is now gone, so
    // the entry carries it with nothing on the other side.
    const entry = await ctx.adminAudit.record({
      kind: 'person',
      subject: 'eve',
      subjectName: 'Eve',
      action: 'removed',
      organization: 'acme',
      changes: fieldChanges({ role: 'tenant-administrator' }, undefined),
    }, ACME)

    expect(entry.changes).toEqual([{ field: 'role', before: 'tenant-administrator' }])
  })

  it('cuts a long value to the configured length and says that it did', async () => {
    const ctx = await bench({ maxValueLength: 8 })

    const entry = await ctx.adminAudit.record({
      kind: 'bot',
      subject: 'triage',
      subjectName: 'Triage',
      action: 'added',
      organization: 'acme',
      changes: [{ field: 'persona', after: 'a persona longer than the bound' }],
    }, ACME)

    expect(entry.changes).toEqual([{ field: 'persona', after: 'a person', truncated: true }])
  })

  it('leaves a value within the length unmarked', async () => {
    const ctx = await bench({ maxValueLength: 8 })
    const entry = await ctx.adminAudit.record({
      kind: 'team', subject: 't1', subjectName: 'Intake', action: 'added', changes: [{ field: 'members', after: 'one' }],
    }, PLATFORM)
    expect(entry.changes).toEqual([{ field: 'members', after: 'one' }])
  })
})

describe('reading the trail', () => {
  it('answers newest first, and only the organization asked about', async () => {
    const ctx = await bench()
    for (const [subject, organization] of [['a', 'acme'], ['b', 'other'], ['c', 'acme']] as const) {
      await ctx.adminAudit.record({
        kind: 'bot', subject, subjectName: subject, action: 'added', organization, changes: [],
      }, PLATFORM)
    }

    const acme = await ctx.adminAudit.read({ organization: 'acme' }, ACME)
    expect(acme.map(entry => entry.subject)).toEqual(['c', 'a'])
    // A platform standing reads every organization's.
    expect((await ctx.adminAudit.read({}, PLATFORM)).map(entry => entry.subject)).toEqual(['c', 'b', 'a'])
  })

  it('answers one record\'s own history', async () => {
    const ctx = await bench()
    for (const action of ['added', 'changed', 'removed'] as const) {
      await ctx.adminAudit.record({
        kind: 'bot', subject: 'triage', subjectName: 'Triage', action, organization: 'acme', changes: [],
      }, ACME)
      await ctx.adminAudit.record({
        kind: 'bot', subject: 'other', subjectName: 'Other', action, organization: 'acme', changes: [],
      }, ACME)
    }

    const history = await ctx.adminAudit.read({ organization: 'acme', subject: 'triage' }, ACME)
    expect(history.map(entry => entry.action)).toEqual(['removed', 'changed', 'added'])
  })

  it('refuses a standing that does not administer what it asks about', async () => {
    const ctx = await bench()
    // Knowing an organization's name is not permission to read its trail.
    await expect(ctx.adminAudit.read({ organization: 'acme' }, OTHER))
      .rejects.toThrow(new AuditRefusedError('not-permitted', NOT_PERMITTED))
    await expect(ctx.adminAudit.read({ organization: 'acme' }, MEMBER))
      .rejects.toThrow(new AuditRefusedError('not-permitted', NOT_PERMITTED))
    // Asking for every organization's trail is a platform reading.
    await expect(ctx.adminAudit.read({}, ACME))
      .rejects.toThrow(new AuditRefusedError('not-permitted', NOT_PERMITTED))
  })

  it('clamps a page to what the deployment answers, and answers at least one', async () => {
    const ctx = await bench({ maxEntries: 2 })
    for (const subject of ['a', 'b', 'c']) {
      await ctx.adminAudit.record({
        kind: 'bot', subject, subjectName: subject, action: 'added', organization: 'acme', changes: [],
      }, ACME)
    }

    expect((await ctx.adminAudit.read({ organization: 'acme', limit: 50 }, ACME))).toHaveLength(2)
    expect((await ctx.adminAudit.read({ organization: 'acme', limit: 0 }, ACME))).toHaveLength(1)
    expect((await ctx.adminAudit.read({ organization: 'acme', limit: Number.NaN }, ACME))).toHaveLength(2)
    expect((await ctx.adminAudit.read({ organization: 'acme' }, ACME))).toHaveLength(2)
  })

  it('keeps every entry across a remount, because the trail is only appended to', async () => {
    const root = await mkdtemp(join(tmpdir(), 'lyn-admin-audit-'))
    roots.push(root)
    const first = new Context()
    await first.plugin(Storage)
    await first.plugin(StorageJson, { root })
    await first.plugin(StorageDomain, { backend: 'json' })
    await first.plugin(AdminAudit, {}).await()
    await first.adminAudit.record({
      kind: 'bot', subject: 'triage', subjectName: 'Triage', action: 'added', organization: 'acme', changes: [],
    }, ACME)
    await first.fiber.dispose()

    const second = new Context()
    live.push(second)
    await second.plugin(Storage)
    await second.plugin(StorageJson, { root })
    await second.plugin(StorageDomain, { backend: 'json' })
    await second.plugin(AdminAudit, {}).await()

    expect((await second.adminAudit.read({ organization: 'acme' }, ACME)).map(entry => entry.subject))
      .toEqual(['triage'])
  })
})

describe('comparing two states of one record', () => {
  it('names only the fields that differ, in the order the fields are named', () => {
    expect(fieldChanges(
      { displayName: 'Triage', preset: 'standard', job: 'Files reports.' },
      { displayName: 'Intake', preset: 'standard', job: 'Files reports.' },
    )).toEqual([{ field: 'displayName', before: 'Triage', after: 'Intake' }])
  })

  it('reads an addition as after-only and a removal as before-only', () => {
    expect(fieldChanges(undefined, { role: 'member' })).toEqual([{ field: 'role', after: 'member' }])
    expect(fieldChanges({ role: 'member' }, undefined)).toEqual([{ field: 'role', before: 'member' }])
  })

  it('names a field one state carries and the other does not', () => {
    expect(fieldChanges({ organization: 'acme' }, {}))
      .toEqual([{ field: 'organization', before: 'acme' }])
  })
})

describe('the bounds a deployment sets', () => {
  it('applies both defaults to a config built by hand', () => {
    expect(resolveConfig({})).toEqual({
      maxValueLength: DEFAULT_MAX_VALUE_LENGTH,
      maxEntries: DEFAULT_MAX_ENTRIES,
    })
    expect(resolveConfig({ maxValueLength: 1, maxEntries: 2 })).toEqual({ maxValueLength: 1, maxEntries: 2 })
  })
})
