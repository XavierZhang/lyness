/**
 * Gate for the Remote authority declaration: every wire namespace states the
 * standing it requires.
 *
 * The rule is enforced once, at the Gateway, from what a namespace or a method
 * declared. That makes an undeclared namespace the one way the rule can be
 * missed — and an undeclared namespace reads as "nobody classified it", which
 * an enforcing deployment refuses. A refusal is safe but it is also a
 * production outage, so the declaration is checked here instead: a new
 * controller cannot ship without saying who may reach it.
 *
 * It reads the source rather than a built artifact, because the declaration is
 * a literal in a `super()` call and the point is to catch it before a build.
 */

import { globSync, readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')

/** The standings a namespace or method may require. */
const AUTHORITIES = new Set(['anyone', 'member', 'tenant-administrator', 'platform-administrator'])

/** One namespace that declared no standing. */
interface Violation {
  /** Repository-relative source file. */
  readonly file: string
  /** What is wrong with it. */
  readonly problem: string
}

/** Sources that define a Remote service, excluding generated catalogs and tests. */
function remoteSources(): readonly string[] {
  return globSync('packages/*/*/src/**/*.ts', { cwd: root })
    .filter(path => !path.includes('/tests/'))
    .filter(path => !path.endsWith('api-catalog.ts'))
}

/**
 * Check one source for an undeclared Remote namespace.
 * @param path - repository-relative source path.
 * @param source - its text.
 * @returns every violation the file carries.
 */
function violationsOf(path: string, source: string): readonly Violation[] {
  if (!/extends TypertRemoteService/u.test(source)) return []
  const violations: Violation[] = []
  for (const match of source.matchAll(/super\(ctx, '([A-Za-z.]+)'(?:, (\{[^}]*\}))?\)/gu)) {
    const [, key, options] = match
    const requires = options === undefined ? undefined : /requires: '([a-z-]+)'/u.exec(options)?.[1]
    if (requires === undefined) {
      violations.push({ file: path, problem: `Remote namespace "${String(key)}" declares no requires` })
      continue
    }
    if (!AUTHORITIES.has(requires)) {
      violations.push({ file: path, problem: `Remote namespace "${String(key)}" requires unknown standing "${requires}"` })
    }
  }
  return violations
}

const violations = remoteSources().flatMap((path) => {
  const source = readFileSync(resolve(root, path), 'utf8')
  return violationsOf(relative('.', path), source)
})

if (violations.length > 0) {
  const lines = violations.map(violation => `  ${violation.file}: ${violation.problem}`)
  console.error(`verify-remote-authority: ${String(violations.length)} undeclared Remote namespace(s):\n${lines.join('\n')}`)
  console.error('  Declare it as super(ctx, key, { requires: "member" }) — or another RemoteAuthority — and raise it per method where one write needs more.')
  process.exit(1)
}

const scanned = remoteSources().filter(path => /extends TypertRemoteService/u.test(readFileSync(resolve(root, path), 'utf8')))
console.log(`verify-remote-authority: ${String(scanned.length)} Remote namespace(s) declare the standing they require.`)
