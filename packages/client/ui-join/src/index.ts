/**
 * Host registration for the invitation page.
 *
 * It registers nothing: the code is redeemed by the sign-in this page sends
 * the browser to, and this half exists so the package has a Host entry its
 * client bundle can be mounted beside.
 *
 * @module @lyness/lyn-client-ui-join
 */

import type { Context } from '@lyness/cordis'

/**
 * Mount the Host half, which contributes nothing of its own.
 * @param ctx - plugin context, unused.
 */
export function apply(ctx: Context): void {
  void ctx
}
