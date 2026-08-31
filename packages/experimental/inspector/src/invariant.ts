/** Package-owned invariant companion for the experimental Inspector. */

import type { Context } from '@lyness/cordis'
import type { InvariantInstaller } from '@lyness/invariants'

const PACKAGE_NAME = '@lyness/experimental-inspector'

/** Cordis companion plugin name. */
export const name = 'experimental-inspector-invariant'

/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: wire parsing, generations, Worker lifecycle, and CDP
 * sessions reject invalid relationships in their owning operations.
 */
const install: InvariantInstaller = () => {}

/** Register this package's invariant companion. */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
