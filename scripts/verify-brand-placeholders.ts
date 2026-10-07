/**
 * Reject a product name written literally into a locale dictionary.
 *
 * Product copy names the product through `{brandName}`, `{brandAbbr}` or
 * `{brandNameZh}`, which `lyn-client-locale` fills from the deployment brand.
 * One literal name leaves a private deployment reading as lyness in that
 * sentence, and the sentence nobody opens is where such a name survives —
 * every occurrence this check now covers reached a release that way.
 *
 * Package names (`@lyness/lyn-…`) are external identifiers and stay literal.
 * So does the `lyn` command, which this check never matches: it looks for the
 * product's names, not its executable.
 */

import { globSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'

const root = resolve(import.meta.dirname, '..')

/** Discovery guard: the dictionaries present when this check was written. */
const MINIMUM_DICTIONARIES = 50

/**
 * Dictionaries whose copy cannot carry a placeholder, and why.
 *
 * Remove an entry together with the mechanism that lets its copy name the
 * brand; an entry is a deferral, not permission.
 */
const EXEMPT: Readonly<Record<string, string>> = {}

/**
 * Dictionary values that name a product on purpose, by the file that writes them.
 *
 * Only the attribution line qualifies: it names the platform a deployment runs
 * on, so it must keep saying lyness while every other sentence takes the
 * deployment's own name. An entry here is a decision, not a deferral.
 */
const DELIBERATE: Readonly<Record<string, readonly string[]>> = {
  'packages/client/ui-brand-lyness/src/client/locales.ts': ['Powered by lyness', '由领驭提供技术支持'],
}

/** Package names carrying the scope, removed before the names are looked for. */
const PACKAGE_NAME = /@lyness\/[\w./-]+/gu

/** The product's names, each of which product copy writes as a placeholder. */
const BRAND_NAME = /\bLYNESS\b|\bLYN\b|\blyness\b|领驭/u

/** One literal product name in dictionary copy. */
export interface BrandPlaceholderViolation {
  /** One-based source column. */
  column: number
  /** Repository-relative source path. */
  file: string
  /** One-based source line. */
  line: number
  /** Compact literal text for the diagnostic. */
  text: string
}

/**
 * Whether a dictionary value still names the product literally.
 * @param text - one string literal's text.
 * @returns true when a product name survives package-name removal.
 */
function namesBrand(text: string): boolean {
  return BRAND_NAME.test(text.replace(PACKAGE_NAME, ''))
}

/**
 * Whether this literal addresses copy rather than carrying it.
 * @param node - the string literal under consideration.
 * @returns true for module specifiers and property keys.
 */
function addressesCopy(node: ts.StringLiteralLike): boolean {
  const parent: ts.Node = node.parent
  if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) return true
  if (ts.isModuleDeclaration(parent) || ts.isImportTypeNode(parent)) return true
  if (ts.isCallExpression(parent) && parent.expression.kind === ts.SyntaxKind.ImportKeyword) return true
  if (ts.isLiteralTypeNode(parent)) return true
  return (ts.isPropertyAssignment(parent) || ts.isPropertySignature(parent)) && parent.name === node
}

/**
 * Compact one literal for a diagnostic line.
 * @param text - literal text.
 * @returns the text on one line, shortened past 80 characters.
 */
function compactText(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  return normalized.length <= 80 ? normalized : `${normalized.slice(0, 77)}...`
}

/**
 * Find literal product names in one dictionary module.
 * @param file - repository-relative path used in diagnostics.
 * @param sourceText - TypeScript source.
 * @returns violations in source order.
 */
export function findBrandPlaceholderViolations(file: string, sourceText: string): BrandPlaceholderViolation[] {
  const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true)
  const violations: BrandPlaceholderViolation[] = []
  const visit = (node: ts.Node): void => {
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
      && !addressesCopy(node)
      && namesBrand(node.text)) {
      const { line, character } = source.getLineAndCharacterOfPosition(node.getStart(source))
      violations.push({ column: character + 1, file, line: line + 1, text: compactText(node.text) })
    }
    if (ts.isTemplateExpression(node)) {
      for (const span of [node.head, ...node.templateSpans.map(part => part.literal)]) {
        if (!namesBrand(span.text)) continue
        const { line, character } = source.getLineAndCharacterOfPosition(span.getStart(source))
        violations.push({ column: character + 1, file, line: line + 1, text: compactText(span.text) })
      }
    }
    ts.forEachChild(node, visit)
  }
  ts.forEachChild(source, visit)
  return violations
}

/**
 * Every locale dictionary this check reads.
 * @returns repository-relative paths, sorted, exemptions removed.
 */
export function dictionaryFiles(): string[] {
  return [...new Set([
    ...globSync('packages/*/*/src/**/*locale*.ts', { cwd: root }),
    ...globSync('packages/*/*/src/**/locales/*.ts', { cwd: root }),
    ...globSync('apps/*/src/**/*locale*.ts', { cwd: root }),
    ...globSync('apps/*/src/**/locales/*.ts', { cwd: root }),
  ])]
    .map(file => file.replaceAll('\\', '/'))
    .filter(file => !file.endsWith('.d.ts'))
    .sort()
}

function main(): void {
  const files = dictionaryFiles()
  if (files.length < MINIMUM_DICTIONARIES) {
    throw new Error(
      `verify-brand-placeholders: discovery narrowed to ${files.length} dictionary file(s); expected at least ${MINIMUM_DICTIONARIES}.`,
    )
  }
  const stale = Object.keys(EXEMPT).filter(file => !files.includes(file))
  if (stale.length > 0) {
    throw new Error(`verify-brand-placeholders: exemption names a missing file: ${stale.join(', ')}`)
  }
  const checked = files.filter(file => !(file in EXEMPT))
  const violations = checked.flatMap((file) => {
    const deliberate = DELIBERATE[file] ?? []
    return findBrandPlaceholderViolations(file, readFileSync(resolve(root, file), 'utf8'))
      .filter(violation => !deliberate.includes(violation.text))
  })
  if (violations.length > 0) {
    console.error(`verify-brand-placeholders: ${violations.length} literal product name(s) in dictionary copy:`)
    for (const violation of violations) {
      console.error(
        `  ${violation.file}:${violation.line}:${violation.column} write {brandName}, {brandAbbr} or {brandNameZh}: ${JSON.stringify(violation.text)}`,
      )
    }
    process.exitCode = 1
    return
  }
  console.log(
    `verify-brand-placeholders: ${checked.length} dictionary file(s) name the product through placeholders`
    + ` (${String(Object.keys(EXEMPT).length)} exempt,`
    + ` ${String(Object.values(DELIBERATE).flat().length)} deliberate).`,
  )
}

if (import.meta.filename === resolve(process.argv[1] ?? '')) main()
