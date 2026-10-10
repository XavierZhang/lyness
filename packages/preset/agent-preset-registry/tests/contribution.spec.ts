/**
 * Rows contributed by module bundles: which presets accept them, the order
 * they take, what a collision does, and what happens to a preset that already
 * mounted when one arrives.
 */

import type { Context } from '@lyness/cordis'
import { expect, it, onTestFinished } from 'vitest'
import { CONTRIBUTION_ORDERS, isContributionId, mergeContributions } from '../src/contribution.ts'
import type { ContributionId, PresetContribution } from '../src/contribution.ts'
import { harness, plugin } from './harness.ts'

/** One contribution of the fixture plugin, under an allocated id. */
function contributed(id: ContributionId, module: string, tool: string): PresetContribution {
  return { id, module, row: { name: plugin('contribute'), config: { tool } } }
}

it('allocates an order only for ids the central table names', () => {
  expect(isContributionId('module-memory-tools')).toBe(true)
  expect(isContributionId('whatever-a-module-invents')).toBe(false)
  // The table is the allocation; two ids must not share a position.
  const orders = Object.values(CONTRIBUTION_ORDERS)
  expect(new Set(orders).size).toBe(orders.length)
})

it('places contributions after the declared rows, in allocated order', () => {
  const declared = [{ id: 'persona', name: 'persona' }]
  const merged = mergeContributions(declared, [
    contributed('module-lsp-tool', 'module-lsp', 'lsp'),
    contributed('module-memory-tools', 'module-memory', 'memory'),
  ])
  // Registration order was lsp-then-memory; the allocation reverses it.
  expect(merged.map(row => row.id)).toEqual(['persona', 'module-memory-tools', 'module-lsp-tool'])
})

it('refuses two modules claiming one row id and names both', () => {
  expect(() => mergeContributions([], [
    contributed('module-memory-tools', 'module-memory', 'one'),
    contributed('module-memory-tools', 'module-other', 'two'),
  ])).toThrow('claimed by both module-memory and module-other')
})

it('refuses a contribution that collides with a row the preset declares', () => {
  expect(() => mergeContributions(
    [{ id: 'module-memory-tools', name: 'already-here' }],
    [contributed('module-memory-tools', 'module-memory', 'one')],
  )).toThrow('collides with a row the preset declares')
})

it('contributes nothing when no preset accepts it', () => {
  expect(mergeContributions([{ id: 'persona', name: 'persona' }], [])).toEqual([{ id: 'persona', name: 'persona' }])
})

it('reaches a preset that accepts contributions and leaves the others alone', async () => {
  const ctx = await harness()
  onTestFinished(() => ctx.fiber.dispose())
  await ctx.plugin({
    inject: ['agentPresets'],
    async* apply(child: Context) {
      yield await child.agentPresets.register({
        id: 'work', acceptsContributions: true, plugins: [{ name: plugin('contribute'), config: { tool: 'declared' } }],
      })
    },
  })
  await ctx.plugin({
    inject: ['agentPresets'],
    async* apply(child: Context) {
      yield await child.agentPresets.register({
        id: 'standard', plugins: [{ name: plugin('contribute'), config: { tool: 'declared' } }],
      })
    },
  })

  // The contribution lands after both presets have already mounted, which is
  // the ordinary case: a module bundle loads after the surface bundle.
  const dispose = await ctx.agentPresets.contribute(contributed('module-memory-tools', 'module-memory', 'contributed'))

  const rowsOf = async (id: string): Promise<(string | null)[]> => {
    const inventory = await ctx.agentPresets.compositionInventory()
    return inventory.find(entry => entry.id === id)?.rows.map(row => row.entryId) ?? []
  }
  expect(await rowsOf('work')).toContain('module-memory-tools')
  expect(await rowsOf('standard')).not.toContain('module-memory-tools')

  await dispose()
  expect(await rowsOf('work')).not.toContain('module-memory-tools')
})

it('refuses a row id with no allocated order', async () => {
  const ctx = await harness()
  onTestFinished(() => ctx.fiber.dispose())
  await expect(ctx.agentPresets.contribute({
    id: 'not-allocated' as ContributionId, module: 'module-rogue', row: { name: plugin('contribute') },
  })).rejects.toThrow('no allocated order')
})

it('contributes to an accepting preset that never activated, and withdraws once', async () => {
  const ctx = await harness()
  onTestFinished(() => ctx.fiber.dispose())
  await ctx.plugin({
    inject: ['agentPresets'],
    async* apply(child: Context) {
      // A declaration whose rows cannot mount has no generation to retire, so
      // a contribution must not assume one exists.
      yield await child.agentPresets.register({
        id: 'work', acceptsContributions: true, plugins: [{ name: 'cordis:missingBuiltin' }],
      })
    },
  })

  const dispose = await ctx.agentPresets.contribute(contributed('module-lsp-tool', 'module-lsp', 'lsp'))
  const inventory = await ctx.agentPresets.compositionInventory()
  expect(inventory.find(entry => entry.id === 'work')?.broken).not.toBeUndefined()

  await dispose()
  // The disposer is idempotent: a second call withdraws nothing again.
  await dispose()
})
