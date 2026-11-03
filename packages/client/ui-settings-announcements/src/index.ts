/**
 * Host registration for the announcements row.
 *
 * It registers nothing: the announcements themselves are the deployment's,
 * served by `dsh-api-announcement-controller`, and this half exists so the
 * package has a Host entry its client bundle can be mounted beside.
 *
 * @module @deepseek-ai/dsh-client-ui-settings-announcements
 */

import type { Context } from '@deepseek-ai/cordis'

/**
 * Mount the Host half, which contributes nothing of its own.
 * @param ctx - plugin context, unused.
 */
export function apply(ctx: Context): void {
  void ctx
}
