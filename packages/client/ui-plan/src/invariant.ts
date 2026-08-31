/**
 * Package-owned invariant companion for `@lyness/client-ui-plan`.
 * @module @lyness/client-ui-plan/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@lyness/cordis'
import type { InvariantInstaller } from '@lyness/invariants'

const PACKAGE_NAME = '@lyness/client-ui-plan'

/** Cordis companion plugin name. */
export const name = 'client-ui-plan-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: plan state and boundary ownership are
 * audited by lyn-plan-mode, while the control is a slot effect whose
 * declaration, registration, and teardown are exercised by this package.
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
