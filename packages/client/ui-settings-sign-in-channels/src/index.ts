/**
 * Host registration for the sign-in channels section.
 *
 * It registers nothing: the kinds, the records, and the authorization rule
 * are the deployment's, served by `dsh-api-sign-in-channel-controller`, and
 * this half exists so the package has a Host entry its client bundle can be
 * mounted beside.
 *
 * @module @deepseek-ai/dsh-client-ui-settings-sign-in-channels
 */

import type { Context } from '@deepseek-ai/cordis'

/**
 * Mount the Host half, which contributes nothing of its own.
 * @param ctx - plugin context, unused.
 */
export function apply(ctx: Context): void {
  void ctx
}
