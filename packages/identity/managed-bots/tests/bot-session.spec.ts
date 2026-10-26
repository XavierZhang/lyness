/**
 * What a session speaking as a bot records and renders: the character
 * reaching the model as a section of its own, the projection that rebuilds
 * it, and the one fact the whole design turns on — the log holds the
 * character the session ran with, not whatever the roster holds now.
 */

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@lyness/cordis'
import { brandString } from '@lyness/lyn-brand'
import type { Membership, MembershipId, PersonId } from '@lyness/lyn-people'
import SystemPrompt, { renderPrompt } from '@lyness/lyn-system-prompt'
import Storage from '@lyness/lyn-storage'
import * as StorageJson from '@lyness/lyn-storage-json'
import * as StorageDomain from '@lyness/lyn-storage-domain'
import AdminAudit from '@lyness/lyn-admin-audit'
import ManagedPeople from '@lyness/lyn-managed-people'
import ManagedBots, {
  BOT_PERSONA_SECTION, BotsRefusedError, NOT_YOURS, botProjectionDefinition, composeBotPersona,
} from '../src/index.ts'
import type { EngagedBot } from '../src/session.ts'

const live: Context[] = []
const roots: string[] = []

/** What the roster registered with the projection registry, per bench. */
const registeredProjections: { key: string }[] = []

afterEach(async () => {
  for (const ctx of live.splice(0)) await ctx.fiber.dispose()
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true })
  registeredProjections.splice(0)
})

/** The standing one administrator acts in. */
const BY: Membership = {
  id: brandString<MembershipId>('ada:platform-administrator'),
  person: brandString<PersonId>('ada'),
  role: 'platform-administrator',
}

/** A deployment holding bots, with a prompt to compose into. */
async function bench(): Promise<Context> {
  const root = await mkdtemp(join(tmpdir(), 'lyn-bot-session-'))
  roots.push(root)
  const ctx = new Context()
  live.push(ctx)
  await ctx.plugin(SystemPrompt, { personaPrefix: 'Deployment.' })
  await ctx.plugin(Storage)
  await ctx.plugin(StorageJson, { root })
  await ctx.plugin(StorageDomain, { backend: 'json' })
  ctx.provide('agentPresets', { list: () => Promise.resolve([{ id: 'standard' }]) } as never)
  ctx.provide('sessionProjections', {
    register: (one: { key: string }) => { registeredProjections.push(one); return () => {} },
  } as never)
  await ctx.plugin(AdminAudit, {}).await()
  await ctx.plugin(ManagedPeople).await()
  await ctx.plugin(ManagedBots).await()
  return ctx
}

/** One session event, as the projection folds it. */
function engagedEvent(engaged: EngagedBot): { type: 'bot/engaged'; seq: number; time: number; data: EngagedBot } {
  return { type: 'bot/engaged', seq: 1, time: 1, data: engaged }
}

describe('engaging a bot', () => {
  it('answers the preset to run and the character to record', async () => {
    const ctx = await bench()
    const saved = await ctx.managedBots.save({
      displayName: 'Triage',
      organization: 'acme',
      persona: 'You answer in short sentences.',
      job: 'Files reports.',
      preset: 'standard',
    }, BY)

    await expect(ctx.managedBots.engage(brandString<PersonId>(saved.id), BY)).resolves.toEqual({
      preset: 'standard',
      engaged: { bot: saved.id, displayName: 'Triage', persona: 'You answer in short sentences.' },
    })
  })

  it('answers for a bot composition wrote as well as a stored one', async () => {
    const ctx = await bench()
    ctx.effect(() => ctx.managedBots.declareBot({
      id: brandString<PersonId>('scribe'),
      displayName: 'Scribe',
      organization: 'acme',
      persona: 'You write minutes.',
      job: '',
      preset: 'standard',
    }))
    await expect(ctx.managedBots.engage(brandString<PersonId>('scribe'), BY)).resolves.toMatchObject({
      engaged: { displayName: 'Scribe', persona: 'You write minutes.' },
    })
  })

  it('answers nothing for a bot nobody maintains', async () => {
    const ctx = await bench()
    await expect(ctx.managedBots.engage(brandString<PersonId>('ghost'), BY)).resolves.toBeUndefined()
  })

  it('refuses a standing from another organization, and admits an ordinary member of its own', async () => {
    const ctx = await bench()
    const saved = await ctx.managedBots.save({
      displayName: 'Triage', organization: 'acme', persona: '', job: '', preset: 'standard',
    }, BY)
    const id = brandString<PersonId>(saved.id)

    // Knowing a bot's id is not permission to be it.
    const elsewhere: Membership = {
      id: brandString<MembershipId>('bea:member'),
      person: brandString<PersonId>('bea'),
      role: 'member',
      organization: 'other',
    }
    await expect(ctx.managedBots.engage(id, elsewhere))
      .rejects.toThrow(new BotsRefusedError('not-yours', NOT_YOURS))

    // An ordinary member of that organization may talk to its bots; it is not
    // an administrative act.
    const inside: Membership = { ...elsewhere, organization: 'acme' }
    await expect(ctx.managedBots.engage(id, inside)).resolves.toMatchObject({ preset: 'standard' })
  })
})

describe('the character reaching the model', () => {
  it('is its own section after the deployment persona, naming who is speaking', async () => {
    const ctx = await bench()
    const engaged: EngagedBot = { bot: 'triage', displayName: 'Triage', persona: 'You answer briefly.' }
    const withdraw = ctx.managedBots.compose(ctx, engaged)

    const assembly = await ctx.systemPrompt.assemble()
    const section = assembly.sections.find(one => one.name === BOT_PERSONA_SECTION)
    expect(section?.text).toBe('You are Triage.\n\nYou answer briefly.')
    // The deployment's own persona is still there: a bot says who is
    // speaking, it does not replace how the agent works.
    expect(renderPrompt(assembly)).toContain('Deployment.')

    withdraw()
    expect((await ctx.systemPrompt.assemble()).sections.find(one => one.name === BOT_PERSONA_SECTION))
      .toBeUndefined()
  })

  it('names the bot even when nobody wrote it a character', async () => {
    const ctx = await bench()
    composeBotPersona(ctx, { bot: 'plain', displayName: 'Plain', persona: '' })
    const assembly = await ctx.systemPrompt.assemble()
    expect(assembly.sections.find(one => one.name === BOT_PERSONA_SECTION)?.text).toBe('You are Plain.')
  })
})

/** The projection's own fold, named so a call reads as one rather than as `Function.apply`. */
const fold = botProjectionDefinition.apply

describe('what the session log holds', () => {
  it('starts at nobody and takes the bot the engagement event named', () => {
    const engaged: EngagedBot = { bot: 'triage', displayName: 'Triage', persona: 'You answer briefly.' }
    expect(botProjectionDefinition.init()).toBeNull()
    expect(fold(null, engagedEvent(engaged) as never)).toEqual(engaged)
    expect(botProjectionDefinition.wire.view(engaged)).toEqual(engaged)
  })

  it('keeps the character the session ran with when another event follows', () => {
    const engaged: EngagedBot = { bot: 'triage', displayName: 'Triage', persona: 'You answer briefly.' }
    // Any other event leaves it alone: the engagement is a creation-time
    // fact for this conversation, and rewriting the roster later must not
    // rewrite what this one ran under.
    const other = { type: 'assistant/message', seq: 2, time: 2, data: {} }
    expect(fold(engaged, other as never)).toEqual(engaged)
  })

  it('validates what it stores, so a malformed row is not read back as a character', () => {
    expect(botProjectionDefinition.stateSchema.safeParse(null).success).toBe(true)
    expect(botProjectionDefinition.stateSchema.safeParse({
      bot: 'triage', displayName: 'Triage', persona: '',
    }).success).toBe(true)
    expect(botProjectionDefinition.stateSchema.safeParse({ bot: 'triage' }).success).toBe(false)
  })

  it('is registered by the roster, so a deployment with bots projects them', async () => {
    await bench()
    expect(registeredProjections.map(one => one.key)).toContain('bot')
  })
})
