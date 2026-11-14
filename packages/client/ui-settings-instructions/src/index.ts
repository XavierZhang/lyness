/**
 * Host registration for the instructions section.
 *
 * It registers nothing: the store and the Remote namespace belong to
 * `lyn-personal-instructions` and its controller, and this half exists so the
 * package has a Host entry its client bundle can be mounted beside.
 *
 * @module @lyness/lyn-client-ui-settings-instructions
 */

import type { Context } from '@lyness/cordis'

/**
 * Mount the Host half, which contributes nothing of its own.
 * @param ctx - plugin context, unused.
 */
export function apply(ctx: Context): void {
  void ctx
}
