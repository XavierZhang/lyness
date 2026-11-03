/**
 * Keep `docs/user/guide/changelog.md` honest about this installation's releases.
 *
 * The changelog is the only page that says what one release gave a reader, so a
 * released version missing from it is a release nobody can read about. Released
 * means tagged in this repository under {@link RELEASE_TAG_PREFIX}; upstream's
 * own tags describe upstream's releases and are not this page's subject. The
 * check also requires the shared section names, so an entry cannot be filed
 * under an invented heading. `verify-translation-pairing` owns the Chinese
 * sibling.
 * @module scripts/verify-changelog
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const CHANGELOG = 'docs/user/guide/changelog.md'
/** Tag prefix this installation releases under; upstream tags carry its own. */
const RELEASE_TAG_PREFIX = 'lyn-v'
/** The heading that collects changes not yet under a version. */
const UNRELEASED = 'Unreleased'
/** Section names an entry may use, in the order an entry presents them. */
const SECTIONS = ['Added', 'Changed', 'Fixed'] as const

/**
 * Version headings the changelog declares, in document order.
 * @param source - changelog text.
 * @returns each `##` heading's text.
 */
export function changelogHeadings(source: string): string[] {
  return [...source.matchAll(/^## (.+)$/gmu)].map(match => (match[1] as string).trim())
}

/**
 * Section names used under each version heading.
 * @param source - changelog text.
 * @returns every `###` heading's text, deduplicated.
 */
export function changelogSections(source: string): string[] {
  return [...new Set([...source.matchAll(/^### (.+)$/gmu)].map(match => (match[1] as string).trim()))]
}

/**
 * Versions this installation has released.
 * @param root - repository root.
 * @returns each `lyn-v<version>` tag's version, without the prefix.
 */
export function releasedVersions(root: string): string[] {
  const listed = execFileSync('git', ['tag', '--list', `${RELEASE_TAG_PREFIX}*`], {
    cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  })
  return listed.split('\n').filter(Boolean).map(tag => tag.slice(RELEASE_TAG_PREFIX.length))
}

/**
 * Report what the changelog fails to account for.
 * @param root - repository root.
 * @returns one violation per line, empty when the page is complete.
 */
export function changelogViolations(root: string): string[] {
  const path = resolve(root, CHANGELOG)
  if (!existsSync(path)) return [`${CHANGELOG} is required: a release nobody can read about is a release nobody can adopt`]
  const source = readFileSync(path, 'utf8')
  const violations: string[] = []

  const headings = changelogHeadings(source)
  if (!headings.includes(UNRELEASED)) {
    violations.push(`${CHANGELOG}: needs an "## ${UNRELEASED}" section; entries are written when a change lands, before its version is tagged`)
  }
  const declared = new Set(headings)
  for (const version of releasedVersions(root)) {
    if (!declared.has(version)) {
      violations.push(`${CHANGELOG}: no "## ${version}" section, but ${RELEASE_TAG_PREFIX}${version} is a released tag`)
    }
  }
  const unknown = changelogSections(source).filter(name => !SECTIONS.includes(name as typeof SECTIONS[number]))
  for (const name of unknown) {
    violations.push(`${CHANGELOG}: "### ${name}" is not one of ${SECTIONS.join(', ')}; an entry filed under an invented heading is one a reader does not find`)
  }
  return violations
}

if (import.meta.filename === resolve(process.argv[1] ?? '')) {
  const violations = changelogViolations(ROOT)
  for (const violation of violations) console.error(`  ${violation}`)
  if (violations.length > 0) {
    console.error('verify-changelog: the release changelog is incomplete.')
    process.exitCode = 1
  } else {
    console.log(`verify-changelog: ${CHANGELOG} accounts for every ${RELEASE_TAG_PREFIX} release.`)
  }
}
