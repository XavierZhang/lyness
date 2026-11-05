/**
 * Roster rows that mount their own generated Remote contribution instead of
 * receiving it from the central Remote assembly. The Typert generator emits
 * those contributions into built `lib/`, so on a clean tree the row's
 * `./remote` import has nothing to resolve and the stand-in beside this table
 * answers it with an empty descriptor list.
 *
 * Both halves of that substitution read this one table. The Vitest config
 * turns it into module aliases and, in the same pass, records the namespaces
 * the stand-ins left uninstalled in {@link STAND_IN_NAMESPACES_ENV}; the jsdom
 * assembly tier reads that variable and provides each one as a `remote.<ns>`
 * proxy, so a row still activates and registers its UI. The config owns the
 * decision because only it runs in a plain Node context: in the jsdom lane a
 * `node:fs` probe of the build output answers false whether or not the file is
 * there, which would hand the tier a proxy that collides with the real mount.
 * @module @lyness/lyn-client-test-runtime/src/assembly/self-mounted-remotes
 */

import { existsSync } from 'node:fs'

/** One row that mounts its own generated contribution. */
export interface SelfMountedRemote {
  /** npm package owning the generated `./remote` subpath. */
  readonly package: string
  /** Its repository-relative directory, holding both `lib/` and the stand-in. */
  readonly directory: string
  /**
   * Namespaces the row's own mount installs. Empty for a package outside the
   * assembled roster: its import still needs a stand-in, but no booted row
   * injects the namespace, so the tier provides nothing.
   */
  readonly namespaces: readonly string[]
}

/** The generated artifact a stand-in replaces, relative to a package directory. */
const GENERATED_CONTRIBUTION = 'lib/typert.remote-client.js'

/** The stand-in each package carries, relative to its directory. */
export const STAND_IN_MODULE = 'tests/generated-remote-stub.ts'

/** Comma-separated namespaces the Vitest config left to the assembly tier; absent or empty means none. */
export const STAND_IN_NAMESPACES_ENV = 'LYNESS_STAND_IN_REMOTE_NAMESPACES'

/** Every row whose `./remote` import needs a stand-in on a clean tree. */
export const SELF_MOUNTED_REMOTES: readonly SelfMountedRemote[] = [
  // LiveShare's client entry mounts its own share namespace; the row is optional and outside the web roster.
  { package: '@lyness/lyn-experimental-liveshare', directory: 'packages/experimental/liveshare', namespaces: [] },
  // The four personal-plane settings pages each mount the one namespace they consume.
  {
    package: '@lyness/lyn-api-agent-capabilities-controller',
    directory: 'packages/api/agent-capabilities-controller',
    namespaces: ['agentCapabilities'],
  },
  { package: '@lyness/lyn-api-memory-controller', directory: 'packages/api/memory-controller', namespaces: ['memories'] },
  {
    package: '@lyness/lyn-api-personal-instructions-controller',
    directory: 'packages/api/personal-instructions-controller',
    namespaces: ['personalInstructions'],
  },
  { package: '@lyness/lyn-api-session-data-controller', directory: 'packages/api/session-data-controller', namespaces: ['sessionData'] },
]

/**
 * Report whether a package ships the generated contribution its stand-in replaces.
 * Call this only from a plain Node context, such as the Vitest config.
 * @param remote - the row to probe.
 * @param root - repository root to resolve against.
 * @returns true when built output is present, so the real contribution resolves.
 */
export function hasGeneratedContribution(remote: SelfMountedRemote, root: URL): boolean {
  return existsSync(new URL(`${remote.directory}/${GENERATED_CONTRIBUTION}`, root))
}

/**
 * Collect the namespaces whose own mount will install nothing, by probing the build output.
 * Call this only from a plain Node context, such as the Vitest config.
 * @param root - repository root to resolve against.
 * @param remotes - rows to consider; defaults to every self-mounting row.
 * @returns namespaces a stand-in left uninstalled, in table order.
 */
export function standInNamespacesOnDisk(
  root: URL,
  remotes: readonly SelfMountedRemote[] = SELF_MOUNTED_REMOTES,
): readonly string[] {
  return remotes.flatMap(remote => (hasGeneratedContribution(remote, root) ? [] : remote.namespaces))
}

/**
 * Read the namespaces the Vitest config recorded for this run.
 * @param environment - process environment to read; defaults to this process's.
 * @returns the recorded namespaces, or none when the variable is absent or empty.
 */
export function standInNamespaces(environment: NodeJS.ProcessEnv = process.env): readonly string[] {
  const recorded = environment[STAND_IN_NAMESPACES_ENV]
  if (recorded === undefined || recorded === '') return []
  return recorded.split(',')
}
