/**
 * Package-owned invariant companion for `@lyness/acp-app`.
 * @module @lyness/acp-app/invariant
 */

import type { Context } from '@lyness/cordis'
import type { InvariantInstaller } from '@lyness/invariants'

const PACKAGE_NAME = '@lyness/acp-app'

/** Cordis companion plugin name. */
export const name = 'acp-app-invariant'
/** Service required before the companion can register. */
export const inject = ['invariants']

/**
 * No runtime invariant: the bundle adds a process transport and startup latch;
 * source/built stdio tests own frame purity, help exclusion, and shutdown.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
