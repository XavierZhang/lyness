/**
 * Owner-side Liveshare Web bundle plugin.
 * @module @lyness/lyn-experimental-liveshare
 */

export { apply, name, inject, type Config } from './host/share-host.ts'
export { LiveshareShares } from './host/share-remote.ts'

import type { LiveshareShares } from './host/share-remote.ts'

declare module '@lyness/cordis' {
  interface Context {
    /** Owner share management served to the owner page over Typert Remote. */
    liveshareShares: LiveshareShares
  }
}
