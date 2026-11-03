/**
 * The deliverables module's preset contribution.
 *
 * The module's Host half records what each turn changed; this half is the
 * `present` tool, which is per-agent because a declaration belongs to the
 * agent that made it.
 *
 * Only presets that accept contributions take the tool this way. The four
 * official modes declare `@lyness/lyn-tool-present` as a row of their own, as
 * upstream ships them, and keep it: a contribution reaching them would be a
 * second row registering one tool name. So the standard, PTC, and creator
 * modes carry the declared row while the view defaults carry this
 * contribution, and every preset ends with exactly one.
 *
 * This lives beside the tool rather than in the module bundle so that the
 * plugin name a patch references resolves wherever the tool does: a bundle
 * that names itself as a plugin has to be resolvable as a module too, which a
 * patch-carrying bundle otherwise never needs to be.
 *
 * @module @lyness/lyn-tool-present/preset-contribution
 */

import type { Context } from '@lyness/cordis'
import type {} from '@lyness/lyn-agent-preset-registry'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'deliverables-preset-contribution'

/** The preset registry this plugin contributes to. */
export const inject = ['agentPresets']

/** The module this contribution belongs to, named in a collision diagnostic. */
export const MODULE = '@lyness/lyn-module-deliverables'

/** The centrally allocated row id the contributed tool takes. */
export const ROW_ID = 'module-deliverables-tool'

/**
 * Contribute the `present` tool to every preset that accepts rows.
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
    row: { name: '@lyness/lyn-tool-present' },
  })
  ctx.effect(() => withdraw)
}
