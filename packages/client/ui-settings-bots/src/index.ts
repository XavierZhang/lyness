/**
 * Host registration for the bots section.
 *
 * It registers nothing: the bots, their records, and the authorization rules
 * are the deployment's, served by `lyn-api-bots-controller`, and this half
 * exists so the package has a Host entry its client bundle can be mounted
 * beside.
 *
 * @module @lyness/lyn-client-ui-settings-bots
 */

import type { Context } from '@lyness/cordis'

/**
 * Mount the Host half, which contributes nothing of its own.
 * @param ctx - plugin context, unused.
 */
export function apply(ctx: Context): void {
  void ctx
}
