/** Package-owned invariant companion. @module @lyness/api-workspace-controller/invariant */

/* jscpd:ignore-start */
import type { Context } from '@lyness/cordis'
import type { InvariantInstaller } from '@lyness/invariants'

const PACKAGE_NAME = '@lyness/api-workspace-controller'

/** Cordis companion plugin name. */
export const name = 'api-workspace-controller-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/** No runtime invariant: Workspace Registry owns persistence; every stream generation is a full projection. */
const install: InvariantInstaller = () => {}

/** Register this package's invariant companion. */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
