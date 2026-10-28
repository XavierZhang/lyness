/**
 * The LSP module's preset contribution: the row it hands the registry, that
 * the result bounds stay deployment values, and that it withdraws on disposal.
 *
 * The module ships every row disabled because a deployment supplies the server
 * commands, so no shipped composition mounts this plugin. What is owned here is
 * the contributed row a deployment gets once it enables the module.
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

it('contributes the navigation tool under the allocated row id', async () => {
  const { ctx, recorded } = recording()

  await ctx.plugin(PresetContribution, {}).await()

  expect(recorded.contributions).toHaveLength(1)
  expect(recorded.contributions[0]).toMatchObject({
    id: 'module-lsp-tool',
    module: '@deepseek-ai/dsh-module-lsp',
    row: { name: '@deepseek-ai/dsh-tool-lsp' },
  })
})

it('carries the result bounds onto the contributed row', async () => {
  const { ctx, recorded } = recording()

  await ctx.plugin(PresetContribution, { maxLocations: 7, maxResultChars: 2_000, timeoutMs: 5_000 }).await()

  // A contributed row has no id a patch layer can target, so this plugin's
  // config is the only place a deployment can set these.
  expect((recorded.contributions[0]?.row as { config: unknown }).config)
    .toEqual({ maxLocations: 7, maxResultChars: 2_000, timeoutMs: 5_000 })
})

it('applies the documented defaults when a deployment sets none', () => {
  // Through the Loader the schema supplies these; the resolve step owns them
  // for a caller that builds the config by hand.
  expect(PresetContribution.resolveConfig({}))
    .toEqual({ maxLocations: 100, maxResultChars: 16_000, timeoutMs: 60_000 })
  expect(PresetContribution.resolveConfig({ maxLocations: 3 }))
    .toEqual({ maxLocations: 3, maxResultChars: 16_000, timeoutMs: 60_000 })
})

it('withdraws the contribution when its fiber is disposed', async () => {
  const { ctx, recorded } = recording()
  const fiber = await ctx.plugin(PresetContribution, {}).await()
  expect(recorded.withdrawals).toBe(0)

  await fiber.dispose()

  expect(recorded.withdrawals).toBe(1)
})

it('names the module the registry reports in a collision', () => {
  // The diagnostic names the bundle a deployment would disable, not the
  // package the row resolves through.
  expect(PresetContribution.MODULE).toBe('@deepseek-ai/dsh-module-lsp')
  expect(PresetContribution.ROW_ID).toBe('module-lsp-tool')
  expect(PresetContribution.name).toBe('lsp-preset-contribution')
  expect(PresetContribution.inject).toEqual(['agentPresets'])
})
