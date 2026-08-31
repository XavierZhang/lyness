/**
 * Package-owned invariant companion for `@lyness/client-ui-user-questions`.
 * @module @lyness/client-ui-user-questions/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@lyness/cordis'
import type { InvariantInstaller } from '@lyness/invariants'

const PACKAGE_NAME = '@lyness/client-ui-user-questions'

/** Cordis companion plugin name. */
export const name = 'client-ui-user-questions-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: tool and slot registrations are effects
 * owned and observed by their respective registries; the host pending table is
 * exercised through the public wire protocol.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns The installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
