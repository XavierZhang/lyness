/**
 * The section's wiring: where it registers, the store it declares, its own
 * locale namespace, and that nothing is read until the section opens.
 */

import { Context } from '@lyness/cordis'
import { describe, expect, it, vi } from 'vitest'
import { SlotRegistry } from '@lyness/lyn-client-ui-renderer/client'
import { LocaleRuntime } from '@lyness/lyn-client-locale/client'
import { TestRemote } from '@lyness/lyn-client-test-runtime'
import type { AgentCapabilitiesView } from '@lyness/lyn-api-agent-capabilities-controller/types'
import type { ModelCatalog } from '@lyness/lyn-api-session-controller/types'
import { apply, capabilitiesCallsOf, inject, NS } from '@lyness/lyn-client-ui-settings-capabilities/client'
import { CapabilitiesSection } from '../src/client/CapabilitiesSection.tsx'
import type { createCapabilitiesSectionStore } from '../src/client/store.ts'

const SLOT = 'settings.section'

const VIEW: AgentCapabilitiesView = {
  preset: 'coder',
  tools: [{ name: 'bash', description: 'Run a command.', source: 'deployment' }],
  connections: [{ server: 'acme', tools: 2, source: 'preset' }],
  skills: [{ name: 'badge', description: 'Does badge.', origin: 'bundled', provider: 'filesystem' }],
}

const CATALOG: ModelCatalog = {
  default: { provider: 'deepseek-official', model: 'v4' },
  routableProviders: ['deepseek-official'],
  groups: [{ id: 'deepseek-official', name: 'DeepSeek', models: [{ id: 'v4', name: 'V4' }] }],
  failures: [],
}

/** A context with the slot registry, a locale, and the section mounted. */
async function bench(
  describeCall: () => Promise<unknown> = () => Promise.resolve({ ok: true, value: VIEW }),
  modelCatalog: () => Promise<unknown> = () => Promise.resolve({ ok: true, value: CATALOG }),
) {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  locale.setLocale('zh')
  ctx.provide('locale', locale)
  const events = new TestRemote(ctx, {
    agentCapabilities: { describe: describeCall },
    session: { modelCatalog },
  })
  events.$host = { home: undefined, isLoopback: true }
  const slots = ctx.get('slots') as SlotRegistry
  const declared = slots.register(
    { name: 'root', children: { [SLOT]: { kind: 'list', scope: 'root' } } } as never,
    () => null,
  )
  const fiber = ctx.plugin({ inject: [...inject], apply })
  await fiber.await()
  return { ctx, slots, locale, declared, fiber }
}

/** The store handle this section registered. */
type Handle = ReturnType<typeof createCapabilitiesSectionStore>

/** The slot entry this section registered. */
function entryOf(slots: SlotRegistry) {
  const entry = slots.entries(SLOT).find(one => one.component === CapabilitiesSection)
  if (entry === undefined) throw new Error('the capabilities section did not register')
  return entry
}

describe('ui-settings-capabilities apply', () => {
  it('registers last in the personal plane', async () => {
    const { slots } = await bench()
    expect(entryOf(slots).options).toMatchObject({ id: 'capabilities', order: 30 })
  })

  it('names itself in the navigation with its own copy', async () => {
    const { slots, locale } = await bench()
    const label = entryOf(slots).options.label
    expect(typeof label === 'function' ? label() : label).toBe('你可以用什么')
    expect(locale.bind(NS)('title')).toBe('你的 agent 可以用什么')
  })

  it('reads nothing until the section opens', async () => {
    const describeCall = vi.fn(() => Promise.resolve({ ok: true as const, value: VIEW }))
    await bench(describeCall)
    expect(describeCall).not.toHaveBeenCalled()
  })

  it('reads both namespaces the page joins', async () => {
    const describeCall = vi.fn(() => Promise.resolve({ ok: true as const, value: VIEW }))
    const { ctx } = await bench(describeCall)
    const calls = capabilitiesCallsOf(ctx)
    expect(await calls.capabilities()).toEqual({ ok: true, value: VIEW })
    expect(await calls.models()).toEqual({ ok: true, value: CATALOG })
    expect(describeCall).toHaveBeenCalledOnce()
  })

  it('declares a store the section reads through', async () => {
    const { slots } = await bench()
    const handle = entryOf(slots).store as Handle
    expect(handle.create().store.getSnapshot()).toEqual({
      status: 'idle', capabilities: undefined, models: undefined,
    })
  })

  it('declares a store whose writes move the read through its states', async () => {
    const { slots } = await bench()
    const instance = (entryOf(slots).store as Handle).create()
    instance.actions.begin()
    expect(instance.store.getSnapshot().status).toBe('loading')
    instance.actions.succeed({ capabilities: VIEW, models: CATALOG })
    expect(instance.store.getSnapshot()).toMatchObject({ status: 'ready', capabilities: VIEW, models: CATALOG })
    instance.actions.fail()
    expect(instance.store.getSnapshot().status).toBe('failed')
    instance.actions.reset()
    expect(instance.store.getSnapshot().status).toBe('idle')
  })

  it('stops offering the section when its plugin is unloaded', async () => {
    const { slots, fiber } = await bench()
    expect(slots.entries(SLOT).filter(one => one.component === CapabilitiesSection)).toHaveLength(1)
    await fiber.dispose()
    expect(slots.entries(SLOT).filter(one => one.component === CapabilitiesSection)).toHaveLength(0)
  })
})
