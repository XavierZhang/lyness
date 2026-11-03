/**
 * Host registration for the memory section.
 *
 * It registers nothing: the store belongs to `dsh-memory` and the Remote
 * namespace to its controller, and this half exists so the package has a Host
 * entry its client bundle can be mounted beside.
 *
 * @module @deepseek-ai/dsh-client-ui-settings-memory
 */

import type { Context } from '@deepseek-ai/cordis'

/**
 * Mount the Host half, which contributes nothing of its own.
 * @param ctx - plugin context, unused.
 */
export function apply(ctx: Context): void {
  void ctx
}
