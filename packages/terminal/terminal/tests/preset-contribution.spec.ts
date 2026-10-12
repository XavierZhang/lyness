/**
 * The terminal module's preset contribution: the group it hands the registry,
 * that the shell timeout stays a deployment value, and that it withdraws on
 * disposal.
 *
 * The real composition — these tools reaching an agent's catalog through an
 * accepting preset — is pinned by the Web `work` preset snapshot, which boots
 * the shipped bundles. What is owned here is the contributed row.
 */

import { Context } from '@lyness/cordis'
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

/** One child row of the contributed group. */
interface ShellRow {
  id: string
  name: string
  disabled?: boolean
  config?: { timeoutMs?: number; shellDialect?: string }
}

/** The shell rows of one contributed group, by id. */
function shellRows(row: unknown): Record<string, ShellRow> {
  const children = (row as { config: ShellRow[] }).config
  return Object.fromEntries(children.map(child => [child.id, child]))
}

it('contributes the persistent shell group under the allocated row id', async () => {
  const { ctx, recorded } = recording()

  await ctx.plugin(PresetContribution, {}).await()

  expect(recorded.contributions).toHaveLength(1)
  const [contribution] = recorded.contributions
  expect(contribution?.id).toBe('module-terminal-tool')
  expect(contribution?.module).toBe('@lyness/lyn-module-terminal')
  // The group isolates terminals so one agent cannot read another's screen.
  expect(contribution?.row).toMatchObject({ name: 'cordis:group', group: true, isolate: { terminals: true } })
  expect(Object.keys(shellRows(contribution?.row))).toEqual(['pty', 'terminal-bash', 'terminal-pwsh', 'tool-terminal'])
})

it('mounts exactly one shell row for the running platform', () => {
  const rows = shellRows(PresetContribution.terminalGroup(1_000))

  // Both rows name the same plugin and differ only in dialect, so exactly one
  // may be enabled; two would open two shells for one agent.
  expect([rows['terminal-bash']?.disabled, rows['terminal-pwsh']?.disabled].filter(value => value !== true))
    .toHaveLength(1)
  expect(rows['terminal-pwsh']?.config?.shellDialect).toBe('pwsh')
})

it('carries the configured timeout to both shell rows', () => {
  const rows = shellRows(PresetContribution.terminalGroup(7_000))

  expect(rows['terminal-bash']?.config?.timeoutMs).toBe(7_000)
  expect(rows['terminal-pwsh']?.config?.timeoutMs).toBe(7_000)
})

it('applies the documented default when a deployment sets no timeout', async () => {
  const { ctx, recorded } = recording()

  await ctx.plugin(PresetContribution, {}).await()

  // Through the Loader the schema supplies the default; the resolve step owns
  // it for a caller that builds the config by hand.
  expect(shellRows(recorded.contributions[0]?.row)['terminal-bash']?.config?.timeoutMs).toBe(300_000)
  expect(PresetContribution.resolveTimeout({})).toBe(300_000)
  expect(PresetContribution.resolveTimeout({ timeoutMs: 5_000 })).toBe(5_000)
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
  // service package the row resolves through.
  expect(PresetContribution.MODULE).toBe('@lyness/lyn-module-terminal')
  expect(PresetContribution.ROW_ID).toBe('module-terminal-tool')
  expect(PresetContribution.name).toBe('terminal-preset-contribution')
  expect(PresetContribution.inject).toEqual(['agentPresets'])
})
