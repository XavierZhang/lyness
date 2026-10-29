/**
 * The section's wiring: where it registers, the store it declares, its own
 * locale namespace, and that nothing is read until the section opens.
 *
 * The calls' own behaviour is pinned in `operations.client.spec.ts`, against
 * the operations directly, so this spec never reaches into the framework's
 * type-erased inject factory.
 */

import { Context } from '@lyness/cordis'
import { describe, expect, it, vi } from 'vitest'
import { SlotRegistry } from '@lyness/lyn-client-ui-renderer/client'
import { LocaleRuntime } from '@lyness/lyn-client-locale/client'
import { TestRemote } from '@lyness/lyn-client-test-runtime'
import type { BotRowView, PresetOptionView, TeamRowView } from '@lyness/lyn-api-bots-controller/types'
import { apply, botsCallsOf, inject, NS, startingBotConversation } from '@lyness/lyn-client-ui-settings-bots/client'
import { BotsSection } from '../src/client/BotsSection.tsx'
import type { createBotsSectionStore } from '../src/client/store.ts'

const SLOT = 'settings.administration.section'

const BOT: BotRowView = {
  id: 'triage',
  displayName: 'Triage',
  organization: 'acme',
  persona: 'You answer in short sentences.',
  job: 'Reads incoming reports and files them.',
  preset: 'standard',
  written: false,
  available: true,
}

const PRESET: PresetOptionView = { id: 'standard', displayName: 'Standard' }

const TEAM: TeamRowView = {
  id: 'intake',
  displayName: 'Intake',
  organization: 'acme',
  members: ['triage'],
  written: false,
}

/** A context with the slot registry, a locale, and the section mounted. */
async function bench(list: () => Promise<unknown> = () => Promise.resolve({ ok: true, value: [BOT] })) {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  locale.setLocale('zh')
  ctx.provide('locale', locale)
  const events = new TestRemote(ctx, {
    bots: {
      list,
      presets: () => Promise.resolve({ ok: true, value: [PRESET] }),
      save: () => Promise.resolve({ ok: true, value: BOT }),
      remove: () => Promise.resolve({ ok: true, value: undefined }),
      teams: () => Promise.resolve({ ok: true, value: [TEAM] }),
      saveTeam: () => Promise.resolve({ ok: true, value: TEAM }),
      removeTeam: () => Promise.resolve({ ok: true, value: undefined }),
    },
  })
  events.$host = { home: undefined, isLoopback: true }
  // A conversation with a bot is started through the Workspace navigation,
  // the way every other new session is.
  const started: { bot?: string }[] = []
  ctx.provide('uiWorkspace', {
    startSession: (_workspaceId: unknown, options: { bot?: string } = {}) => { started.push(options) },
  } as never)
  const slots = ctx.get('slots') as SlotRegistry
  const declared = slots.register(
    { name: 'root', children: { [SLOT]: { kind: 'list', scope: 'root' } } } as never,
    () => null,
  )
  const fiber = ctx.plugin({ inject: [...inject], apply })
  await fiber.await()
  return { ctx, slots, locale, declared, fiber, started }
}

/** The store handle this section registered. */
type Handle = ReturnType<typeof createBotsSectionStore>

/** The slot entry this section registered. */
function entryOf(slots: SlotRegistry) {
  const entry = slots.entries(SLOT).find(one => one.component === BotsSection)
  if (entry === undefined) throw new Error('the bots section did not register')
  return entry
}

describe('ui-settings-bots apply', () => {
  it('registers after the people section', async () => {
    const { slots } = await bench()
    // A bot holds a standing in the same roster, so who the deployment's
    // people are is read before what it runs on their behalf.
    expect(entryOf(slots).options).toMatchObject({ id: 'bots', order: 40 })
  })

  it('names itself in the navigation with its own copy', async () => {
    const { slots, locale } = await bench()
    const label = entryOf(slots).options.label
    expect(typeof label === 'function' ? label() : label).toBe('机器人')
    expect(locale.bind(NS)('title')).toBe('机器人')
  })

  it('reads nothing until the section opens', async () => {
    const list = vi.fn(() => Promise.resolve({ ok: true as const, value: [BOT] }))
    await bench(list)
    expect(list).not.toHaveBeenCalled()
  })

  it('reads and changes through the Remote namespace the deployment answers on', async () => {
    const list = vi.fn(() => Promise.resolve({ ok: true as const, value: [BOT] }))
    const { ctx } = await bench(list)
    const calls = botsCallsOf(ctx)
    expect(await calls.list()).toEqual({ ok: true, value: [BOT] })
    expect(await calls.presets()).toEqual({ ok: true, value: [PRESET] })
    expect(await calls.save({ displayName: 'Triage', organization: 'acme', persona: '', job: '', preset: 'standard' }))
      .toEqual({ ok: true, value: BOT })
    expect(await calls.remove('triage')).toEqual({ ok: true, value: undefined })
    expect(await calls.teams()).toEqual({ ok: true, value: [TEAM] })
    expect(await calls.saveTeam({ displayName: 'Intake', organization: 'acme', members: ['triage'] }))
      .toEqual({ ok: true, value: TEAM })
    expect(await calls.removeTeam('intake')).toEqual({ ok: true, value: undefined })
    expect(list).toHaveBeenCalledOnce()
  })

  it('declares a store the section reads through', async () => {
    const { slots } = await bench()
    const handle = entryOf(slots).store as Handle
    expect(handle.create().store.getSnapshot()).toEqual({
      status: 'idle', bots: [], presets: [], teams: [], working: false, outcome: undefined,
    })
  })

  it('declares a store whose writes move the read through its states', async () => {
    const { slots } = await bench()
    const instance = (entryOf(slots).store as Handle).create()
    instance.actions.begin()
    expect(instance.store.getSnapshot().status).toBe('loading')
    instance.actions.succeed({ bots: [BOT], presets: [PRESET], teams: [TEAM] })
    expect(instance.store.getSnapshot())
      .toMatchObject({ status: 'ready', bots: [BOT], presets: [PRESET], teams: [TEAM] })
    instance.actions.fail('forbidden')
    expect(instance.store.getSnapshot().status).toBe('forbidden')
    instance.actions.reset()
    expect(instance.store.getSnapshot().status).toBe('idle')
  })

  it('replaces a renamed bot in place rather than listing it twice', async () => {
    const { slots } = await bench()
    const instance = (entryOf(slots).store as Handle).create()
    instance.actions.succeed({ bots: [BOT], presets: [PRESET], teams: [TEAM] })
    instance.actions.work()
    instance.actions.saved({ ...BOT, displayName: 'Intake' })
    expect(instance.store.getSnapshot().bots).toEqual([{ ...BOT, displayName: 'Intake' }])

    instance.actions.saved({ ...BOT, id: 'scribe', displayName: 'Scribe' })
    expect(instance.store.getSnapshot().bots).toHaveLength(2)

    instance.actions.saved({ ...BOT, id: 'scribe', displayName: 'Minutes' })
    expect(instance.store.getSnapshot().bots.map(one => one.displayName)).toEqual(['Intake', 'Minutes'])
  })

  it('drops a removed bot, and keeps the fields a refusal named', async () => {
    const { slots } = await bench()
    const instance = (entryOf(slots).store as Handle).create()
    instance.actions.succeed({ bots: [BOT], presets: [PRESET], teams: [TEAM] })
    instance.actions.work()
    instance.actions.removed('triage')
    expect(instance.store.getSnapshot()).toMatchObject({ working: false, bots: [], outcome: { kind: 'removed' } })

    instance.actions.work()
    expect(instance.store.getSnapshot().outcome).toBeUndefined()
    instance.actions.refused({ reason: 'needs an organization', fields: ['organization'] })
    expect(instance.store.getSnapshot()).toMatchObject({
      working: false, outcome: { kind: 'refused', reason: 'needs an organization', fields: ['organization'] },
    })
  })

  it('starts a bot conversation through the Workspace navigation', async () => {
    const { ctx, started } = await bench()
    startingBotConversation(ctx)('triage')
    // Started rather than created here, so it lands in the Workspace the
    // reader is in and opens the way every other new session does.
    expect(started).toEqual([{ bot: 'triage' }])
  })

  it('replaces a renamed team in place, and drops a removed one', async () => {
    const { slots } = await bench()
    const instance = (entryOf(slots).store as Handle).create()
    instance.actions.succeed({ bots: [BOT], presets: [PRESET], teams: [TEAM] })
    instance.actions.work()
    instance.actions.teamSaved({ ...TEAM, displayName: 'Front desk' })
    expect(instance.store.getSnapshot().teams).toEqual([{ ...TEAM, displayName: 'Front desk' }])

    instance.actions.teamSaved({ ...TEAM, id: 'review', displayName: 'Review' })
    expect(instance.store.getSnapshot().teams).toHaveLength(2)

    // Replacing one of several keeps the others in place.
    instance.actions.teamSaved({ ...TEAM, id: 'review', displayName: 'Weekly review' })
    expect(instance.store.getSnapshot().teams.map(one => one.displayName)).toEqual(['Front desk', 'Weekly review'])

    instance.actions.teamRemoved('review')
    expect(instance.store.getSnapshot())
      .toMatchObject({ working: false, teams: [{ ...TEAM, displayName: 'Front desk' }], outcome: { kind: 'team-removed' } })
  })

  it('stops offering the section when its plugin is unloaded', async () => {
    const { slots, fiber } = await bench()
    expect(slots.entries(SLOT).filter(one => one.component === BotsSection)).toHaveLength(1)
    await fiber.dispose()
    expect(slots.entries(SLOT).filter(one => one.component === BotsSection)).toHaveLength(0)
  })
})
