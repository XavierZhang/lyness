/**
 * The deliverables module's preset contribution: the row it hands the
 * registry, and that it withdraws on disposal.
 *
 * Only presets that accept contributions take `present` this way; the four
 * official modes keep their own declared row, which is why no assertion here
 * expects the contribution to reach every preset.
 */

import { Context } from '@deepseek-ai/cordis'
import { expect, it } from 'vitest'
import * as PresetContribution from '../src/preset-contribution.ts'

/** One recorded `contribute` call and whether its withdrawal ran. */
interface Recorded {
  readonly contributions: { id: string; module: string; row: unknown }[]
  withdrawals: number
}

/** A context whose preset registry only records what it is handed. */
function recording(): { ctx: Context; recorded: Recorded } {
  const recorded: Recorded = { contributions: [], withdrawals: 0 }
  const ctx = new Context()
  ctx.provide('agentPresets', {
    contribute: (contribution: { id: string; module: string; row: unknown }) => {
      recorded.contributions.push(contribution)
      return Promise.resolve(async () => {
        recorded.withdrawals += 1
        await Promise.resolve()
      })
    },
  })
  return { ctx, recorded }
}

it('contributes the present tool under the allocated row id', async () => {
  const { ctx, recorded } = recording()

  await ctx.plugin(PresetContribution).await()

  expect(recorded.contributions).toEqual([{
    id: 'module-deliverables-tool',
    module: '@deepseek-ai/dsh-module-deliverables',
    row: { name: '@deepseek-ai/dsh-tool-present' },
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
  // package the row resolves through.
  expect(PresetContribution.MODULE).toBe('@deepseek-ai/dsh-module-deliverables')
  expect(PresetContribution.ROW_ID).toBe('module-deliverables-tool')
  expect(PresetContribution.name).toBe('deliverables-preset-contribution')
  expect(PresetContribution.inject).toEqual(['agentPresets'])
})
