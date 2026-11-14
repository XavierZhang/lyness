/** Resolve retained Desktop storage independently of packaging and signing. */
import { dirname, isAbsolute, join } from 'node:path'

/**
 * Resolve the persistent release root without assuming a particular user's home directory.
 * @param env Machine packaging configuration; an explicit releases directory overrides its sibling default.
 * @returns Absolute directory outside the disposable checkout.
 */
export function desktopReleasesRoot(env: NodeJS.ProcessEnv): string {
  const configured = env.LYNESS_PACKAGING_CONFIG_DIR
  if (!configured) throw new Error('desktop retention: LYNESS_PACKAGING_CONFIG_DIR is required')
  const root = env.LYNESS_DESKTOP_RELEASES_DIR || join(dirname(configured), 'releases')
  if (!isAbsolute(configured) || !isAbsolute(root)) throw new Error('desktop retention: machine directories must be absolute')
  return root
}
