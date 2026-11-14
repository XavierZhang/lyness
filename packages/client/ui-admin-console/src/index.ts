/**
 * Host registration for the administration console.
 *
 * It registers nothing. The console is a browser surface over the Remote
 * namespaces the administration plugins already own, and this half exists so
 * the package has a Host entry its client bundle can be mounted beside. The
 * page itself is served by `dsh-host-frontend-static`, which answers the
 * console's path with the same document; see that package's `documentPaths`.
 *
 * @module @deepseek-ai/dsh-client-ui-admin-console
 */

import type { Context } from '@deepseek-ai/cordis'

/**
 * Mount the Host half, which contributes nothing of its own.
 * @param ctx - plugin context, unused.
 */
export function apply(ctx: Context): void {
  void ctx
}
