/**
 * Every `remote.<namespace>` a shipped Client plugin injects must be mounted,
 * and no Remote method may take a name the namespace service reserves.
 *
 * A Client plugin that injects a namespace nobody mounts does not fail: Cordis
 * parks it, forever and silently, and the page it contributes never appears.
 * The only place that shows it is the plugin inventory, as a sync failure whose
 * retry can never succeed, which is how this fork shipped eight parked
 * administration pages — `announcements`, `credits`, `identity`, `people`,
 * `bots`, `audit` and `signInChannels` were injected by Client plugins while
 * the Client assembly mounted none of them.
 *
 * A namespace counts as mounted when the central assembly
 * (`@deepseek-ai/dsh-api-remotes/client`) imports the contribution of the package
 * that declares it, or when the injecting package mounts contributions itself.
 * Adding a page therefore has to add its namespace to the assembly, which is
 * the step an upstream merge drops.
 *
 * Mounting then has one more way to fail: a namespace is a Cordis service and
 * a method is installed as a member of it, so a method named like one of that
 * service's own members cannot be installed and the mount fails — which fails
 * the whole Client boot, not just one page. Three of this fork's controllers
 * declared `remove` that way, and nothing said so for as long as their
 * namespaces went unmounted.
 * @module scripts/verify-client-remote-namespaces
 */

import { globSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import ts from 'typescript'
import { isReservedRemoteMethod } from '@deepseek-ai/dsh-api-gateway/client'

/** Repository root, resolved from this script's own location. */
const root = resolve(import.meta.dirname, '..')

/** The Client assembly whose imports decide what a browser mounts. */
const ASSEMBLY = 'packages/api/remotes/src/client/index.ts'

/** Base class every Remote namespace provider extends. */
const PROVIDER_BASE = 'TypertRemoteService'

/** One workspace package's name and repository-relative directory. */
interface WorkspacePackage {
  readonly name: string
  readonly directory: string
}

/**
 * Every workspace package, by manifest name.
 * @param repository - repository root to scan.
 * @returns each package's name and repository-relative directory.
 */
function workspacePackages(repository: string): ReadonlyMap<string, WorkspacePackage> {
  const found = new Map<string, WorkspacePackage>()
  for (const relativePath of globSync('packages/*/*/package.json', { cwd: repository }).sort()) {
    const manifest = JSON.parse(readFileSync(resolve(repository, relativePath), 'utf8')) as { name: string }
    found.set(manifest.name, { name: manifest.name, directory: dirname(relativePath).replaceAll('\\', '/') })
  }
  return found
}

/**
 * Parse one source file.
 * @param file - repository-relative path, used in diagnostics.
 * @param source - the module's text.
 * @returns the parsed file.
 */
function parse(file: string, source: string): ts.SourceFile {
  return ts.createSourceFile(file, source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX)
}

/** Every `.ts`/`.tsx` module under one package's `src`, repository-relative. */
function sourceFiles(repository: string, directory: string): readonly string[] {
  return globSync('src/**/*.{ts,tsx}', { cwd: resolve(repository, directory), exclude: ['node_modules', 'lib'] })
    .sort().map(relativePath => `${directory}/${relativePath}`.replaceAll('\\', '/'))
}

/**
 * The `@Remote` method names one module's provider classes export.
 *
 * The exported name is the method's own unless the decorator renames it:
 * `@Remote('list')` on `remoteExportList` exports `list`.
 * @param parsed - the parsed module.
 * @returns every exported Remote method name with the line it is declared on.
 */
export function remoteMethodNames(parsed: ts.SourceFile): readonly { method: string; line: number }[] {
  const found: { method: string; line: number }[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isClassDeclaration(node) && extendsProvider(node)) {
      for (const member of node.members) {
        if (!ts.isMethodDeclaration(member)) continue
        const decorator = ts.getDecorators(member)?.find(entry => decoratorName(entry) === 'Remote')
        if (decorator === undefined) continue
        found.push({
          method: exportedMethodName(decorator, member, parsed),
          line: parsed.getLineAndCharacterOfPosition(member.getStart(parsed)).line + 1,
        })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(parsed)
  return found
}

/**
 * The identifier a decorator names, with or without a call.
 * @param decorator - the decorator to read.
 * @returns the bare identifier, or undefined for anything else.
 */
function decoratorName(decorator: ts.Decorator): string | undefined {
  const expression = ts.isCallExpression(decorator.expression) ? decorator.expression.expression : decorator.expression
  return ts.isIdentifier(expression) ? expression.text : undefined
}

/**
 * The wire name one decorated method exports.
 * @param decorator - the `Remote` decorator.
 * @param member - the decorated method.
 * @param parsed - the module holding both.
 * @returns the decorator's string argument, or the method's own name.
 */
function exportedMethodName(decorator: ts.Decorator, member: ts.MethodDeclaration, parsed: ts.SourceFile): string {
  if (ts.isCallExpression(decorator.expression)) {
    const [renamed] = decorator.expression.arguments
    if (renamed !== undefined && ts.isStringLiteralLike(renamed)) return renamed.text
  }
  return member.name.getText(parsed)
}

/**
 * The Remote namespaces one module's provider classes declare.
 *
 * A provider names its service in `super(ctx, '<service>')` and may rename the
 * wire namespace with a `namespace` option; without the option the service name
 * is the namespace.
 * @param parsed - the parsed module.
 * @returns every namespace declared in it.
 */
function declaredNamespaces(parsed: ts.SourceFile): readonly string[] {
  const found: string[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isClassDeclaration(node) && extendsProvider(node)) {
      for (const member of node.members) {
        if (!ts.isConstructorDeclaration(member) || member.body === undefined) continue
        const namespace = namespaceOfSuperCall(member.body)
        if (namespace !== undefined) found.push(namespace)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(parsed)
  return found
}

/**
 * Whether a class extends the Remote provider base.
 * @param node - the class to inspect.
 * @returns true when its heritage names the base.
 */
function extendsProvider(node: ts.ClassDeclaration): boolean {
  return (node.heritageClauses ?? []).some(clause => (
    clause.token === ts.SyntaxKind.ExtendsKeyword
    && clause.types.some(type => type.expression.getText(node.getSourceFile()).endsWith(PROVIDER_BASE))
  ))
}

/**
 * The namespace a constructor's `super(...)` call establishes.
 * @param body - the constructor body to search.
 * @returns the namespace, or undefined when the call names none.
 */
function namespaceOfSuperCall(body: ts.Block): string | undefined {
  let namespace: string | undefined
  const visit = (node: ts.Node): void => {
    if (namespace !== undefined) return
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.SuperKeyword) {
      const [, service, options] = node.arguments
      const override = options !== undefined && ts.isObjectLiteralExpression(options)
        ? options.properties.find(property => (
          ts.isPropertyAssignment(property) && property.name.getText(body.getSourceFile()) === 'namespace'
        ))
        : undefined
      if (override !== undefined && ts.isPropertyAssignment(override) && ts.isStringLiteralLike(override.initializer)) {
        namespace = override.initializer.text
        return
      }
      if (service !== undefined && ts.isStringLiteralLike(service)) namespace = service.text
      return
    }
    ts.forEachChild(node, visit)
  }
  visit(body)
  return namespace
}

/**
 * The namespaces the Client assembly mounts.
 * @param repository - repository root to scan.
 * @param packages - every workspace package, by name.
 * @returns the mounted namespaces, plus any unresolvable assembly import.
 */
export function mountedNamespaces(
  repository: string,
  packages: ReadonlyMap<string, WorkspacePackage>,
): { readonly namespaces: ReadonlySet<string>; readonly problems: readonly string[] } {
  const parsed = parse(ASSEMBLY, readFileSync(resolve(repository, ASSEMBLY), 'utf8'))
  const namespaces = new Set<string>()
  const problems: string[] = []
  for (const statement of parsed.statements) {
    if (!ts.isImportDeclaration(statement) || statement.importClause?.name === undefined) continue
    if (!ts.isStringLiteralLike(statement.moduleSpecifier)) continue
    const specifier = statement.moduleSpecifier.text
    if (!specifier.endsWith('/remote')) continue
    const entry = packages.get(specifier.slice(0, -'/remote'.length))
    if (entry === undefined) {
      problems.push(`${ASSEMBLY}: mounts ${specifier}, which is not a workspace package`)
      continue
    }
    for (const file of sourceFiles(repository, entry.directory)) {
      for (const namespace of declaredNamespaces(parse(file, readFileSync(resolve(repository, file), 'utf8')))) {
        namespaces.add(namespace)
      }
    }
  }
  return { namespaces, problems }
}

/**
 * The `remote.<namespace>` entries one module's injection lists name.
 *
 * Only an injection parks a plugin: a declared `inject` list, or the array
 * passed to `ctx.inject(...)`. An optional `ctx.get('remote.x')` read is not
 * one — it returns undefined and the plugin keeps running.
 * @param parsed - the parsed module.
 * @returns each namespace with the line it is injected on.
 */
export function injectedNamespaces(parsed: ts.SourceFile): readonly { namespace: string; line: number }[] {
  const found: { namespace: string; line: number }[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isArrayLiteralExpression(node) && isInjectionList(node)) {
      for (const element of node.elements) {
        if (!ts.isStringLiteralLike(element) || !element.text.startsWith('remote.')) continue
        const namespace = element.text.slice('remote.'.length)
        if (namespace === '') continue
        found.push({ namespace, line: parsed.getLineAndCharacterOfPosition(element.getStart(parsed)).line + 1 })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(parsed)
  return found
}

/**
 * Whether one array literal is an injection list.
 * @param node - the array literal to classify.
 * @returns true when it declares `inject` or is passed to `ctx.inject(...)`.
 */
function isInjectionList(node: ts.ArrayLiteralExpression): boolean {
  const parent = node.parent
  const source = node.getSourceFile()
  if (
    (ts.isVariableDeclaration(parent) || ts.isPropertyDeclaration(parent) || ts.isPropertyAssignment(parent))
    && parent.name.getText(source) === 'inject'
  ) return true
  return ts.isCallExpression(parent)
    && parent.arguments[0] === node
    && parent.expression.getText(source).endsWith('.inject')
}

/**
 * Report every Client injection of an unmounted Remote namespace.
 * @param repository - repository root to scan.
 * @returns one diagnostic per offending injection site.
 */
export function unmountedClientInjections(repository: string = root): readonly string[] {
  const packages = workspacePackages(repository)
  if (packages.size === 0) return [`${repository}: no workspace package manifests found`]
  const mounted = mountedNamespaces(repository, packages)
  const { namespaces } = mounted
  const problems = [...mounted.problems]
  if (namespaces.size === 0) problems.push(`${ASSEMBLY}: mounts no Remote namespace at all`)
  for (const entry of [...packages.values()].sort((left, right) => left.directory.localeCompare(right.directory))) {
    const files = sourceFiles(repository, entry.directory).map(file => (
      { file, parsed: parse(file, readFileSync(resolve(repository, file), 'utf8')) }
    ))
    for (const { file, parsed } of files) {
      for (const declared of remoteMethodNames(parsed)) {
        if (!isReservedRemoteMethod(declared.method)) continue
        problems.push(
          `${file}:${String(declared.line)}: Remote method "${declared.method}" is a name the namespace service reserves`,
        )
      }
    }
    // A package that mounts contributions itself answers for its own
    // injections, whatever the central assembly carries.
    if (files.some(({ parsed }) => parsed.text.includes('remote.$mount('))) continue
    for (const { file, parsed } of files) {
      for (const injection of injectedNamespaces(parsed)) {
        if (namespaces.has(injection.namespace)) continue
        problems.push(
          `${file}:${String(injection.line)}: injects remote.${injection.namespace}, which the Client assembly does not mount`,
        )
      }
    }
  }
  return problems
}

if (import.meta.main) {
  const problems = unmountedClientInjections()
  for (const problem of problems) console.error(problem)
  if (problems.length > 0) {
    console.error(
      `verify-client-remote-namespaces: mount each namespace above in ${ASSEMBLY} — import the declaring `
      + "controller's `/remote` contribution and add it to the mount list — or the plugin injecting it stays parked; "
      + 'rename each reserved method above, because its namespace cannot mount at all.',
    )
    process.exitCode = 1
  } else {
    console.log('verify-client-remote-namespaces: every injected Remote namespace is mounted.')
  }
}
