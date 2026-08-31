/** Package-owned invariant companion for the GitHub webhook adapter. */

import type { Context } from '@lyness/cordis'
import type { InvariantInstaller } from '@lyness/invariants'

const PACKAGE_NAME = '@lyness/webhook-github'

/** Cordis invariant-companion plugin name. */
export const name = 'webhook-github-invariant'
/** Registry required before reserving this package's invariant ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: authentication and input validation occur at the exact
 * HTTP operation; lyn-host-webserver owns route/disposer symmetry.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's explained empty invariant.
 * @param ctx - Cordis context carrying the invariant registry.
 * @returns the invariant registration disposer.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
