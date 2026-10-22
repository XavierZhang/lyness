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
import ManagedPeople, { NOT_A_PERSON, PeopleRefusedError, standingOf } from '@lyness/lyn-managed-people'
import ManagedBots, {
  BOT_ROLE, BotsRefusedError, NOT_PERMITTED, ORGANIZATION_REQUIRED, UNKNOWN_PRESET, WRITTEN,
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
async function bench(options: { presets?: readonly string[] } = {}): Promise<Context> {
  const root = await mkdtemp(join(tmpdir(), 'lyn-managed-bots-'))
  roots.push(root)
  const ctx = new Context()
  live.push(ctx)
  await ctx.plugin(Storage)
  await ctx.plugin(StorageJson, { root })
  await ctx.plugin(StorageDomain, { backend: 'json' })
  const offered = options.presets ?? ['standard']
  // The real registry composes plugin trees; what this service reads from it
  // is which ids it currently offers.
  ctx.provide('agentPresets', { list: () => Promise.resolve(offered.map(id => ({ id }))) } as never)
  // What the roster registers there is covered in `bot-session.spec.ts`.
  ctx.provide('sessionProjections', { register: () => () => {} } as never)
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
    const ctx = await bench({ presets: ['standard'] })
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
