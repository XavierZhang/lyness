/**
 * The memory module's preset contribution.
 *
 * The service mounts as an ordinary Host row. Its model-facing write tools
 * cannot be a row in the same patch, because they belong inside a preset whose
 * whole row list a patch would have to restate, so they are contributed
 * instead and the registry merges them.
 *
 * This lives beside the service rather than in the module bundle so that the
 * plugin name a patch references resolves wherever the service does: a bundle
 * that names itself as a plugin has to be resolvable as a module too, which a
 * patch-carrying bundle otherwise never needs to be.
 *
 * @module @lyness/lyn-memory/preset-contribution
 */

import type { Context } from '@lyness/cordis'
import type {} from '@lyness/lyn-agent-preset-registry'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'memory-preset-contribution'

/** The preset registry this plugin contributes to. */
export const inject = ['agentPresets']

/** The module this contribution belongs to, named in a collision diagnostic. */
export const MODULE = '@lyness/lyn-module-memory'

/** The centrally allocated row id the contributed tools take. */
export const ROW_ID = 'module-memory-tools'

/**
 * Contribute the memory write tools to every preset that accepts rows.
 *
 * The contribution is awaited before it becomes this plugin's effect, because
 * registering it rebuilds the accepting presets: handing `ctx.effect` an
 * unawaited promise would let the plugin report ready while those presets were
 * still mounting.
 * @param ctx - context providing the preset registry.
 */
export async function apply(ctx: Context): Promise<void> {
  const withdraw = await ctx.agentPresets.contribute({
    id: ROW_ID,
    module: MODULE,
    row: { name: '@lyness/lyn-memory/tools' },
  })
  ctx.effect(() => withdraw)
}
