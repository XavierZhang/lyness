/**
 * The terminal module's preset contribution.
 *
 * Every row of this capability is per-agent: a terminal belongs to the agent
 * that opened it, and the group carries `isolate: { terminals: true }` so one
 * agent cannot read another's screen. There is no Host row to insert, which is
 * why this module contributes a whole group rather than a single tool row.
 *
 * This lives beside the service rather than in the module bundle so that the
 * plugin name a patch references resolves wherever the service does: a bundle
 * that names itself as a plugin has to be resolvable as a module too, which a
 * patch-carrying bundle otherwise never needs to be.
 *
 * @module @lyness/lyn-terminal/preset-contribution
 */

import type { Context } from '@lyness/cordis'
import z from '@lyness/schemastery'
import type {} from '@lyness/lyn-agent-preset-registry'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'terminal-preset-contribution'

/** The preset registry this plugin contributes to. */
export const inject = ['agentPresets']

/** The module this contribution belongs to, named in a collision diagnostic. */
export const MODULE = '@lyness/lyn-module-terminal'

/** The centrally allocated row id the contributed group takes. */
export const ROW_ID = 'module-terminal-tool'

/**
 * How long a shell row waits for one command before giving up, in
 * milliseconds.
 *
 * Carried as configuration because the right value follows what a deployment
 * runs: a build that compiles for minutes and an interactive shell on a
 * laptop do not share a ceiling.
 */
const DEFAULT_TIMEOUT_MS = 300_000

/** Deployment-owned shell behavior for the contributed group. */
export interface Config {
  /** Milliseconds one command may run before the shell row abandons it. Defaults to 300000. */
  timeoutMs?: number
}

export const Config: z<Config> = z.object({
  timeoutMs: z.number().step(1).min(1_000).max(3_600_000).default(DEFAULT_TIMEOUT_MS),
})

/**
 * Apply the default for a config a caller supplied without the Loader's
 * schema validation.
 * @param config - validated or hand-built configuration.
 * @returns the command timeout this contribution runs on.
 */
export function resolveTimeout(config: Config): number {
  return config.timeoutMs ?? DEFAULT_TIMEOUT_MS
}

/**
 * Contribute the persistent shell and its tool to every preset that accepts
 * rows.
 *
 * The contribution is awaited before it becomes this plugin's effect, because
 * registering it rebuilds the accepting presets: handing `ctx.effect` an
 * unawaited promise would let the plugin report ready while those presets were
 * still mounting.
 * @param ctx - context providing the preset registry.
 * @param config - validated shell behavior.
 */
export async function apply(ctx: Context, config: Config): Promise<void> {
  const withdraw = await ctx.agentPresets.contribute({
    id: ROW_ID,
    module: MODULE,
    row: terminalGroup(resolveTimeout(config)),
  })
  ctx.effect(() => withdraw)
}

/**
 * The persistent-shell group as one contributed row.
 *
 * Both shell rows name the same plugin and differ only in dialect, and each is
 * disabled on the platform the other serves, so exactly one mounts. Keeping
 * both rows rather than resolving the platform here is what lets a deployment
 * override either one by id from a later patch layer.
 * @param timeoutMs - command timeout handed to both shell rows.
 * @returns the group row, without the id the registry assigns.
 */
export function terminalGroup(timeoutMs: number): Parameters<Context['agentPresets']['contribute']>[0]['row'] {
  return {
    name: 'cordis:group',
    group: true,
    isolate: { terminals: true },
    config: [
      { id: 'pty', name: '@lyness/lyn-terminal' },
      {
        id: 'terminal-bash',
        name: '@lyness/lyn-terminal-bash',
        disabled: process.platform === 'win32',
        config: { timeoutMs },
      },
      {
        id: 'terminal-pwsh',
        name: '@lyness/lyn-terminal-bash',
        disabled: process.platform !== 'win32',
        config: { shellDialect: 'pwsh', timeoutMs },
      },
      { id: 'tool-terminal', name: '@lyness/lyn-tool-terminal' },
    ],
  }
}
