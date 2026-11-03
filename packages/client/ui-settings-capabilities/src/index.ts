/**
 * Host registration for the "what you may use" section.
 *
 * It registers nothing: every registry this page reports belongs to the
 * plugin that owns it, and this half exists so the package has a Host entry
 * its client bundle can be mounted beside.
 *
 * @module @lyness/lyn-client-ui-settings-capabilities
 */

import type { Context } from '@lyness/cordis'

/**
 * Mount the Host half, which contributes nothing of its own.
 * @param ctx - plugin context, unused.
 */
export function apply(ctx: Context): void {
  void ctx
}
