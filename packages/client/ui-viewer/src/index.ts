/**
 * Host registration for the shared viewer service.
 *
 * It registers nothing: who the viewer is belongs to the deployment and is
 * served by `dsh-api-identity-controller`. This half exists so the package
 * has a Host entry its client bundle can be mounted beside.
 *
 * @module @deepseek-ai/dsh-client-ui-viewer
 */

import type { Context } from '@deepseek-ai/cordis'

/**
 * Mount the Host half, which contributes nothing of its own.
 * @param ctx - plugin context, unused.
 */
export function apply(ctx: Context): void {
  void ctx
}
