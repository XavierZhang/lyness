/**
 * Every workspace package a package's `src` imports at runtime must be declared
 * by that package.
 *
 * pnpm links only declared dependencies into a package's own `node_modules`,
 * while a repository-root install also leaves names there from earlier
 * generations. A `src` module that imports an undeclared workspace package
 * therefore resolves in this checkout and fails wherever resolution starts from
 * the package itself: the built `lib/` loaded by a plain-Node child, and a
 * published install. `session-controller` imported `callingStanding` from
 * `@deepseek-ai/dsh-request-principal` for months that way, and what finally caught
 * it was a benchmark subprocess, not a gate.
 *
 * Only value imports are checked. A type-only import emits nothing, so an
 * undeclared one cannot fail at runtime; the compiler faces already resolve
 * those through the aggregate programs.
 * @module scripts/verify-workspace-import-declarations
 */

import { globSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import ts from 'typescript'

/** Repository root, resolved from this script's own location. */
const root = resolve(import.meta.dirname, '..')

/** One package's identity, directory, and declared names. */
interface WorkspacePackage {
  /** Manifest `name`. */
  readonly name: string
  /** Repository-relative directory holding the manifest. */
  readonly directory: string
  /** Every name any dependency section declares, plus the package itself. */
  readonly declared: ReadonlySet<string>
}

/**
 * The package a module specifier names.
 * @param specifier - the specifier as written.
 * @returns the package name, or undefined for a relative or unscoped-bare one.
 */
function packageNameOf(specifier: string): string | undefined {
  if (!specifier.startsWith('@')) return undefined
  const [scope, name] = specifier.split('/')
  return scope === undefined || name === undefined ? undefined : `${scope}/${name}`
}

/**
 * Read every workspace package's manifest.
 * @param repository - repository root to scan.
 * @returns one entry per `packages/<group>/<package>` manifest.
 */
export function workspacePackages(repository: string = root): readonly WorkspacePackage[] {
  return globSync('packages/*/*/package.json', { cwd: repository }).sort().map((relativePath) => {
    const manifest = JSON.parse(readFileSync(resolve(repository, relativePath), 'utf8')) as {
      name: string
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
      peerDependencies?: Record<string, string>
      optionalDependencies?: Record<string, string>
    }
    const declared = new Set<string>([manifest.name])
    for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'] as const) {
      for (const name of Object.keys(manifest[section] ?? {})) declared.add(name)
    }
    return { name: manifest.name, directory: dirname(relativePath).replaceAll('\\', '/'), declared }
  })
}

/**
 * The packages one module imports for their runtime value.
 *
 * `import type`, `export type`, and a type-only named binding emit nothing, so
 * they are not runtime uses. A bare `import '…'` is one: it runs the module.
 * @param file - path used in diagnostics.
 * @param source - the module's text.
 * @returns each imported package name with the line it is imported on.
 */
export function runtimePackageImports(file: string, source: string): readonly { name: string; line: number }[] {
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX)
  const found: { name: string; line: number }[] = []
  const record = (specifier: ts.Expression): void => {
    if (!ts.isStringLiteralLike(specifier)) return
    const name = packageNameOf(specifier.text)
    if (name === undefined) return
    found.push({ name, line: parsed.getLineAndCharacterOfPosition(specifier.getStart(parsed)).line + 1 })
  }
  for (const statement of parsed.statements) {
    if (ts.isImportDeclaration(statement)) {
      // `phaseModifier` replaced `isTypeOnly`: it names `type` for `import type`
      // and `defer` for a deferred import, which still runs the module.
      if (statement.importClause?.phaseModifier === ts.SyntaxKind.TypeKeyword) continue
      record(statement.moduleSpecifier)
      continue
    }
    if (ts.isExportDeclaration(statement) && statement.moduleSpecifier !== undefined && !statement.isTypeOnly) {
      record(statement.moduleSpecifier)
    }
  }
  return found
}

/**
 * Report every `src` runtime import of an undeclared workspace package.
 * @param repository - repository root to scan.
 * @returns one diagnostic per offending import site.
 */
export function undeclaredWorkspaceImports(repository: string = root): readonly string[] {
  const packages = workspacePackages(repository)
  if (packages.length === 0) return [`${repository}: no workspace package manifests found`]
  const names = new Set(packages.map(entry => entry.name))
  const problems: string[] = []
  for (const entry of packages) {
    const sources = globSync('src/**/*.{ts,tsx}', { cwd: resolve(repository, entry.directory), exclude: ['node_modules', 'lib'] }).sort()
    for (const relativePath of sources) {
      const file = `${entry.directory}/${relativePath}`.replaceAll('\\', '/')
      for (const used of runtimePackageImports(file, readFileSync(resolve(repository, file), 'utf8'))) {
        if (!names.has(used.name) || entry.declared.has(used.name)) continue
        problems.push(`${file}:${String(used.line)}: imports ${used.name} at runtime, which ${entry.name} does not declare`)
      }
    }
  }
  return problems
}

if (import.meta.main) {
  const problems = undeclaredWorkspaceImports()
  for (const problem of problems) console.error(problem)
  if (problems.length > 0) {
    console.error(
      'verify-workspace-import-declarations: declare each package above the way its siblings are declared '
      + '(peerDependencies plus devDependencies for a harness package), and hand-insert the lockfile entry.',
    )
    process.exitCode = 1
  } else {
    console.log('verify-workspace-import-declarations: every runtime workspace import is declared by its own package.')
  }
}
