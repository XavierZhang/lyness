/**
 * The accounts module's teammate-tool contribution: what it hands the
 * registry, and that it withdraws on disposal.
 *
 * What the tools then do is pinned in `tool.spec.ts` against the real
 * registry; what is owned here is the payload and the effect, so this records
 * the allocated id and row the registry is asked to merge.
 */

import { Context } from '@deepseek-ai/cordis'
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

it('contributes the teammate tools under the allocated row id', async () => {
  const { ctx, recorded } = recording()

  await ctx.plugin(PresetContribution).await()

  expect(recorded.contributions).toEqual([{
    id: 'module-accounts-bot-ask',
    module: '@deepseek-ai/dsh-module-accounts',
    row: { name: '@deepseek-ai/dsh-bot-ask/tool' },
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
  expect(PresetContribution.MODULE).toBe('@deepseek-ai/dsh-module-accounts')
  expect(PresetContribution.ROW_ID).toBe('module-accounts-bot-ask')
  expect(PresetContribution.name).toBe('bot-ask-preset-contribution')
  expect(PresetContribution.inject).toEqual(['agentPresets'])
})
