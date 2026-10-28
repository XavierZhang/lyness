/**
 * Host registration for the credits section.
 *
 * It registers nothing: the balance, the ledger, and the administrator
 * decisions are the deployment's, served by `dsh-api-credits-controller`, and
 * this half exists so the package has a Host entry its client bundle can be
 * mounted beside.
 *
 * @module @deepseek-ai/dsh-client-ui-settings-credits
 */

import type { Context } from '@deepseek-ai/cordis'

/**
 * Mount the Host half, which contributes nothing of its own.
 * @param ctx - plugin context, unused.
 */
export function apply(ctx: Context): void {
  void ctx
}
