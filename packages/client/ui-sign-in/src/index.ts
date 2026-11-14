/**
 * Host registration for the sign-in surface.
 *
 * It registers nothing: who the viewer is and what they may sign in with are
 * the deployment's, served by `lyn-api-identity-controller`, and this half
 * exists so the package has a Host entry its client bundle can be mounted
 * beside.
 *
 * @module @lyness/lyn-client-ui-sign-in
 */

import type { Context } from '@lyness/cordis'

/**
 * Mount the Host half, which contributes nothing of its own.
 * @param ctx - plugin context, unused.
 */
export function apply(ctx: Context): void {
  void ctx
}
