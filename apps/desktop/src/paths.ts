/** Filesystem ownership for the Electron-managed desktop installation. */

import { join } from 'node:path'
import { resolveLynHome } from '@lyness/lyn-home-paths'

/** Stable desktop installation paths under the shared Harness home. */
export interface DesktopPaths {
  readonly profile: string
  readonly lock: string
}

/**
 * Resolve every Electron-owned path without changing the shared data roots.
 * @param lynHome - Harness home shared with npm-installed lyn.
 * @returns immutable desktop path set.
 */
export function resolveDesktopPaths(lynHome: string = resolveLynHome()): DesktopPaths {
  return {
    profile: join(lynHome, 'profiles', 'desktop'),
    lock: join(lynHome, 'profiles', 'desktop', 'lock'),
  }
}
