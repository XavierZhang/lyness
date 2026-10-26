/**
 * What the bots surface answers an administrator, and what it refuses: a bot
 * composition owns, another organization's, a preset this deployment does not
 * offer, a submission missing the organization, and a call on no standing.
 */

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@lyness/cordis'
import { brandString } from '@lyness/lyn-brand'
import AdminAudit from '@lyness/lyn-admin-audit'
import ManagedBots from '@lyness/lyn-managed-bots'
import ManagedPeople from '@lyness/lyn-managed-people'
import ManagedPeopleDirectory from '@lyness/lyn-managed-people/directory'
import type { Membership, MembershipId, PersonId, Role } from '@lyness/lyn-people'
import Storage from '@lyness/lyn-storage'
import * as StorageJson from '@lyness/lyn-storage-json'
import * as StorageDomain from '@lyness/lyn-storage-domain'
import { RemoteError } from '@lyness/lyn-typert-protocol'
import BotsController from '../src/index.ts'
import type { BotInput } from '../src/types.ts'

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

/** What an administrator fills in, with whatever one test varies. */
function input(over: Partial<BotInput> = {}): BotInput {
  return {
    displayName: 'Triage',
    organization: 'acme',
    persona: 'You answer in short sentences.',
    job: 'Reads incoming reports and files them.',
    preset: 'standard',
    ...over,
  }
}

/** The deployment, with one standing calling it. */
async function harness(
  by: Membership | 'none',
  options: {
    roster?: boolean
    presets?: readonly { id: string; name?: string; description?: string; broken?: string }[]
  } = {},
): Promise<BotsController> {
  root ??= await mkdtemp(join(tmpdir(), 'lyn-bots-controller-'))
  const ctx = new Context()
  live.push(ctx)
  ctx.provide('requestPrincipal', {
    current: () => by === 'none' ? undefined : { person: by.person, acting: { person: by.person, membership: by.id } },
  })
  const offered = options.presets ?? [{ id: 'standard', name: 'Standard' }]
  ctx.provide('agentPresets', { list: () => Promise.resolve(offered) } as never)
  // The roster registers its session projection there; what it records is
  // covered in the managed-bots package.
  ctx.provide('sessionProjections', { register: () => () => {} } as never)
  if (options.roster !== false) {
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
    await ctx.plugin(ManagedBots).await()
  }
  await ctx.plugin(BotsController)
  return ctx.botsController
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

describe('an administrator maintaining the bots their organization runs', () => {
  it('adds one, reads it back, changes it, and removes it', async () => {
    const controller = await harness(standing('tenant-administrator', 'acme'))
    const added = await controller.save(input())
    expect(added).toMatchObject({ displayName: 'Triage', organization: 'acme', written: false, available: true })

    const renamed = await controller.save(input({ id: added.id, displayName: 'Intake' }))
    expect(renamed.id).toBe(added.id)
    expect(await controller.list()).toEqual([expect.objectContaining({ id: added.id, displayName: 'Intake' })])

    await controller.remove(added.id)
    expect(await controller.list()).toEqual([])
  })

  it('offers the presets a bot may be given, leaving out one that cannot compose a session', async () => {
    const controller = await harness(standing('tenant-administrator', 'acme'), {
      presets: [
        { id: 'standard', name: 'Standard', description: 'The everyday one.' },
        // A preset with no published name leaves the id as the label.
        { id: 'plain' },
        { id: 'broken', broken: 'a row failed to activate' },
      ],
    })
    expect(await controller.presets()).toEqual([
      { id: 'standard', displayName: 'Standard', description: 'The everyday one.' },
      { id: 'plain' },
    ])
  })

  it('is refused a preset this deployment does not offer', async () => {
    const controller = await harness(standing('tenant-administrator', 'acme'))
    expect(await codeOf(controller.save(input({ preset: 'unlisted' })))).toBe('bots/unknown-preset')
  })

  it('is refused a submission with no organization, naming the field a form marks', async () => {
    const controller = await harness(standing('platform-administrator'))
    try {
      await controller.save(input({ organization: '' }))
      expect.unreachable('the roster refuses a bot belonging to nobody')
    } catch (failed: unknown) {
      expect(failed).toBeInstanceOf(RemoteError)
      expect((failed as RemoteError).code).toBe('bots/incomplete')
      expect((failed as RemoteError).details).toEqual({ fields: ['organization'] })
    }
  })

  it('is refused another organization\'s bot, whether changing or removing it', async () => {
    const platform = await harness(standing('platform-administrator'))
    const theirs = await platform.save(input({ organization: 'other' }))

    const tenant = await harness(standing('tenant-administrator', 'acme'))
    expect(await codeOf(tenant.save(input({ id: theirs.id })))).toBe('bots/not-permitted')
    expect(await codeOf(tenant.remove(theirs.id))).toBe('bots/not-permitted')
    // And it is not listed either, because listing it would tell one customer
    // who the others are.
    expect(await tenant.list()).toEqual([])
  })
})

describe('an administrator maintaining the teams their bots work in', () => {
  it('adds one, lists it, changes it, and removes it without removing the bots', async () => {
    const controller = await harness(standing('tenant-administrator', 'acme'))
    const triage = await controller.save(input())
    const scribe = await controller.save(input({ displayName: 'Scribe' }))

    const team = await controller.saveTeam({
      displayName: 'Intake', organization: 'acme', members: [triage.id, scribe.id],
    })
    expect(team).toMatchObject({ displayName: 'Intake', members: [triage.id, scribe.id], written: false })

    const renamed = await controller.saveTeam({
      id: team.id, displayName: 'Front desk', organization: 'acme', members: [triage.id],
    })
    expect(renamed.id).toBe(team.id)
    expect(await controller.teams()).toEqual([expect.objectContaining({ displayName: 'Front desk' })])

    await controller.removeTeam(team.id)
    expect(await controller.teams()).toEqual([])
    // The relation went; the bots did not.
    expect(await controller.list()).toHaveLength(2)
  })

  it('is refused a member its organization does not hold', async () => {
    const platform = await harness(standing('platform-administrator'))
    const theirs = await platform.save(input({ organization: 'other' }))

    const tenant = await harness(standing('tenant-administrator', 'acme'))
    // Team membership is what grants one bot the right to ask another.
    expect(await codeOf(tenant.saveTeam({
      displayName: 'Mixed', organization: 'acme', members: [theirs.id],
    }))).toBe('bots/unknown-bot')
  })

  it('is refused a team with no organization, naming the field a form marks', async () => {
    const controller = await harness(standing('platform-administrator'))
    expect(await codeOf(controller.saveTeam({ displayName: 'Nobody\'s', organization: '', members: [] })))
      .toBe('bots/incomplete')
  })

  it('is refused another organization\'s team, whether changing or removing it', async () => {
    const platform = await harness(standing('platform-administrator'))
    const theirs = await platform.saveTeam({ displayName: 'Theirs', organization: 'other', members: [] })

    const tenant = await harness(standing('tenant-administrator', 'acme'))
    expect(await codeOf(tenant.saveTeam({
      id: theirs.id, displayName: 'Mine now', organization: 'acme', members: [],
    }))).toBe('bots/not-permitted')
    expect(await codeOf(tenant.removeTeam(theirs.id))).toBe('bots/not-permitted')
    expect(await tenant.teams()).toEqual([])
  })
})

describe('what the surface refuses before it reaches the roster', () => {
  it('says the deployment maintains no bots when no roster is mounted', async () => {
    const controller = await harness(standing('platform-administrator'), { roster: false })
    expect(await codeOf(controller.list())).toBe('gateway/internal')
    expect(await codeOf(controller.presets())).toBe('gateway/internal')
    expect(await codeOf(controller.save(input()))).toBe('gateway/internal')
    expect(await codeOf(controller.remove('triage'))).toBe('gateway/internal')
    expect(await codeOf(controller.teams())).toBe('gateway/internal')
    expect(await codeOf(controller.saveTeam({ displayName: 'Intake', organization: 'acme', members: [] })))
      .toBe('gateway/internal')
    expect(await codeOf(controller.removeTeam('intake'))).toBe('gateway/internal')
  })

  it('refuses a call that acts in no standing rather than performing it on nobody\'s authority', async () => {
    const controller = await harness('none')
    expect(await codeOf(controller.list())).toBe('bots/no-standing')
    expect(await codeOf(controller.presets())).toBe('bots/no-standing')
    expect(await codeOf(controller.save(input()))).toBe('bots/no-standing')
    expect(await codeOf(controller.remove('triage'))).toBe('bots/no-standing')
    expect(await codeOf(controller.teams())).toBe('bots/no-standing')
    expect(await codeOf(controller.saveTeam({ displayName: 'Intake', organization: 'acme', members: [] })))
      .toBe('bots/no-standing')
    expect(await codeOf(controller.removeTeam('intake'))).toBe('bots/no-standing')
  })
})

describe('what composition wrote', () => {
  it('is listed and refused every change', async () => {
    const controller = await harness(standing('platform-administrator'))
    const ctx = live.at(-1)
    ctx?.effect(() => ctx.managedBots.declareBot({
      id: brandString<PersonId>('scribe'),
      displayName: 'Scribe',
      organization: 'acme',
      persona: 'You write minutes.',
      job: 'Keeps the record of a discussion.',
      preset: 'standard',
    }))

    expect(await controller.list()).toEqual([expect.objectContaining({ id: 'scribe', written: true })])
    expect(await codeOf(controller.save(input({ id: 'scribe' })))).toBe('bots/written')
    expect(await codeOf(controller.remove('scribe'))).toBe('bots/written')

    ctx?.effect(() => ctx.managedBots.declareTeam({
      id: 'intake', displayName: 'Intake', organization: 'acme', members: [brandString<PersonId>('scribe')],
    }))
    expect(await controller.teams()).toEqual([expect.objectContaining({ id: 'intake', written: true })])
    expect(await codeOf(controller.saveTeam({
      id: 'intake', displayName: 'Renamed', organization: 'acme', members: [],
    }))).toBe('bots/written')
    expect(await codeOf(controller.removeTeam('intake'))).toBe('bots/written')
  })
})

describe('a failure that is not a refusal', () => {
  it('reaches the caller as itself rather than as a bot refusal', async () => {
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
    ctx.provide('managedBots', { save: () => Promise.reject(new Error('storage closed')) } as never)
    await ctx.plugin(BotsController)

    await expect(ctx.botsController.save(input())).rejects.toThrow('storage closed')
  })
})
