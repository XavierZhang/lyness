/**
 * Resolve the public SDK launch configuration to one lyn subprocess.
 * @module @lyness/sdk-client/launch
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { HarnessClientOptions } from './types.ts'

/** Default bound for a profile to answer the SDK initialize handshake. */
export const DEFAULT_INITIALIZE_TIMEOUT_MS = 10_000

/** Internal generic process launch used by the transport and fake-runtime tests. */
export interface RuntimeProcessOptions {
  command: string
  args: string[]
  cwd?: string
  /** Materialize the complete child environment when the client starts its subprocess. */
  environment: () => NodeJS.ProcessEnv
  description: string
  initializeTimeoutMs: number
  requestTimeoutMs?: number
  shutdownTimeoutMs?: number
  disposeEofGraceMs?: number
  disposeGraceMs?: number
}

/** Node argv plus internal profile patches required by one resolved lyn entry. */
export interface LynNodeLaunch {
  /** Arguments before the profile selector. */
  nodeArgs: string[]
  /** Internal patches applied below caller-supplied patches. */
  patches: string[]
  /** Environment values required by the resolved entry mode. */
  environment: NodeJS.ProcessEnv
}

interface PackageManifest {
  version?: unknown
  bin?: unknown
}

/** Read a package manifest from one resolved package.json URL. */
function manifest(url: string): PackageManifest {
  return JSON.parse(readFileSync(fileURLToPath(url), 'utf8')) as PackageManifest
}

/**
 * Resolve and version-check a lyn executable from package manifests.
 * @param lynManifestUrl - resolved URL of the lyn package manifest.
 * @param clientManifestUrl - resolved URL of the SDK client manifest.
 * @returns the absolute lyn executable path.
 */
export function resolveLynBinFromManifests(lynManifestUrl: string, clientManifestUrl: string): string {
  const lynManifest = manifest(lynManifestUrl)
  const clientManifest = manifest(clientManifestUrl)
  if (typeof lynManifest.version !== 'string' || lynManifest.version !== clientManifest.version) {
    throw new Error(`lyn SDK client ${String(clientManifest.version)} requires the same lyn version, got ${String(lynManifest.version)}`)
  }
  const bin = typeof lynManifest.bin === 'object' && lynManifest.bin !== null
    ? (lynManifest.bin as Record<string, unknown>).lyn
    : lynManifest.bin
  if (typeof bin !== 'string' || bin === '') throw new Error('@lyness/lyn declares no lyn executable')
  return resolve(dirname(fileURLToPath(lynManifestUrl)), bin)
}

/**
 * Resolve and version-check the built lyn executable installed with this SDK.
 * @returns the absolute built executable path, whether or not it exists in a source checkout.
 */
export function installedLynBin(): string {
  return resolveLynBinFromManifests(
    import.meta.resolve('@lyness/lyn/package.json'),
    new URL('../package.json', import.meta.url).href,
  )
}

/**
 * Resolve the Node launch for one same-version lyn package.
 * @param lynManifestUrl - resolved URL of the lyn package manifest.
 * @param clientManifestUrl - resolved URL of the SDK client manifest.
 * @param sourceLoaderUrl - optional absolute tsx loader URL for deterministic tests.
 * @returns built output, or the source entry plus its compatibility patch and tsx environment.
 */
export function resolveLynNodeLaunchFromManifests(
  lynManifestUrl: string,
  clientManifestUrl: string,
  sourceLoaderUrl?: string,
): LynNodeLaunch {
  const bin = resolveLynBinFromManifests(lynManifestUrl, clientManifestUrl)
  if (existsSync(bin)) return { nodeArgs: [bin], patches: [], environment: {} }

  const packageDir = dirname(fileURLToPath(lynManifestUrl))
  const sourceBin = resolve(packageDir, 'src/bin.ts')
  const sourcePatch = resolve(packageDir, 'src/sdk-source.cordis.patch.yml')
  const sourceTsconfig = resolve(packageDir, 'tsconfig.json')
  if (!existsSync(sourceBin) || !existsSync(sourcePatch) || !existsSync(sourceTsconfig)) {
    throw new Error(
      `@lyness/lyn is missing its built executable ${bin} and complete source launch files ${sourceBin}, ${sourcePatch}, ${sourceTsconfig}`,
    )
  }
  const loader = sourceLoaderUrl ?? import.meta.resolve('tsx/esm')
  return {
    nodeArgs: ['--import', loader, sourceBin],
    patches: [sourcePatch],
    environment: { TSX_TSCONFIG_PATH: sourceTsconfig },
  }
}

/**
 * Resolve the installed lyn package to a built or source Node launch.
 * @returns the launch descriptor for the current checkout or installed package.
 */
function installedLynNodeLaunch(): LynNodeLaunch {
  return resolveLynNodeLaunchFromManifests(
    import.meta.resolve('@lyness/lyn/package.json'),
    new URL('../package.json', import.meta.url).href,
  )
}

/**
 * Resolve caller-relative filesystem inputs and construct canonical lyn argv.
 * @param options - public SDK launch options.
 * @param callerCwd - parent-process directory used for lexical resolution.
 * @returns one generic subprocess spec for the JSON-RPC transport.
 */
export function resolveLynLaunch(
  options: HarnessClientOptions = {},
  callerCwd: string = process.cwd(),
): RuntimeProcessOptions {
  const profile = options.profile ?? 'sdk'
  const lynLaunch = options.lynBin === undefined
    ? installedLynNodeLaunch()
    : { nodeArgs: [resolve(callerCwd, options.lynBin)], patches: [], environment: {} }
  const patches = [
    ...lynLaunch.patches,
    ...(options.patches ?? []).map(path => resolve(callerCwd, path)),
  ]
  const lynHome = options.lynHome === undefined ? undefined : resolve(callerCwd, options.lynHome)
  return {
    command: process.execPath,
    args: [...lynLaunch.nodeArgs, '--profile', profile, ...patches.flatMap(path => ['--patch', path])],
    ...options.processCwd === undefined ? {} : { cwd: resolve(callerCwd, options.processCwd) },
    environment: () => ({
      ...(options.env ?? process.env),
      ...lynLaunch.environment,
      ...lynHome === undefined ? {} : { LYNESS_HOME: lynHome },
    }),
    description: `lyn profile ${JSON.stringify(profile)}`,
    initializeTimeoutMs: options.initializeTimeoutMs ?? DEFAULT_INITIALIZE_TIMEOUT_MS,
    ...options.requestTimeoutMs === undefined ? {} : { requestTimeoutMs: options.requestTimeoutMs },
    ...options.shutdownTimeoutMs === undefined ? {} : { shutdownTimeoutMs: options.shutdownTimeoutMs },
    ...options.disposeEofGraceMs === undefined ? {} : { disposeEofGraceMs: options.disposeEofGraceMs },
    ...options.disposeGraceMs === undefined ? {} : { disposeGraceMs: options.disposeGraceMs },
  }
}
