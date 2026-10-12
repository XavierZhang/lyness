/**
 * The LSP module's preset contribution.
 *
 * The registry and its local-server provider are Host rows: a language server
 * is started per workspace and shared by every agent working in it, so one
 * process owns them. Only the query tools are per-agent, which is the same
 * split durable memory uses.
 *
 * A deployment supplies the server commands, so every row of this module ships
 * disabled; the tools are useless without a provider behind them, and the
 * provider cannot be guessed. Enabling the tools alone leaves calls that fail
 * in the session rather than at the boot that composed them.
 *
 * This lives beside the registry rather than in the module bundle so that the
 * plugin name a patch references resolves wherever the registry does: a bundle
 * that names itself as a plugin has to be resolvable as a module too, which a
 * patch-carrying bundle otherwise never needs to be.
 *
 * @module @lyness/lyn-lsp/preset-contribution
 */

import type { Context } from '@lyness/cordis'
import z from '@lyness/schemastery'
import type {} from '@lyness/lyn-agent-preset-registry'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'lsp-preset-contribution'

/** The preset registry this plugin contributes to. */
export const inject = ['agentPresets']

/** The module this contribution belongs to, named in a collision diagnostic. */
export const MODULE = '@lyness/lyn-module-lsp'

/** The centrally allocated row id the contributed tools take. */
export const ROW_ID = 'module-lsp-tool'

/** Rendered locations before an omission marker; the tool's own default. */
const DEFAULT_MAX_LOCATIONS = 100

/** Complete rendered result in characters, including truncation metadata. */
const DEFAULT_MAX_RESULT_CHARS = 16_000

/** Tool-call timeout budget in milliseconds. */
const DEFAULT_TIMEOUT_MS = 60_000

/**
 * Deployment-owned result bounds for the contributed tools.
 *
 * These reach `lyn-tool-lsp` as its row config. They are carried here because
 * a contributed row has no id in any patch layer a deployment can target, so
 * this plugin's config is the only place a deployment can set them.
 */
export interface Config {
  /** Rendered locations before an omission marker. Defaults to 100. */
  maxLocations?: number
  /** Complete rendered result in characters, including truncation metadata. Defaults to 16000. */
  maxResultChars?: number
  /** Tool-call timeout budget in milliseconds. Defaults to 60000. */
  timeoutMs?: number
}

export const Config: z<Config> = z.object({
  maxLocations: z.number().step(1).min(1).max(10_000).default(DEFAULT_MAX_LOCATIONS),
  maxResultChars: z.number().step(1).min(1_000).max(200_000).default(DEFAULT_MAX_RESULT_CHARS),
  timeoutMs: z.number().step(1).min(1_000).max(600_000).default(DEFAULT_TIMEOUT_MS),
})

/** Resolved result bounds, with every default already applied. */
export interface ResolvedConfig {
  /** Rendered locations before an omission marker. */
  readonly maxLocations: number
  /** Complete rendered result in characters. */
  readonly maxResultChars: number
  /** Tool-call timeout budget in milliseconds. */
  readonly timeoutMs: number
}

/**
 * Apply the defaults for a config a caller supplied without the Loader's
 * schema validation.
 * @param config - validated or hand-built configuration.
 * @returns the bounds the contributed row carries.
 */
export function resolveConfig(config: Config): ResolvedConfig {
  return {
    maxLocations: config.maxLocations ?? DEFAULT_MAX_LOCATIONS,
    maxResultChars: config.maxResultChars ?? DEFAULT_MAX_RESULT_CHARS,
    timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  }
}

/**
 * Contribute the LSP query tools to every preset that accepts rows.
 *
 * The contribution is awaited before it becomes this plugin's effect, because
 * registering it rebuilds the accepting presets: handing `ctx.effect` an
 * unawaited promise would let the plugin report ready while those presets were
 * still mounting.
 * @param ctx - context providing the preset registry.
 * @param config - validated result bounds.
 */
export async function apply(ctx: Context, config: Config): Promise<void> {
  const withdraw = await ctx.agentPresets.contribute({
    id: ROW_ID,
    module: MODULE,
    row: { name: '@lyness/lyn-tool-lsp', config: resolveConfig(config) },
  })
  ctx.effect(() => withdraw)
}
