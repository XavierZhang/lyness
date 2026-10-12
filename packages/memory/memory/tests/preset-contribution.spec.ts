/**
 * The memory module's preset contribution: what it hands the registry, and
 * that it withdraws on disposal.
 *
 * The real composition — these tools reaching an agent's catalog through an
 * accepting preset — is pinned by the Web `work` preset snapshot, which boots
 * the shipped bundles. What is owned here is the payload and the effect, so
 * this records the allocated id and row the registry is asked to merge.
 */

import { Context } from '@lyness/cordis'
import { expect, it } from 'vitest'
import * as PresetContribution from '../src/preset-contribution.ts'

/** One recorded `contribute` call and whether its withdrawal ran. */
interface Recorded {
  readonly contributions: unknown[]
  withdrawals: number
}

/** A context whose preset registry only records what it is handed. */
function recording(): { ctx: Context; recorded: Recorded } {
  const recorded: Recorded = { contributions: [], withdrawals: 0 }
  const ctx = new Context()
  ctx.provide('agentPresets', {
    contribute: (contribution: unknown) => {
      recorded.contributions.push(contribution)
      return Promise.resolve(async () => {
        recorded.withdrawals += 1
        await Promise.resolve()
      })
    },
  })
  return { ctx, recorded }
}

it('contributes the memory tools under the allocated row id', async () => {
  const { ctx, recorded } = recording()

  await ctx.plugin(PresetContribution).await()

  expect(recorded.contributions).toEqual([{
    id: 'module-memory-tools',
    module: '@lyness/lyn-module-memory',
    row: { name: '@lyness/lyn-memory/tools' },
  }])
})

it('withdraws the contribution when its fiber is disposed', async () => {
  const { ctx, recorded } = recording()
  const fiber = await ctx.plugin(PresetContribution).await()
  expect(recorded.withdrawals).toBe(0)

  await fiber.dispose()

  expect(recorded.withdrawals).toBe(1)
})

it('names the module the registry reports in a collision', () => {
  // The diagnostic names the bundle a deployment would disable, not the
  // service package the row resolves through.
  expect(PresetContribution.MODULE).toBe('@lyness/lyn-module-memory')
  expect(PresetContribution.ROW_ID).toBe('module-memory-tools')
  expect(PresetContribution.name).toBe('memory-preset-contribution')
  expect(PresetContribution.inject).toEqual(['agentPresets'])
})
