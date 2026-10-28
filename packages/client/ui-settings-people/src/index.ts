/**
 * Host registration for the people section.
 *
 * It registers nothing: the directory, the records, and the authorization
 * rules are the deployment's, served by `dsh-api-people-controller`, and this
 * half exists so the package has a Host entry its client bundle can be
 * mounted beside.
 *
 * @module @deepseek-ai/dsh-client-ui-settings-people
 */

import type { Context } from '@deepseek-ai/cordis'

/**
 * Mount the Host half, which contributes nothing of its own.
 * @param ctx - plugin context, unused.
 */
export function apply(ctx: Context): void {
  void ctx
}
