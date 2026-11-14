/**
 * Host registration for the data section.
 *
 * It registers nothing: the conversations belong to the session service and
 * the deletion to its controller, and this half exists so the package has a
 * Host entry its client bundle can be mounted beside.
 *
 * @module @lyness/lyn-client-ui-settings-data
 */

import type { Context } from '@lyness/cordis'

/**
 * Mount the Host half, which contributes nothing of its own.
 * @param ctx - plugin context, unused.
 */
export function apply(ctx: Context): void {
  void ctx
}
