/**
 * What an administrator may change about the bots a deployment runs: who may
 * add one and in which organization, which presets a bot may name, what the
 * roster then answers about it, and the two things a bot is never allowed to
 * become — an administrator, or somebody who signs in.
 */

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@lyness/cordis'
import { brandString } from '@lyness/lyn-brand'
import type { Membership, MembershipId, PersonId, Role } from '@lyness/lyn-people'
import Storage from '@lyness/lyn-storage'
import * as StorageJson from '@lyness/lyn-storage-json'
import * as StorageDomain from '@lyness/lyn-storage-domain'
import AdminAudit from '@lyness/lyn-admin-audit'
import ManagedPeople, { NOT_A_PERSON, PeopleRefusedError, standingOf } from '@lyness/lyn-managed-people'
import ManagedBots, {
  BOT_ROLE, BotsRefusedError, NOT_PERMITTED, ORGANIZATION_REQUIRED, UNKNOWN_BOT, UNKNOWN_PRESET, WRITTEN,
} from '../src/index.ts'
import type { BotSubmission } from '../src/types.ts'

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

/** What an administrator fills in, with whatever one test varies. */
function submission(over: Partial<BotSubmission> = {}): BotSubmission {
  return {
    displayName: 'Triage',
    organization: 'acme',
    persona: 'You answer in short sentences.',
    job: 'Reads incoming reports and files them.',
    preset: 'standard',
    ...over,
  }
}

/** A deployment storing its bots, offering whichever presets the test names. */
async function bench(
  options: { presets?: readonly { id: string; name?: string; description?: string; broken?: string }[] } = {},
): Promise<Context> {
  const root = await mkdtemp(join(tmpdir(), 'lyn-managed-bots-'))
  roots.push(root)
  const ctx = new Context()
  live.push(ctx)
  await ctx.plugin(Storage)
  await ctx.plugin(StorageJson, { root })
  await ctx.plugin(StorageDomain, { backend: 'json' })
  const offered = options.presets ?? [{ id: 'standard' }]
  // The real registry composes plugin trees; what this service reads from it
  // is which ids it currently offers.
  ctx.provide('agentPresets', { list: () => Promise.resolve(offered) } as never)
  // What the roster registers there is covered in `bot-session.spec.ts`.
  ctx.provide('sessionProjections', { register: () => () => {} } as never)
  await ctx.plugin(AdminAudit, {}).await()
  await ctx.plugin(ManagedPeople).await()
  await ctx.plugin(ManagedBots).await()
  return ctx
}

describe('adding a bot', () => {
  it('puts it in the roster, where it reads as a bot holding a member standing', async () => {
    const ctx = await bench()
    const saved = await ctx.managedBots.save(submission(), standing('tenant-administrator', 'acme'))

    expect(saved.displayName).toBe('Triage')
    expect(saved.available).toBe(true)
    expect(saved.written).toBe(false)

    // The point of the roster entry: a conversation this bot owns resolves
    // its owner without anything knowing about bots.
    await expect(ctx.managedPeople.person(saved.id)).resolves.toMatchObject({ displayName: 'Triage' })
    await expect(ctx.managedPeople.memberships(saved.id)).resolves.toEqual([
      { id: standingOf(saved.id), person: saved.id, organization: 'acme', role: BOT_ROLE },
    ])
  })

  it('refuses a preset this deployment does not offer', async () => {
    const ctx = await bench({ presets: [{ id: 'standard' }] })
    await expect(ctx.managedBots.save(submission({ preset: 'unlisted' }), standing('platform-administrator')))
      .rejects.toThrow(new BotsRefusedError('unknown-preset', UNKNOWN_PRESET))
    await expect(ctx.managedBots.list(standing('platform-administrator'))).resolves.toEqual([])
  })

  it('refuses one with no organization, because a bot belongs to exactly one', async () => {
    const ctx = await bench()
    await expect(ctx.managedBots.save(submission({ organization: '' }), standing('platform-administrator')))
      .rejects.toThrow(new BotsRefusedError('organization-required', ORGANIZATION_REQUIRED))
  })

  it('refuses an organization the standing does not administer', async () => {
    const ctx = await bench()
    await expect(ctx.managedBots.save(submission({ organization: 'other' }), standing('tenant-administrator', 'acme')))
      .rejects.toThrow(new BotsRefusedError('not-permitted', NOT_PERMITTED))
  })

  it('refuses a member outright', async () => {
    const ctx = await bench()
    await expect(ctx.managedBots.save(submission(), standing('member', 'acme')))
      .rejects.toThrow(new BotsRefusedError('not-permitted', NOT_PERMITTED))
  })
})

describe('what the trail records', () => {
  it('names the administrator, the value a change replaced, and nothing for a change that altered none', async () => {
    const ctx = await bench()
    const by = standing('tenant-administrator', 'acme')
    const saved = await ctx.managedBots.save(submission(), by)

    await ctx.managedBots.save({ ...submission(), id: brandString<PersonId>(saved.id), persona: 'Answer at length.' }, by)
    // Saving the same submission again changed nothing, so there is nothing
    // for an auditor to read past.
    await ctx.managedBots.save({ ...submission(), id: brandString<PersonId>(saved.id), persona: 'Answer at length.' }, by)
    await ctx.managedBots.remove(brandString<PersonId>(saved.id), by)

    const trail = await ctx.adminAudit.read({ organization: 'acme' }, by)
    expect(trail.map(entry => entry.action)).toEqual(['removed', 'changed', 'added'])
    expect(trail.every(entry => entry.by === 'ada' && entry.subjectName === 'Triage')).toBe(true)
    expect(trail[1]?.changes).toEqual([
      { field: 'persona', before: 'You answer in short sentences.', after: 'Answer at length.' },
    ])
  })

  it('records a team by the members an administrator chose', async () => {
    const ctx = await bench()
    const by = standing('tenant-administrator', 'acme')
    const first = await ctx.managedBots.save(submission(), by)
    const team = await ctx.managedBots.saveTeam(
      { displayName: 'Intake', organization: 'acme', members: [brandString<PersonId>(first.id)] },
      by,
    )
    await ctx.managedBots.removeTeam(team.id, by)

    const trail = await ctx.adminAudit.read({ organization: 'acme', subject: team.id }, by)
    expect(trail.map(entry => entry.action)).toEqual(['removed', 'added'])
    expect(trail[1]?.changes).toEqual([
      { field: 'displayName', after: 'Intake' },
      { field: 'organization', after: 'acme' },
      { field: 'members', after: first.id },
    ])
  })
})

describe('listing them', () => {
  it('shows one standing only the bots it administers, written and stored alike', async () => {
    const ctx = await bench()
    ctx.effect(() => ctx.managedBots.declareBot({
      id: brandString<PersonId>('scribe'),
      displayName: 'Scribe',
      organization: 'other',
      persona: '',
      job: '',
      preset: 'standard',
    }))
    await ctx.managedBots.save(submission({ organization: 'other' }), standing('platform-administrator'))
    await ctx.managedBots.save(submission({ displayName: 'Ours' }), standing('platform-administrator'))

    // Listing another organization's bots would tell one customer who the
    // others are, which is the rule the channel list already follows.
    const theirs = await ctx.managedBots.list(standing('tenant-administrator', 'acme'))
    expect(theirs.map(bot => bot.displayName)).toEqual(['Ours'])
    const every = await ctx.managedBots.list(standing('platform-administrator'))
    expect(every.map(bot => bot.displayName)).toEqual(['Scribe', 'Triage', 'Ours'])
  })
})

describe('changing one', () => {
  it('keeps its identity, so the conversations it owns stay its own', async () => {
    const ctx = await bench()
    const by = standing('tenant-administrator', 'acme')
    const first = await ctx.managedBots.save(submission(), by)
    const second = await ctx.managedBots.save(submission({ id: first.id, persona: 'You answer at length.' }), by)

    expect(second.id).toBe(first.id)
    expect(second.persona).toBe('You answer at length.')
    await expect(ctx.managedBots.list(by)).resolves.toHaveLength(1)
    // The name the roster answers follows the record, or a renamed bot would
    // keep signing its old conversations with its old name.
    await expect(ctx.managedPeople.person(first.id)).resolves.toMatchObject({ displayName: 'Triage' })
  })

  it('authorizes against the stored organization, not only the submitted one', async () => {
    const ctx = await bench()
    const theirs = await ctx.managedBots.save(submission({ organization: 'other' }), standing('platform-administrator'))
    // Naming another tenant's bot id with one's own organization is how an
    // administrator would otherwise take it.
    await expect(
      ctx.managedBots.save(submission({ id: theirs.id, organization: 'acme' }), standing('tenant-administrator', 'acme')),
    ).rejects.toThrow(new BotsRefusedError('not-permitted', NOT_PERMITTED))
  })

  it('removes one, and leaves the roster answering nobody for it', async () => {
    const ctx = await bench()
    const by = standing('tenant-administrator', 'acme')
    const saved = await ctx.managedBots.save(submission(), by)
    await ctx.managedBots.remove(saved.id, by)

    await expect(ctx.managedBots.list(by)).resolves.toEqual([])
    await expect(ctx.managedPeople.person(saved.id)).resolves.toBeUndefined()
    // Removing one nobody stores is the state the caller asked for.
    await expect(ctx.managedBots.remove(saved.id, by)).resolves.toBeUndefined()
  })

  it('refuses to remove another organization\'s bot', async () => {
    const ctx = await bench()
    const theirs = await ctx.managedBots.save(submission({ organization: 'other' }), standing('platform-administrator'))
    await expect(ctx.managedBots.remove(theirs.id, standing('tenant-administrator', 'acme')))
      .rejects.toThrow(new BotsRefusedError('not-permitted', NOT_PERMITTED))
  })
})

describe('what composition wrote', () => {
  it('is listed, answered by the roster, and refused every change', async () => {
    const ctx = await bench()
    const written = {
      id: brandString<PersonId>('scribe'),
      displayName: 'Scribe',
      organization: 'acme',
      persona: 'You write minutes.',
      job: 'Keeps the record of a discussion.',
      preset: 'standard',
    }
    ctx.effect(() => ctx.managedBots.declareBot(written))
    const by = standing('tenant-administrator', 'acme')

    await expect(ctx.managedBots.list(by)).resolves.toEqual([{ ...written, written: true, available: true }])
    await expect(ctx.managedPeople.person(written.id)).resolves.toMatchObject({ displayName: 'Scribe' })
    await expect(ctx.managedBots.save(submission({ id: written.id }), by))
      .rejects.toThrow(new BotsRefusedError('written', WRITTEN))
    await expect(ctx.managedBots.remove(written.id, by))
      .rejects.toThrow(new BotsRefusedError('written', WRITTEN))
  })

  it('reports a preset the deployment stopped offering, rather than losing the bot', async () => {
    const ctx = await bench({ presets: [] })
    ctx.effect(() => ctx.managedBots.declareBot({
      id: brandString<PersonId>('scribe'),
      displayName: 'Scribe',
      organization: 'acme',
      persona: '',
      job: '',
      preset: 'retired',
    }))
    const [listed] = await ctx.managedBots.list(standing('platform-administrator'))
    expect(listed?.available).toBe(false)
  })
})

describe('what a bot never becomes', () => {
  it('is somebody who signs in', async () => {
    const ctx = await bench()
    const by = standing('tenant-administrator', 'acme')
    const saved = await ctx.managedBots.save(submission(), by)

    await expect(ctx.managedPeople.bind(
      { channel: 'one', issuer: 'ww-acme', subject: 'triage', person: saved.id },
      by,
    )).rejects.toThrow(new PeopleRefusedError('not-a-person', NOT_A_PERSON))
  })

  it('is an administrator: the standing is the service\'s, not the submission\'s', async () => {
    const ctx = await bench()
    const saved = await ctx.managedBots.save(submission(), standing('platform-administrator'))
    const [held] = await ctx.managedPeople.memberships(saved.id)
    expect(held?.role).toBe('member')
  })
})

describe('a restart', () => {
  it('finds the stored bots in the roster without anybody opening the surface', async () => {
    const root = await mkdtemp(join(tmpdir(), 'lyn-managed-bots-'))
    roots.push(root)

    /** One runtime over that storage. */
    const boot = async (): Promise<Context> => {
      const ctx = new Context()
      live.push(ctx)
      await ctx.plugin(Storage)
      await ctx.plugin(StorageJson, { root })
      await ctx.plugin(StorageDomain, { backend: 'json' })
      ctx.provide('agentPresets', { list: () => Promise.resolve([{ id: 'standard' }]) } as never)
      ctx.provide('sessionProjections', { register: () => () => {} } as never)
      await ctx.plugin(AdminAudit, {}).await()
      await ctx.plugin(ManagedPeople).await()
      await ctx.plugin(ManagedBots).await()
      return ctx
    }

    const first = await boot()
    const saved = await first.managedBots.save(submission(), standing('tenant-administrator', 'acme'))
    await first.fiber.dispose()
    live.splice(live.indexOf(first), 1)

    const second = await boot()
    await expect(second.managedPeople.person(saved.id)).resolves.toMatchObject({ displayName: 'Triage' })
    await expect(second.managedBots.list(standing('tenant-administrator', 'acme'))).resolves.toHaveLength(1)
  })
})

describe('what a bot may be given', () => {
  it('answers the presets on offer, labels and all, and leaves out a broken one', async () => {
    const ctx = await bench({ presets: [
      { id: 'standard', name: 'Standard', description: 'The everyday one.' },
      { id: 'plain' },
      { id: 'broken', broken: 'a row failed to activate' },
    ] })
    // The same list `save` validates against, so a surface cannot offer a
    // choice the service would refuse.
    await expect(ctx.managedBots.offers()).resolves.toEqual([
      { id: 'standard', displayName: 'Standard', description: 'The everyday one.' },
      { id: 'plain' },
    ])
  })
})

describe('a team', () => {
  /** One bot in that organization, by name. */
  async function bot(ctx: Context, displayName: string, organization = 'acme'): Promise<PersonId> {
    const saved = await ctx.managedBots.save(
      submission({ displayName, organization }),
      standing('platform-administrator'),
    )
    return brandString<PersonId>(saved.id)
  }

  it('is who may ask whom: a shared team makes teammates, a shared organization does not', async () => {
    const ctx = await bench()
    const by = standing('tenant-administrator', 'acme')
    const triage = await bot(ctx, 'Triage')
    const scribe = await bot(ctx, 'Scribe')
    const stranger = await bot(ctx, 'Stranger')

    await ctx.managedBots.saveTeam({ displayName: 'Intake', organization: 'acme', members: [triage, scribe] }, by)

    // The relation an administrator wrote is the only thing that grants the
    // right to ask; sharing an organization grants nothing.
    await expect(ctx.managedBots.teammates(triage)).resolves.toEqual([
      { id: scribe, displayName: 'Scribe', job: 'Reads incoming reports and files them.', persona: 'You answer in short sentences.', preset: 'standard' },
    ])
    await expect(ctx.managedBots.teammates(stranger)).resolves.toEqual([])
  })

  it('reads one colleague once, however many teams they share', async () => {
    const ctx = await bench()
    const by = standing('tenant-administrator', 'acme')
    const triage = await bot(ctx, 'Triage')
    const scribe = await bot(ctx, 'Scribe')
    await ctx.managedBots.saveTeam({ displayName: 'Intake', organization: 'acme', members: [triage, scribe] }, by)
    await ctx.managedBots.saveTeam({ displayName: 'Review', organization: 'acme', members: [triage, scribe] }, by)

    const teammates = await ctx.managedBots.teammates(triage)
    expect(teammates.map(one => one.displayName)).toEqual(['Scribe'])
  })

  it('refuses a member the team\'s organization does not hold', async () => {
    const ctx = await bench()
    const ours = await bot(ctx, 'Ours')
    const theirs = await bot(ctx, 'Theirs', 'other')
    const by = standing('tenant-administrator', 'acme')

    // Membership grants the right to ask, so a team holding another
    // organization's bot would hand that right across the boundary.
    await expect(ctx.managedBots.saveTeam(
      { displayName: 'Mixed', organization: 'acme', members: [ours, theirs] },
      by,
    )).rejects.toThrow(new BotsRefusedError('unknown-bot', UNKNOWN_BOT))

    await expect(ctx.managedBots.saveTeam(
      { displayName: 'Ghosts', organization: 'acme', members: [brandString<PersonId>('nobody')] },
      by,
    )).rejects.toThrow(new BotsRefusedError('unknown-bot', UNKNOWN_BOT))
  })

  it('refuses an organization the standing does not administer, and one with none', async () => {
    const ctx = await bench()
    await expect(ctx.managedBots.saveTeam(
      { displayName: 'Theirs', organization: 'other', members: [] },
      standing('tenant-administrator', 'acme'),
    )).rejects.toThrow(new BotsRefusedError('not-permitted', NOT_PERMITTED))

    await expect(ctx.managedBots.saveTeam(
      { displayName: 'Nobody\'s', organization: '', members: [] },
      standing('platform-administrator'),
    )).rejects.toThrow(new BotsRefusedError('organization-required', ORGANIZATION_REQUIRED))
  })

  it('is listed, changed and removed by the standing that administers it', async () => {
    const ctx = await bench()
    const by = standing('tenant-administrator', 'acme')
    const triage = await bot(ctx, 'Triage')
    const saved = await ctx.managedBots.saveTeam({ displayName: 'Intake', organization: 'acme', members: [triage] }, by)

    expect(saved).toMatchObject({ displayName: 'Intake', members: [triage], written: false })
    const renamed = await ctx.managedBots.saveTeam(
      { id: saved.id, displayName: 'Front desk', organization: 'acme', members: [triage] },
      by,
    )
    expect(renamed.id).toBe(saved.id)
    await expect(ctx.managedBots.teams(by)).resolves.toEqual([expect.objectContaining({ displayName: 'Front desk' })])

    // Another organization's teams are not listed, for the reason its bots
    // are not: listing them would tell one customer who the others are.
    await expect(ctx.managedBots.teams(standing('tenant-administrator', 'other'))).resolves.toEqual([])

    await ctx.managedBots.removeTeam(saved.id, by)
    await expect(ctx.managedBots.teams(by)).resolves.toEqual([])
    // The bots stay; what went is the relation that let them ask each other.
    await expect(ctx.managedBots.list(by)).resolves.toHaveLength(1)
    await expect(ctx.managedBots.removeTeam(saved.id, by)).resolves.toBeUndefined()
  })

  it('refuses to change or remove another organization\'s team', async () => {
    const ctx = await bench()
    const theirs = await ctx.managedBots.saveTeam(
      { displayName: 'Theirs', organization: 'other', members: [] },
      standing('platform-administrator'),
    )
    const by = standing('tenant-administrator', 'acme')
    await expect(ctx.managedBots.saveTeam(
      { id: theirs.id, displayName: 'Mine now', organization: 'acme', members: [] },
      by,
    )).rejects.toThrow(new BotsRefusedError('not-permitted', NOT_PERMITTED))
    await expect(ctx.managedBots.removeTeam(theirs.id, by))
      .rejects.toThrow(new BotsRefusedError('not-permitted', NOT_PERMITTED))
  })

  it('leaves another organization\'s written team out of the listing', async () => {
    const ctx = await bench()
    ctx.effect(() => ctx.managedBots.declareTeam({
      id: 'theirs', displayName: 'Theirs', organization: 'other', members: [],
    }))
    await expect(ctx.managedBots.teams(standing('tenant-administrator', 'acme'))).resolves.toEqual([])
    await expect(ctx.managedBots.teams(standing('platform-administrator'))).resolves.toHaveLength(1)
  })

  it('leaves a written team to the operator, and still answers its teammates', async () => {
    const ctx = await bench()
    const written = { id: 'intake', displayName: 'Intake', organization: 'acme', members: [
      brandString<PersonId>('scribe'), brandString<PersonId>('triage'),
    ] }
    ctx.effect(() => ctx.managedBots.declareTeam(written))
    ctx.effect(() => ctx.managedBots.declareBot({
      id: brandString<PersonId>('scribe'),
      displayName: 'Scribe',
      organization: 'acme',
      persona: 'You write minutes.',
      job: 'Keeps the record.',
      preset: 'standard',
    }))
    const by = standing('tenant-administrator', 'acme')

    await expect(ctx.managedBots.teams(by)).resolves.toEqual([{ ...written, written: true }])
    await expect(ctx.managedBots.saveTeam(
      { id: 'intake', displayName: 'Renamed', organization: 'acme', members: [] },
      by,
    )).rejects.toThrow(new BotsRefusedError('written', WRITTEN))
    await expect(ctx.managedBots.removeTeam('intake', by))
      .rejects.toThrow(new BotsRefusedError('written', WRITTEN))

    // `triage` is named by the team and held by nobody: a member nothing
    // answers for is not a teammate anybody can ask.
    await expect(ctx.managedBots.teammates(brandString<PersonId>('triage'))).resolves.toEqual([
      expect.objectContaining({ displayName: 'Scribe' }),
    ])
    await expect(ctx.managedBots.teammates(brandString<PersonId>('scribe'))).resolves.toEqual([])
  })
})
