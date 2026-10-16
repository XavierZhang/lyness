/**
 * Gate for the phase-one hosted boundary: a profile marked `hosted` composes
 * to a runtime that executes nothing.
 *
 * A hosted runtime serves several customers at once, and nothing between them
 * holds yet — credits, roles and the model policy constrain the model request
 * and nothing else, while a confined command still runs on the host, as the
 * host's user, with the host's network. Until an organization gets a process,
 * the boundary is the absence of the execution plane, and absence is the one
 * form of "cannot execute" that a later patch layer cannot switch back on.
 *
 * So this reads the shipped profile rather than trusting the composition to
 * stay right: it fails on an execution bundle in the layer list, and on an
 * execution row reaching the composed entries by any other route.
 *
 * Decision: `.agents/notes/proposed/architecture/2026-10-15-diverging-from-the-single-operator-host.md`.
 */

import { globSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { loadOverlayPatches } from '../packages/boot/app-boot/src/index.ts'
import { bundlePatchPaths, composeEntries, PROFILE_TEMPLATES } from '../packages/boot/app-boot/src/profile.ts'
import type { LynBundleManifest } from '../packages/util/package-manifest/src/types.ts'

const root = resolve(import.meta.dirname, '..')

/**
 * Every workspace bundle by package name.
 *
 * Read from the workspace rather than resolved from an installation anchor:
 * this gate runs on a clean tree, where a shipped bundle has no installed
 * copy to resolve through.
 */
const workspaceBundles = new Map(globSync('packages/*/*/package.json', { cwd: root }).map((path) => {
  const manifest = JSON.parse(readFileSync(resolve(root, path), 'utf8')) as {
    name?: string
    lyn?: { bundle?: LynBundleManifest }
  }
  return [manifest.name ?? path, { dir: dirname(resolve(root, path)), bundle: manifest.lyn?.bundle }]
}))

/** Bundles a hosted profile may never select, because every row in them reaches a machine. */
export const EXECUTION_BUNDLES: readonly string[] = ['@lyness/lyn-module-execution']

/**
 * Plugins a hosted profile may never mount, whatever row id carries them.
 *
 * The providers come first because a tool without its provider is inert; both
 * are listed because a composition that mounted either would be a composition
 * someone intended to execute with.
 */
export const EXECUTION_PLUGINS: readonly string[] = [
  '@lyness/lyn-fs-local',
  '@lyness/lyn-fs-sandbox',
  '@lyness/lyn-bash-local',
  '@lyness/lyn-bash-sandbox',
  '@lyness/lyn-pwsh-local',
  '@lyness/lyn-pwsh-sandbox',
  '@lyness/lyn-subprocess-local',
  '@lyness/lyn-sandbox-local',
  '@lyness/lyn-terminal-bash',
  '@lyness/lyn-lsp-stdio',
  '@lyness/lyn-ptc-runtime-node',
  '@lyness/lyn-tool-fs',
  '@lyness/lyn-tool-fs-search',
  '@lyness/lyn-tool-str-replace-editor',
  '@lyness/lyn-tool-bash',
  '@lyness/lyn-tool-bash-persistent',
  '@lyness/lyn-tool-pwsh',
  '@lyness/lyn-tool-pwsh-persistent',
  '@lyness/lyn-tool-terminal',
  '@lyness/lyn-tool-lsp',
]

/** What auditing the hosted profiles found. */
export interface HostedBoundaryAudit {
  /** Profiles the templates mark hosted. */
  readonly hosted: readonly string[]
  /** Composed rows read across them. */
  readonly rows: number
  /** One line per violation, naming the profile and what reached it. */
  readonly violations: readonly string[]
}

/**
 * Audit every profile template marked hosted.
 * @returns the profiles read, the rows composed, and any violation found.
 */
export function auditHostedBoundary(): HostedBoundaryAudit {
  const forbiddenPlugins = new Set(EXECUTION_PLUGINS)
  const forbiddenBundles = new Set(EXECUTION_BUNDLES)
  const hosted: string[] = []
  const violations: string[] = []
  let rows = 0

  for (const [name, template] of Object.entries(PROFILE_TEMPLATES)) {
    if (template.hosted !== true) continue
    hosted.push(name)
    for (const bundle of template.bundles) {
      if (forbiddenBundles.has(bundle)) {
        violations.push(`profile "${name}" selects the execution bundle ${bundle}`)
      }
    }
    const layers = template.bundles.map((bundle) => {
      const found = workspaceBundles.get(bundle)
      if (found?.bundle === undefined) {
        violations.push(`profile "${name}" selects ${bundle}, which declares no lyn.bundle`)
        return []
      }
      return bundlePatchPaths(found.dir, found.bundle)
        .flatMap(path => loadOverlayPatches(name, path))
    })
    const composed = composeEntries(layers, () => undefined)
    rows += composed.length
    for (const row of composed) {
      if (forbiddenPlugins.has(row.name)) {
        violations.push(`profile "${name}" mounts ${row.name} as row "${row.id}"`)
      }
    }
  }

  if (hosted.length === 0) {
    violations.push('no profile template is marked hosted; this gate would pass vacuously')
  }
  return { hosted, rows, violations }
}

/** Run the audit as a standalone gate. */
function main(): void {
  const audit = auditHostedBoundary()
  if (audit.violations.length > 0) {
    console.error('verify-hosted-profile-boundary: a hosted profile can execute:')
    for (const violation of audit.violations) console.error(`  ${violation}`)
    process.exit(1)
  }
  console.log(
    `verify-hosted-profile-boundary: ${String(audit.hosted.length)} hosted profile(s)`
    + ` (${audit.hosted.join(', ')}), ${String(audit.rows)} row(s) composed, none executes.`,
  )
}

if (process.argv[1] && import.meta.filename === resolve(process.argv[1])) main()
