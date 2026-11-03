/**
 * Host registration for the history section.
 *
 * It registers nothing: the trail, its records and the rule that decides who
 * may read them are the deployment's, served by
 * `dsh-api-admin-audit-controller`, and this half exists so the package has a
 * Host entry its client bundle can be mounted beside.
 *
 * @module @deepseek-ai/dsh-client-ui-settings-history
 */

import type { Context } from '@deepseek-ai/cordis'

/**
 * Mount the Host half, which contributes nothing of its own.
 * @param ctx - plugin context, unused.
 */
export function apply(ctx: Context): void {
  void ctx
}
