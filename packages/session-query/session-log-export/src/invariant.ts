/** Package invariant companion for `@lyness/session-log-export`. */

/* jscpd:ignore-start */
import type { Context } from '@lyness/cordis'
import type { InvariantInstaller } from '@lyness/invariants'

const PACKAGE_NAME = '@lyness/session-log-export'

export const name = 'session-export-invariant'
export const inject = ['invariants']

/**
 * No runtime invariant: Connection and the command registry own both
 * registrations, while each export reads authoritative Session services.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Host context carrying the invariant registry.
 * @returns the registration disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
